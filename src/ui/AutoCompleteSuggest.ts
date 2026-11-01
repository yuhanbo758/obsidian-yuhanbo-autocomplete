import {
  App,
  debounce,
  type Debouncer,
  Editor,
  type EditorPosition,
  EditorSuggest,
  type EditorSuggestContext,
  type EditorSuggestTriggerInfo,
  type EventRef,
  type KeymapEventHandler,
  type Modifier,
  normalizePath,
  Notice,
  Scope,
  TFile,
} from "obsidian";
import { AppHelper } from "../app-helper";
import type { InternalLinkWord, Word } from "../model/Word";
import { ColumnDelimiter } from "../option/ColumnDelimiter";
import { DescriptionOnSuggestion } from "../option/DescriptionOnSuggestion";
import { CurrentFileWordProvider } from "../provider/CurrentFileWordProvider";
import { CurrentVaultWordProvider } from "../provider/CurrentVaultWordProvider";
import { CustomDictionaryWordProvider } from "../provider/CustomDictionaryWordProvider";
import { FrontMatterWordProvider } from "../provider/FrontMatterWordProvider";
import { InternalLinkWordProvider } from "../provider/InternalLinkWordProvider";
import { MatchStrategy } from "../provider/MatchStrategy";
import { SpecificMatchStrategy } from "../provider/SpecificMatchStrategy";
import type { WordsByFirstLetter } from "../provider/suggester";
import { suggestionUniqPredicate } from "../provider/suggester";
import type { Settings } from "../setting/settings";
import {
  type HitWord,
  SelectionHistoryStorage,
  type SelectionHistoryTree,
} from "../storage/SelectionHistoryStorage";
import { createTokenizer, type Tokenizer } from "../tokenizer/tokenizer";
import { TokenizeStrategy } from "../tokenizer/TokenizeStrategy";
import { uniqWith } from "../util/collection-helper";
import { EditorInputActivity } from "../util/editor-input-activity";
import { LatestRequest } from "../util/latest-request";
import { metadataSignature } from "../util/metadata-signature";
import { DEFAULT_HISTORIES_PATH } from "../util/path";
import {
  applyQueryFirstLetterCase,
  encodeSpace,
  isInternalLink,
} from "../util/strings";
import { sameSuggestionContext } from "../util/suggestion-context";
import type { CommandReturnType } from "./popup-commands";
import * as commands from "./popup-commands";
import type { ProviderStatusBar } from "./ProviderStatusBar";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

export type IndexedWords = {
  currentFile: WordsByFirstLetter;
  currentVault: WordsByFirstLetter;
  customDictionary: WordsByFirstLetter;
  internalLink: WordsByFirstLetter;
  frontMatter: { [key: string]: WordsByFirstLetter };
};

// This is an unsafe code..!!
interface UnsafeEditorSuggestInterface {
  scope: Scope & { keys: (KeymapEventHandler & { func: CallableFunction })[] };
  suggestions: {
    selectedItem: number;
    useSelectedItem(ev: Partial<KeyboardEvent>): void;
    setSelectedItem(selected: number, event: KeyboardEvent): void;
    values: Word[];
  };
  isOpen: boolean;
  showSuggestions(words: Word[]): void;
}

export class AutoCompleteSuggest
  extends EditorSuggest<Word>
  implements UnsafeEditorSuggestInterface
{
  app: App;
  settings: Settings;
  appHelper: AppHelper;
  statusBar: ProviderStatusBar;

  currentFileWordProvider: CurrentFileWordProvider;
  currentVaultWordProvider: CurrentVaultWordProvider;
  customDictionaryWordProvider: CustomDictionaryWordProvider;
  internalLinkWordProvider: InternalLinkWordProvider;
  frontMatterWordProvider: FrontMatterWordProvider;
  selectionHistoryStorage: SelectionHistoryStorage | undefined;

  tokenizer: Tokenizer;
  private suggestionRequest: LatestRequest<EditorSuggestContext, Word[]>;
  private suggestionResultContexts = new WeakMap<
    Word[],
    { context: EditorSuggestContext; version: number }
  >();
  private suggestionRequestVersion = 0;
  private cancelledSuggestionResults = new WeakSet<Word[]>();
  private tokenizerKey = "";
  private disposed = false;
  private defaultHistoryPath: string;
  private inputActivity: EditorInputActivity;
  private compositionResumeTimer?: ReturnType<typeof setTimeout>;
  private backgroundVersions = new Map<string, number>();
  private metadataSignatures = new Map<
    string,
    ReturnType<typeof metadataSignature>
  >();
  private pendingFrontmatter = new Map<string, TFile>();
  private needsFullMetadata = false;
  private needsLinkMetadata = false;
  private refreshActiveFile: Debouncer<[], void>;
  private refreshVault: Debouncer<[], void>;
  private refreshMetadata: Debouncer<[], void>;
  debounceClose: Debouncer<[Editor, number, string], void>;

  runManually: boolean;
  completionMode: "prefix" | "partial" | "new";
  selectionLock = false;
  declare isOpen: boolean;

  contextStartCh: number;

  // unsafe!!
  scope: UnsafeEditorSuggestInterface["scope"];
  suggestions: UnsafeEditorSuggestInterface["suggestions"];

  keymapEventHandler: KeymapEventHandler[] = [];
  modifyEventRef: EventRef;
  activeLeafChangeRef: EventRef;
  metadataCacheChangeRef: EventRef;

  spareEditorSuggestContext: EditorSuggestContext | null = null;

  private predictableCycleState: {
    originalToken: string;
    replacementStartCh: number;
    line: number;
    candidates: string[];
    currentIndex: number;
  } | null = null;

  private constructor(app: App, statusBar: ProviderStatusBar) {
    super(app);
    this.appHelper = new AppHelper(app);
    this.statusBar = statusBar;
  }

  triggerComplete(opt?: { fallbackLinkify?: boolean }) {
    this.debounceClose?.cancel();
    const editor = this.appHelper.getCurrentEditor();
    const activeFile = this.app.workspace.getActiveFile();
    if (!editor || !activeFile) {
      return;
    }

    this.runManually = true;

    if (opt?.fallbackLinkify) {
      this.completionMode =
        this.completionMode === "prefix" ? "partial" : "new";
    }

    // XXX: Unsafe
    (this as any).trigger(editor, activeFile, true);
  }

  hideCompletion() {
    clearTimeout(this.compositionResumeTimer);
    this.compositionResumeTimer = undefined;
    this.suggestionRequest?.cancel();
    this.close();
  }

  /**
   * This method update settings
   */
  async unsafeLoadHistoryData(): Promise<SelectionHistoryTree> {
    const historyPath = normalizePath(
      this.settings.intelligentSuggestionPrioritization.historyFilePath ||
        this.defaultHistoryPath,
    );
    if (await this.appHelper.exists(historyPath)) {
      return this.appHelper.loadJson<SelectionHistoryTree>(historyPath);
    }

    return {};
  }

  static async new(
    app: App,
    settings: Settings,
    statusBar: ProviderStatusBar,
    onPersistSelectionHistory: () => void,
    registerEvent: (ref: EventRef) => void,
    defaultHistoryPath = DEFAULT_HISTORIES_PATH,
    inputActivity = new EditorInputActivity(),
  ): Promise<AutoCompleteSuggest> {
    const ins = new AutoCompleteSuggest(app, statusBar);
    ins.defaultHistoryPath = defaultHistoryPath;
    ins.inputActivity = inputActivity;

    ins.currentFileWordProvider = new CurrentFileWordProvider(
      ins.app,
      ins.appHelper,
    );
    ins.currentVaultWordProvider = new CurrentVaultWordProvider(
      ins.app,
      ins.appHelper,
    );
    ins.customDictionaryWordProvider = new CustomDictionaryWordProvider(
      ins.app,
      ins.appHelper,
    );
    ins.internalLinkWordProvider = new InternalLinkWordProvider(
      ins.app,
      ins.appHelper,
    );
    ins.frontMatterWordProvider = new FrontMatterWordProvider(
      ins.app,
      ins.appHelper,
    );

    await ins.updateSettings(settings);
    await ins.refreshIntelligentSuggestionPrioritization();
    // 内置词库体积小且不依赖元数据，先提供补全，避免等待其他插件的布局初始化。
    if (settings.enableBuiltinDictionary) {
      ins.customDictionaryWordProvider.addBuiltinWords();
      ins.statusBar.setCustomDictionaryIndexed(
        ins.customDictionaryWordProvider.wordCount,
      );
    }

    ins.refreshActiveFile = debounce(
      () => {
        if (!ins.disposed) void ins.refreshCurrentFileTokens();
      },
      300,
      true,
    );
    ins.refreshVault = debounce(
      () => {
        if (!ins.disposed) void ins.refreshCurrentVaultTokens();
      },
      1000,
      true,
    );
    ins.refreshMetadata = debounce(
      () => {
        if (!ins.disposed) void ins.flushMetadata();
      },
      350,
      true,
    );
    ins.modifyEventRef = app.vault.on("modify", (file) => {
      if (ins.appHelper.isActiveFile(file as TFile)) ins.refreshActiveFile();
      if (file.path.endsWith(".md")) ins.refreshVault();
      if (ins.selectionHistoryStorage?.shouldPersist) {
        onPersistSelectionHistory();
      }
    });
    ins.activeLeafChangeRef = app.workspace.on("active-leaf-change", () => {
      ins.predictableCycleState = null;
      ins.hideCompletion();
      ins.refreshActiveFile();
      if (ins.settings.includeCurrentVaultOnlyFilesUnderCurrentDirectory)
        ins.refreshVault();
      const file = app.workspace.getActiveFile();
      if (file) ins.rememberMetadata(file);
    });
    ins.metadataCacheChangeRef = app.metadataCache.on("changed", (file) => {
      const before = ins.metadataSignatures.get(file.path);
      const after = ins.rememberMetadata(file);
      if (before?.frontmatter !== after.frontmatter)
        ins.pendingFrontmatter.set(file.path, file);
      if (
        ins.settings.updateInternalLinksOnSave &&
        (before?.links !== after.links ||
          before?.frontmatter !== after.frontmatter)
      )
        ins.needsLinkMetadata = true;
      if (ins.pendingFrontmatter.size || ins.needsLinkMetadata)
        ins.refreshMetadata();
    });
    [
      ins.modifyEventRef,
      ins.activeLeafChangeRef,
      ins.metadataCacheChangeRef,
    ].forEach(registerEvent);
    const refreshFileList = () => {
      ins.needsFullMetadata = true;
      ins.refreshMetadata();
      ins.refreshVault();
    };
    registerEvent(app.vault.on("create", refreshFileList));
    registerEvent(app.vault.on("delete", refreshFileList));
    registerEvent(app.vault.on("rename", refreshFileList));

    // 已打开的库启用插件时不会再次触发 resolved；布局就绪后也必须初始化索引。
    app.workspace.onLayoutReady(() => {
      if (ins.disposed) return;
      const activeFile = app.workspace.getActiveFile();
      if (activeFile) ins.rememberMetadata(activeFile);
      ins.needsFullMetadata = true;
      void ins.flushMetadata();
      void ins.refreshCurrentFileTokens();
      void ins.refreshCustomDictionaryTokens();
      void ins.refreshCurrentVaultTokens();
    });

    ins.completionMode = ins.matchStrategy.name;

    return ins;
  }

  private shouldPauseForIme(editor?: Editor): boolean {
    return (
      this.settings.disableSuggestionsDuringImeOn &&
      (this.inputActivity.composing || this.appHelper.isIMEOn(editor))
    );
  }

  pauseForComposition(): void {
    clearTimeout(this.compositionResumeTimer);
    this.compositionResumeTimer = undefined;
    if (!this.settings.disableSuggestionsDuringImeOn) return;
    this.suggestionRequest?.cancel();
    this.debounceClose?.cancel();
    this.runManually = false;
    if (this.isOpen) this.close();
  }

  resumeAfterComposition(): void {
    clearTimeout(this.compositionResumeTimer);
    this.compositionResumeTimer = undefined;
    if (!this.settings.disableSuggestionsDuringImeOn) return;
    const editor = this.appHelper.getCurrentEditor();
    const file = this.app.workspace.getActiveFile();
    if (!editor || !file) return;
    const resume = (attempt: number) => {
      this.compositionResumeTimer = undefined;
      if (
        this.disposed ||
        !editor.hasFocus() ||
        !this.settings.complementAutomatically ||
        this.appHelper.getCurrentEditor() !== editor ||
        this.app.workspace.getActiveFile() !== file
      )
        return;
      // compositionend 与编辑器的最终事务可能分属不同任务，短暂等待公共组词状态归位。
      if (this.shouldPauseForIme(editor)) {
        if (attempt < 20)
          this.compositionResumeTimer = setTimeout(
            () => resume(attempt + 1),
            25,
          );
        return;
      }
      this.completionMode = this.matchStrategy.name;
      this.runManually = false;
      (
        this as unknown as {
          trigger(editor: Editor, file: TFile, force: boolean): void;
        }
      ).trigger(editor, file, true);
    };
    this.compositionResumeTimer = setTimeout(() => resume(0), 50);
  }

  private async backgroundReady(kind: string): Promise<boolean> {
    const version = (this.backgroundVersions.get(kind) ?? 0) + 1;
    this.backgroundVersions.set(kind, version);
    return (
      (await this.inputActivity.waitForIdle()) &&
      !this.disposed &&
      this.backgroundVersions.get(kind) === version
    );
  }

  private rememberMetadata(file: TFile) {
    const signature = metadataSignature(
      this.app.metadataCache.getFileCache(file),
    );
    this.metadataSignatures.set(file.path, signature);
    return signature;
  }

  private async flushMetadata(): Promise<void> {
    if (!(await this.backgroundReady("metadata"))) return;
    if (this.needsFullMetadata) {
      this.needsFullMetadata = false;
      this.needsLinkMetadata = false;
      this.pendingFrontmatter.clear();
      this.metadataSignatures.clear();
      this.app.vault
        .getMarkdownFiles()
        .forEach((file) => this.rememberMetadata(file));
      await this.refreshInternalLinkTokens();
      await this.refreshFrontMatterTokens();
      return;
    }
    if (this.needsLinkMetadata) {
      this.needsLinkMetadata = false;
      await this.refreshInternalLinkTokens();
    }
    if (this.pendingFrontmatter.size) {
      this.pendingFrontmatter.forEach((file) =>
        this.updateFrontMatterTokenIndex(file),
      );
      this.pendingFrontmatter.clear();
      this.updateFrontMatterToken();
    }
  }

  predictableComplete() {
    const editor = this.appHelper.getCurrentEditor();
    if (!editor || this.shouldPauseForIme(editor)) {
      return;
    }

    const cursor = editor.getCursor();

    // Check if we are continuing an existing cycle
    if (this.predictableCycleState) {
      const state = this.predictableCycleState;
      const currentCandidate = state.candidates[state.currentIndex];
      const expectedCh = state.replacementStartCh + currentCandidate.length;
      if (cursor.line === state.line && cursor.ch === expectedCh) {
        // Advance to next candidate
        state.currentIndex = (state.currentIndex + 1) % state.candidates.length;
        const nextCandidate = state.candidates[state.currentIndex];
        editor.replaceRange(
          nextCandidate,
          { line: state.line, ch: state.replacementStartCh },
          cursor,
        );
        this.close();
        this.debounceClose(
          editor,
          editor.getCursor().line,
          editor.getLine(editor.getCursor().line),
        );
        return;
      }
      // Cursor moved or changed — reset cycle
      this.predictableCycleState = null;
    }

    // Start a new cycle
    const currentToken = this.tokenizer
      .tokenize(editor.getLine(cursor.line).slice(0, cursor.ch))
      .last();
    if (!currentToken) {
      return;
    }

    const candidates = this.collectPredictableCandidates(
      editor,
      cursor,
      currentToken,
    );
    // candidates always ends with originalToken; skip if it's the only entry
    if (candidates.length <= 1) {
      return;
    }

    const replacementStartCh = cursor.ch - currentToken.length;
    this.predictableCycleState = {
      originalToken: currentToken,
      replacementStartCh,
      line: cursor.line,
      candidates,
      currentIndex: 0,
    };

    const suggestion = candidates[0];
    editor.replaceRange(
      suggestion,
      { line: cursor.line, ch: replacementStartCh },
      cursor,
    );

    this.close();
    this.debounceClose(
      editor,
      editor.getCursor().line,
      editor.getLine(editor.getCursor().line),
    );
  }

  private collectPredictableCandidates(
    editor: Editor,
    cursor: EditorPosition,
    originalToken: string,
  ): string[] {
    const seen = new Set<string>();
    const candidates: string[] = [];

    const addIfNew = (token: string) => {
      if (
        token.startsWith(originalToken) &&
        token !== originalToken &&
        !seen.has(token)
      ) {
        seen.add(token);
        candidates.push(token);
      }
    };

    // Determine search range
    const visibleRange = this.appHelper.getVisibleLineRange();
    const rangeStart = visibleRange?.from ?? Math.max(cursor.line - 50, 0);
    const rangeEnd =
      visibleRange?.to ?? Math.min(cursor.line + 50, editor.lineCount() - 1);

    // Above cursor (nearest first)
    const textAbove = editor.getRange({ line: rangeStart, ch: 0 }, cursor);
    this.tokenizer.tokenize(textAbove).reverse().slice(1).forEach(addIfNew);

    // Below cursor
    const textBelow = editor.getRange(cursor, {
      line: rangeEnd,
      ch: editor.getLine(rangeEnd).length,
    });
    this.tokenizer.tokenize(textBelow).forEach(addIfNew);

    // Append original token at the end for cycling back
    candidates.push(originalToken);

    return candidates;
  }

  unregister() {
    this.disposed = true;
    this.inputActivity.dispose();
    clearTimeout(this.compositionResumeTimer);
    this.suggestionRequest?.cancel();
    this.debounceClose?.cancel();
    this.refreshActiveFile?.cancel();
    this.refreshMetadata?.cancel();
    this.refreshVault?.cancel();
    this.currentFileWordProvider.clearWords();
    this.currentVaultWordProvider.clearWords();
    this.customDictionaryWordProvider.clearWords();
    this.setSelectionLock(false);
    this.close();
    this.app.vault.offref(this.modifyEventRef);
    this.app.workspace.offref(this.activeLeafChangeRef);
    this.app.metadataCache.offref(this.metadataCacheChangeRef);
  }

  // settings getters
  get tokenizerStrategy(): TokenizeStrategy {
    return TokenizeStrategy.fromName(this.settings.strategy);
  }

  get matchStrategy(): MatchStrategy {
    return MatchStrategy.fromName(this.settings.matchStrategy);
  }

  get frontMatterComplementStrategy(): SpecificMatchStrategy {
    return SpecificMatchStrategy.fromName(
      this.settings.frontMatterComplementMatchStrategy,
    );
  }

  get minNumberTriggered(): number {
    const globalMinChars =
      this.settings.minNumberOfCharactersTriggered ||
      this.tokenizerStrategy.triggerThreshold;

    const providerMinChars = [
      this.settings.currentFileMinNumberOfCharactersForTrigger,
      this.settings.currentVaultMinNumberOfCharactersForTrigger,
      this.settings.customDictionaryMinNumberOfCharactersForTrigger,
      this.settings.internalLinkMinNumberOfCharactersForTrigger,
    ].filter((x) => x > 0); // Only consider non-zero values

    if (providerMinChars.length === 0) {
      return globalMinChars;
    }

    return Math.min(globalMinChars, ...providerMinChars);
  }

  get currentFileMinNumberOfCharacters(): number {
    return (
      this.settings.currentFileMinNumberOfCharacters ||
      this.tokenizerStrategy.indexingThreshold
    );
  }

  get currentVaultMinNumberOfCharacters(): number {
    return (
      this.settings.currentVaultMinNumberOfCharacters ||
      this.tokenizerStrategy.indexingThreshold
    );
  }

  get descriptionOnSuggestion(): DescriptionOnSuggestion {
    return DescriptionOnSuggestion.fromName(
      this.settings.descriptionOnSuggestion,
    );
  }

  get excludeInternalLinkPrefixPathPatterns(): string[] {
    return this.settings.excludeInternalLinkPathPrefixPatterns
      .split("\n")
      .filter((x) => x);
  }

  // --- end ---

  get indexedWords(): IndexedWords {
    return {
      currentFile: this.currentFileWordProvider.wordsByFirstLetter,
      currentVault: this.currentVaultWordProvider.wordsByFirstLetter,
      customDictionary: this.customDictionaryWordProvider.wordsByFirstLetter,
      internalLink: this.internalLinkWordProvider.wordsByFirstLetter,
      frontMatter: this.frontMatterWordProvider.wordsByFirstLetterByKey,
    };
  }

  async updateSettings(settings: Settings) {
    this.settings = settings;

    this.statusBar.setMatchStrategy(this.matchStrategy);
    this.statusBar.setComplementAutomatically(
      this.settings.complementAutomatically,
    );

    const tokenizerKey = JSON.stringify([
      settings.strategy,
      settings.cedictPath,
      settings.treatUnderscoreAsPartOfWord,
    ]);
    if (!this.tokenizer || tokenizerKey !== this.tokenizerKey) {
      try {
        this.tokenizer = await createTokenizer(
          this.tokenizerStrategy,
          this.app,
          settings,
        );
      } catch (error: unknown) {
        new Notice(
          error instanceof Error
            ? error.message
            : "中文分词初始化失败，已使用内置分词。",
        );
        this.tokenizer = await createTokenizer(
          TokenizeStrategy.CHINESE,
          this.app,
          { ...settings, cedictPath: "" },
        );
      }
      this.tokenizerKey = tokenizerKey;
    }
    this.currentFileWordProvider.setSettings(this.tokenizer);
    this.currentVaultWordProvider.setSettings(
      this.tokenizer,
      settings.includeCurrentVaultPathPrefixPatterns
        .split("\n")
        .filter((x) => x),
      settings.excludeCurrentVaultPathPrefixPatterns
        .split("\n")
        .filter((x) => x),
      settings.excludeCurrentVaultPathGlobPatterns,
      settings.includeCurrentVaultOnlyFilesUnderCurrentDirectory,
    );
    this.customDictionaryWordProvider.setSettings(
      settings.enableCustomDictionaryComplement
        ? settings.customDictionaryPaths.split("\n").filter((x) => x)
        : [],
      ColumnDelimiter.fromName(settings.columnDelimiter),
      settings.delimiterToDivideSuggestionsForDisplayFromInsertion || null,
    );

    this.suggestionRequest?.cancel();
    this.debounceClose?.cancel();
    this.suggestionRequest = new LatestRequest(
      (context: EditorSuggestContext): Word[] => {
        if (
          this.disposed ||
          this.shouldPauseForIme(context.editor) ||
          this.appHelper.getCurrentEditor() !== context.editor ||
          !this.appHelper.equalsAsEditorPosition(
            context.editor.getCursor(),
            context.end,
          )
        )
          return [];
        const start = performance.now();

        const parsedQuery = JSON.parse(context.query) as {
          currentFrontMatter?: string;
          completionMode: AutoCompleteSuggest["completionMode"];
          queries: {
            word: string;
            offset: number;
          }[];
        };

        const createNewLinkSuggestions = (): Word[] =>
          parsedQuery.queries
            .slice()
            .reverse()
            .filter((q) => q.word.length >= this.minNumberTriggered)
            .map((q) => ({
              value: q.word,
              createdPath: "FIXME: ",
              type: "internalLink",
              phantom: true,
              offset: q.offset,
            }));

        if (parsedQuery.completionMode === "new") {
          return createNewLinkSuggestions();
        }

        const matchStrategy = MatchStrategy.fromName(
          parsedQuery.completionMode,
        );

        // Exclude internal link candidates at collection time (so the result
        // still fills up to "Max number of suggestions") when the cursor is in
        // a code environment. Skipped during the explicit linkify fallback
        // (completionMode diverges from the configured strategy), which is an
        // intentional link action by the user. Computed once: cheap inline
        // check first, heavy O(N) code-block scan last.
        const excludeInternalLinkInCode =
          this.settings.excludeInternalLinksInCode &&
          this.completionMode === this.matchStrategy.name &&
          (this.appHelper.inInlineCode(context.editor) ||
            this.appHelper.inCodeBlock(context.editor));

        let words = parsedQuery.queries
          .filter(
            (x, i, xs) =>
              parsedQuery.currentFrontMatter ||
              (this.settings.minNumberOfWordsTriggeredPhrase + i - 1 <
                xs.length &&
                x.word.length >= this.minNumberTriggered &&
                !x.word.endsWith(" ")),
          )
          .map((q) => {
            const handler =
              parsedQuery.currentFrontMatter &&
              this.frontMatterComplementStrategy !==
                SpecificMatchStrategy.INHERIT
                ? this.frontMatterComplementStrategy.handler
                : matchStrategy.handler;
            return handler(
              this.indexedWords,
              q.word,
              this.settings.maxNumberOfSuggestions,
              {
                frontMatter: parsedQuery.currentFrontMatter,
                selectionHistoryStorage: this.selectionHistoryStorage,
                fuzzy: this.settings.fuzzyMatch
                  ? {
                      minMatchScore: this.settings.minFuzzyMatchScore,
                    }
                  : undefined,
                providerMinChars: {
                  currentFile:
                    this.settings.currentFileMinNumberOfCharactersForTrigger,
                  currentVault:
                    this.settings.currentVaultMinNumberOfCharactersForTrigger,
                  customDictionary:
                    this.settings
                      .customDictionaryMinNumberOfCharactersForTrigger,
                  internalLink:
                    this.settings.internalLinkMinNumberOfCharactersForTrigger,
                },
                globalMinChar:
                  this.settings.minNumberOfCharactersTriggered ||
                  this.tokenizerStrategy.triggerThreshold,
                excludeInternalLink: excludeInternalLinkInCode,
              },
            ).map((word) => ({ ...word, offset: q.offset }));
          })
          .flat()
          .sort((a, b) => Number(a.fuzzy) - Number(b.fuzzy));

        // Fallback linkify and partial completion mode
        if (
          this.completionMode != this.matchStrategy.name &&
          this.completionMode === "partial"
        ) {
          words = words.filter((x) => x.type === "internalLink");
          if (words.length === 0) {
            return createNewLinkSuggestions();
          }
        }

        if (this.settings.excludeSelfInternalLink) {
          words = words.filter(
            (x) =>
              x.type !== "internalLink" ||
              x.createdPath !== this.appHelper.getActiveFile()?.path,
          );
        }

        if (this.settings.excludeExistingInActiveFileInternalLinks) {
          const activeFile = this.appHelper.getActiveFile()!;
          const linkPaths = this.appHelper.getResolvedLinks(activeFile);
          words = words.filter(
            (x) =>
              x.type !== "internalLink" || !linkPaths.includes(x.createdPath),
          );
        }

        this.showDebugLog(() =>
          buildLogMessage("Get suggestions", performance.now() - start),
        );
        return uniqWith(words, suggestionUniqPredicate).slice(
          0,
          this.settings.maxNumberOfSuggestions,
        );
      },
      this.settings.delayMilliSeconds,
      () => {
        const cancelled: Word[] = [];
        this.cancelledSuggestionResults.add(cancelled);
        return cancelled;
      },
    );

    // 补全后快速继续输入时，旧的关闭定时器不能关掉新候选框。
    this.debounceClose = debounce(
      (editor: Editor, line: number, content: string) => {
        if (
          this.appHelper.getCurrentEditor() === editor &&
          editor.getCursor().line === line &&
          editor.getLine(line) === content
        )
          this.close();
      },
      this.settings.delayMilliSeconds + 50,
    );

    this.registerHotkeys();
  }

  private registerKeyAsIgnored(modifiers: Modifier[], key: string | null) {
    this.keymapEventHandler.push(
      this.scope.register(modifiers, key, (evt) => {
        if (evt.isComposing) {
          return;
        }

        this.hideCompletion();
        return true;
      }),
    );
  }

  private setHotKey(
    name: keyof Settings["hotkeys"],
    handler: (evt: KeyboardEvent) => CommandReturnType,
  ) {
    this.settings.hotkeys[name].forEach((hk) => {
      this.keymapEventHandler.push(
        this.scope.register(hk.modifiers, hk.key, handler),
      );
    });
  }

  private setHotKeys(...params: Parameters<typeof this.setHotKey>[]) {
    params.forEach((args) => this.setHotKey(...args));
  }

  private registerHotkeys() {
    // Clear
    this.keymapEventHandler.forEach((x) => this.scope.unregister(x));
    this.keymapEventHandler = [];

    // Ignored
    const ipKeys = ["Enter", "Tab", "ArrowUp", "ArrowDown", "Home", "End"];
    this.scope.keys
      .filter((x) =>
        ipKeys
          .map((x) => x.toLowerCase())
          .includes((x.key ?? "").toLowerCase()),
      )
      .forEach((x) => this.scope.unregister(x));
    // propagateESC
    this.scope.keys.find((x) => x.key?.toLowerCase() === "escape")!.func =
      () => {
        this.hideCompletion();
        return this.settings.propagateEsc;
      };

    // Set hotkeys
    this.setHotKeys(
      ["select", (evt) => commands.select(this, evt)],
      ["up", (evt) => commands.selectPrevious(this, evt)],
      ["down", (evt) => commands.selectNext(this, evt)],
      ["select 1st", (evt) => commands.select(this, evt, 0)],
      ["select 2nd", (evt) => commands.select(this, evt, 1)],
      ["select 3rd", (evt) => commands.select(this, evt, 2)],
      ["select 4th", (evt) => commands.select(this, evt, 3)],
      ["select 5th", (evt) => commands.select(this, evt, 4)],
      ["select 6th", (evt) => commands.select(this, evt, 5)],
      ["select 7th", (evt) => commands.select(this, evt, 6)],
      ["select 8th", (evt) => commands.select(this, evt, 7)],
      ["select 9th", (evt) => commands.select(this, evt, 8)],
      [
        "select with custom alias",
        (evt) => {
          // For restore the context of suggestions to insert editor after submitted input
          this.spareEditorSuggestContext = this.context;

          commands.selectWithCustomAlias(this, evt).then((item) => {
            if (item) {
              this.selectSuggestion(item);
            }
          });
          return false;
        },
      ],
      [
        "select with custom alias and add to aliases",
        (evt) => {
          // For restore the context of suggestions to insert editor after submitted input
          this.spareEditorSuggestContext = this.context;

          commands
            .selectWithCustomAliasAndAddToAliases(this, evt)
            .then((item) => {
              if (item) {
                this.selectSuggestion(item);
              }
            });
          return false;
        },
      ],
      [
        "select with query alias",
        (evt) => {
          const item = commands.selectWithQueryAlias(this, evt);
          if (item) {
            this.selectSuggestion(item);
          }
          return false;
        },
      ],
      ["open", (_) => commands.open(this)],
      ["completion", (_) => commands.completion(this)],
      ["insert as text", (evt) => commands.insertAsText(this, evt)],
    );

    // propagate
    ipKeys.forEach((x) => this.registerKeyAsIgnored([], x));
  }

  async refreshCurrentFileTokens(): Promise<void> {
    const start = performance.now();
    this.statusBar.setCurrentFileIndexing();

    if (!this.settings.enableCurrentFileComplement) {
      this.backgroundVersions.set(
        "CurrentFile",
        (this.backgroundVersions.get("CurrentFile") ?? 0) + 1,
      );
      this.statusBar.setCurrentFileDisabled();
      this.currentFileWordProvider.clearWords();
      this.showDebugLog(() =>
        buildLogMessage(
          "👢 Skip: Index current file tokens",
          performance.now() - start,
        ),
      );
      return;
    }

    if (!(await this.backgroundReady("CurrentFile"))) return;

    await this.currentFileWordProvider.refreshWords(
      {
        onlyEnglish: this.settings.onlyComplementEnglishOnCurrentFileComplement,
        minNumberOfCharacters: this.currentFileMinNumberOfCharacters,
        makeSynonymAboutEmoji: this.settings.matchingWithoutEmoji,
        makeSynonymAboutAccentsDiacritics:
          this.settings.treatAccentDiacriticsAsAlphabeticCharacters,
        excludeWordPatterns: this.settings.excludeCurrentFileWordPatterns,
      },
      () => this.inputActivity.waitForIdle(),
    );

    this.statusBar.setCurrentFileIndexed(
      this.currentFileWordProvider.wordCount,
    );
    this.showDebugLog(() =>
      buildLogMessage("Index current file tokens", performance.now() - start),
    );
  }

  async refreshCurrentVaultTokens(): Promise<void> {
    const start = performance.now();
    this.statusBar.setCurrentVaultIndexing();

    if (!this.settings.enableCurrentVaultComplement) {
      this.backgroundVersions.set(
        "CurrentVault",
        (this.backgroundVersions.get("CurrentVault") ?? 0) + 1,
      );
      this.statusBar.setCurrentVaultDisabled();
      this.currentVaultWordProvider.clearWords();
      this.showDebugLog(() =>
        buildLogMessage(
          "👢 Skip: Index current vault tokens",
          performance.now() - start,
        ),
      );
      return;
    }

    if (!(await this.backgroundReady("CurrentVault"))) return;

    await this.currentVaultWordProvider.refreshWords(
      {
        minNumberOfCharacters: this.currentVaultMinNumberOfCharacters,
        makeSynonymAboutEmoji: this.settings.matchingWithoutEmoji,
        makeSynonymAboutAccentsDiacritics:
          this.settings.treatAccentDiacriticsAsAlphabeticCharacters,
        excludeWordPatterns: this.settings.excludeCurrentVaultWordPatterns,
      },
      () => this.inputActivity.waitForIdle(),
    );

    this.statusBar.setCurrentVaultIndexed(
      this.currentVaultWordProvider.wordCount,
    );
    this.showDebugLog(() =>
      buildLogMessage("Index current vault tokens", performance.now() - start),
    );
  }

  async refreshCustomDictionaryTokens(): Promise<void> {
    const start = performance.now();
    this.statusBar.setCustomDictionaryIndexing();

    if (
      !this.settings.enableCustomDictionaryComplement &&
      !this.settings.enableBuiltinDictionary
    ) {
      this.backgroundVersions.set(
        "CustomDictionary",
        (this.backgroundVersions.get("CustomDictionary") ?? 0) + 1,
      );
      this.statusBar.setCustomDictionaryDisabled();
      this.customDictionaryWordProvider.clearWords();
      this.showDebugLog(() =>
        buildLogMessage(
          "👢Skip: Index custom dictionary tokens",
          performance.now() - start,
        ),
      );
      return;
    }

    if (!(await this.backgroundReady("CustomDictionary"))) return;

    await this.customDictionaryWordProvider.refreshCustomWords({
      builtin: this.settings.enableBuiltinDictionary,
      regexp: this.settings.customDictionaryWordRegexPattern,
      delimiterForHide: this.settings.delimiterToHideSuggestion || undefined,
      delimiterForDisplay:
        this.settings.delimiterToDivideSuggestionsForDisplayFromInsertion ||
        undefined,
      caretSymbol:
        this.settings.caretLocationSymbolAfterComplement || undefined,
      makeSynonymAboutEmoji: this.settings.matchingWithoutEmoji,
      makeSynonymAboutAccentsDiacritics:
        this.settings.treatAccentDiacriticsAsAlphabeticCharacters,
    });

    this.statusBar.setCustomDictionaryIndexed(
      this.customDictionaryWordProvider.wordCount,
    );
    this.showDebugLog(() =>
      buildLogMessage(
        "Index custom dictionary tokens",
        performance.now() - start,
      ),
    );
  }

  async refreshInternalLinkTokens(): Promise<void> {
    const start = performance.now();
    this.statusBar.setInternalLinkIndexing();

    if (!this.settings.enableInternalLinkComplement) {
      this.backgroundVersions.set(
        "InternalLink",
        (this.backgroundVersions.get("InternalLink") ?? 0) + 1,
      );
      this.statusBar.setInternalLinkDisabled();
      this.internalLinkWordProvider.clearWords();
      this.showDebugLog(() =>
        buildLogMessage(
          "👢Skip: Index internal link tokens",
          performance.now() - start,
        ),
      );
      return;
    }

    if (!(await this.backgroundReady("InternalLink"))) return;

    this.internalLinkWordProvider.refreshWords({
      wordAsInternalLinkAlias: this.settings.suggestInternalLinkWithAlias,
      excludePathPrefixPatterns: this.excludeInternalLinkPrefixPathPatterns,
      excludePathGlobPatterns:
        this.settings.excludeInternalLinkPathGlobPatterns,
      makeSynonymAboutEmoji: this.settings.matchingWithoutEmoji,
      makeSynonymAboutAccentsDiacritics:
        this.settings.treatAccentDiacriticsAsAlphabeticCharacters,
      frontMatterKeyForExclusion:
        this.settings.frontMatterKeyForExclusionInternalLink,
      tagsForExclusion: this.settings.tagsForExclusionInternalLink,
      excludeUnresolvedLinks: this.settings.excludeUnresolvedInternalLinks,
    });

    this.statusBar.setInternalLinkIndexed(
      this.internalLinkWordProvider.wordCount,
    );
    this.showDebugLog(() =>
      buildLogMessage("Index internal link tokens", performance.now() - start),
    );
  }

  async refreshFrontMatterTokens(): Promise<void> {
    const start = performance.now();
    this.statusBar.setFrontMatterIndexing();

    if (!this.settings.enableFrontMatterComplement) {
      this.backgroundVersions.set(
        "FrontMatter",
        (this.backgroundVersions.get("FrontMatter") ?? 0) + 1,
      );
      this.statusBar.setFrontMatterDisabled();
      this.frontMatterWordProvider.clearWords();
      this.showDebugLog(() =>
        buildLogMessage(
          "👢Skip: Index front matter tokens",
          performance.now() - start,
        ),
      );
      return;
    }

    if (!(await this.backgroundReady("FrontMatter"))) return;

    this.frontMatterWordProvider.refreshWords();

    this.statusBar.setFrontMatterIndexed(
      this.frontMatterWordProvider.wordCount,
    );
    this.showDebugLog(() =>
      buildLogMessage("Index front matter tokens", performance.now() - start),
    );
  }

  async refreshIntelligentSuggestionPrioritization(): Promise<void> {
    // Need to migration
    if (this.settings.intelligentSuggestionPrioritization.enabled) {
      this.selectionHistoryStorage = new SelectionHistoryStorage(
        await this.unsafeLoadHistoryData(),
        this.settings.intelligentSuggestionPrioritization.maxDaysToKeepHistory,
        this.settings.intelligentSuggestionPrioritization
          .maxNumberOfHistoryToKeep,
      );
      this.selectionHistoryStorage.purge();
    } else {
      this.selectionHistoryStorage = undefined;
    }
  }

  updateFrontMatterTokenIndex(file: TFile): void {
    const start = performance.now();
    if (!this.settings.enableFrontMatterComplement) {
      this.showDebugLog(() =>
        buildLogMessage(
          "👢Skip: Update front matter token index",
          performance.now() - start,
        ),
      );
      return;
    }

    this.frontMatterWordProvider.updateWordIndex(file);

    this.showDebugLog(() =>
      buildLogMessage(
        "Update front matter token index",
        performance.now() - start,
      ),
    );
  }

  updateFrontMatterToken(): void {
    const start = performance.now();
    if (!this.settings.enableFrontMatterComplement) {
      this.showDebugLog(() =>
        buildLogMessage(
          "👢Skip: Update front matter token",
          performance.now() - start,
        ),
      );
      return;
    }

    this.frontMatterWordProvider.updateWords();
    this.statusBar.setFrontMatterIndexed(
      this.frontMatterWordProvider.wordCount,
    );

    this.showDebugLog(() =>
      buildLogMessage("Update front matter token", performance.now() - start),
    );
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
  ): EditorSuggestTriggerInfo | null {
    const start = performance.now();

    const showDebugLog = (message: string) => {
      this.showDebugLog(() => `[onTrigger] ${message}`);
    };
    const onReturnNull = (message: string) => {
      this.suggestionRequest?.cancel();
      showDebugLog(message);
      this.runManually = false;
      this.completionMode = this.matchStrategy.name;
      this.close();
    };

    if (
      !this.settings.complementAutomatically &&
      !this.isOpen &&
      !this.runManually
    ) {
      onReturnNull("Don't show suggestions");
      return null;
    }

    if (this.shouldPauseForIme(editor)) {
      onReturnNull("Don't show suggestions for IME");
      return null;
    }

    const currentFrontMatter = this.settings.enableFrontMatterComplement
      ? this.appHelper.getCurrentFrontMatter()
      : undefined;

    const currentLineUntilCursor =
      this.appHelper.getCurrentLineUntilCursor(editor);
    if (currentLineUntilCursor.startsWith("---")) {
      onReturnNull(
        "Don't show suggestions because it supposes front matter or horizontal line",
      );
      return null;
    }
    const suppressedPattern = this.settings.patternsToSuppressTrigger.find(
      (p) => new RegExp(p).test(currentLineUntilCursor),
    );
    if (suppressedPattern) {
      onReturnNull(
        `Don't show suggestions because it is the ignored pattern: ${suppressedPattern}`,
      );
      return null;
    }

    if (
      this.settings.disableSuggestionsInMathBlock &&
      this.appHelper.inMathBlock(editor)
    ) {
      onReturnNull(
        `Suggestions are disabled while the cursor is inside a Math block.`,
      );
      return null;
    }

    if (
      this.settings.disableSuggestionsInCodeBlock &&
      this.appHelper.inCodeBlock(editor)
    ) {
      onReturnNull(
        `Suggestions are disabled while the cursor is inside a Code block.`,
      );
      return null;
    }

    const tokenized = this.tokenizer.recursiveTokenize(
      currentLineUntilCursor,
      this.settings.maxNumberOfWordsAsPhrase,
    );
    let currentTokens = tokenized.slice(
      tokenized.length > this.settings.maxNumberOfWordsAsPhrase
        ? tokenized.length - this.settings.maxNumberOfWordsAsPhrase
        : 0,
    );

    const currentPhrase = currentTokens.first()?.word;
    if (!currentPhrase) {
      onReturnNull(`Don't show suggestions because currentPhrase is empty`);
      return null;
    }

    const currentTokenSeparatedWhiteSpace =
      currentLineUntilCursor.split(" ").last() ?? "";
    if (
      currentTokenSeparatedWhiteSpace.length > 0 &&
      this.settings.firstCharactersDisableSuggestions.includes(
        currentTokenSeparatedWhiteSpace.charAt(0),
      )
    ) {
      onReturnNull(
        `Don't show suggestions for avoiding to conflict with the other commands.`,
      );
      return null;
    }

    if (
      currentPhrase.length === 1 &&
      Boolean(currentPhrase.match(this.tokenizer.getTrimPattern("input")))
    ) {
      onReturnNull(
        `Don't show suggestions because currentPhrase is TRIM_PATTERN`,
      );
      return null;
    }

    if (
      !this.runManually &&
      !currentFrontMatter &&
      currentPhrase.length < this.minNumberTriggered
    ) {
      onReturnNull(
        "Don't show suggestions because currentPhrase is less than minNumberTriggered option",
      );
      return null;
    }

    if (this.runManually) {
      this.setSelectionLock(false);
    } else {
      this.setSelectionLock(this.settings.noAutoFocusUntilCycle);
    }

    showDebugLog(buildLogMessage("onTrigger", performance.now() - start));
    this.runManually = false;

    const patterns = this.settings.phrasePatternsToSuppressTrigger;
    const suppressedTokens =
      patterns.length === 0 || currentFrontMatter
        ? currentTokens
        : currentTokens.filter((t) =>
            patterns.every((p) => !new RegExp(`^${p}$`).test(t.word)),
          );
    if (suppressedTokens.length === 0) {
      onReturnNull(
        "Don't show suggestions because all tokens are ignored by token pattern",
      );
      return null;
    }

    // Hack implementation for Front matter complement
    const currentToken = currentTokens.last()!.word;
    if (currentFrontMatter && currentToken.match(/[^ ] $/)) {
      currentTokens.push({ word: "", offset: currentLineUntilCursor.length });
    }

    // For multi-word completion
    this.contextStartCh = cursor.ch - currentPhrase.length;

    return {
      start: {
        ch: cursor.ch - (currentTokens.last()?.word?.length ?? 0), // For multi-word completion
        line: cursor.line,
      },
      end: cursor,
      query: JSON.stringify({
        currentFrontMatter,
        completionMode: this.completionMode,
        queries: suppressedTokens.map((x) => ({
          ...x,
          offset: x.offset - currentTokens[0].offset,
        })),
      }),
    };
  }

  getSuggestions(context: EditorSuggestContext): Word[] | Promise<Word[]> {
    const version = ++this.suggestionRequestVersion;
    return this.suggestionRequest.run(context).then((words) => {
      this.suggestionResultContexts.set(words, { context, version });
      return words;
    });
  }

  showSuggestions(words: Word[]): void {
    // 取消产生的空结果只负责结束旧 Promise，不能进入核心的 close() 清除新 context。
    if (this.cancelledSuggestionResults.has(words)) return;
    const origin = this.suggestionResultContexts.get(words);
    if (
      origin &&
      (origin.version !== this.suggestionRequestVersion ||
        !sameSuggestionContext(origin.context, this.context) ||
        this.disposed ||
        this.shouldPauseForIme(origin.context.editor))
    )
      return;
    const core = EditorSuggest.prototype as unknown as Pick<
      UnsafeEditorSuggestInterface,
      "showSuggestions"
    >;
    core.showSuggestions.call(this, words);
  }

  renderSuggestion(word: Word, el: HTMLElement): void {
    const base = createDiv();

    let text = word.value;
    if (
      word.type === "customDictionary" &&
      word.insertedText &&
      this.settings.displayedTextSuffix
    ) {
      text += this.settings.displayedTextSuffix;
    }

    base.createDiv({
      text,
      cls:
        word.type === "internalLink" && word.aliasMeta
          ? "various-complements__suggestion-item__content__alias"
          : undefined,
    });

    const description = this.descriptionOnSuggestion.toDisplay(word);
    if (description) {
      base.createDiv({
        cls: "various-complements__suggestion-item__description",
        text: `${description}`,
      });
    }

    el.appendChild(base);

    el.addClass("various-complements__suggestion-item");
    switch (word.type) {
      case "currentFile":
        el.addClass("various-complements__suggestion-item__current-file");
        break;
      case "currentVault":
        el.addClass("various-complements__suggestion-item__current-vault");
        break;
      case "customDictionary":
        el.addClass("various-complements__suggestion-item__custom-dictionary");
        break;
      case "internalLink":
        el.addClass("various-complements__suggestion-item__internal-link");
        if (word.phantom) {
          el.addClass("various-complements__suggestion-item__phantom");
        }
        break;
      case "frontMatter":
        el.addClass("various-complements__suggestion-item__front-matter");
        break;
    }
  }

  constructInternalLinkText(
    word: InternalLinkWord,
    forceWithAlias: boolean,
    option?: {
      preserveFirstLetterCase?: boolean;
    },
  ): string {
    const query = word.query;
    const preserveFirstLetterCase = Boolean(
      option?.preserveFirstLetterCase && query,
    );
    const applyQueryFirstLetterCaseIfNeeded = (value: string): string =>
      preserveFirstLetterCase
        ? applyQueryFirstLetterCase(value, query!)
        : value;

    // With aliases
    if (
      (this.settings.suggestInternalLinkWithAlias || forceWithAlias) &&
      word.aliasMeta
    ) {
      const { link } = this.appHelper.optimizeMarkdownLinkText(
        word.aliasMeta.origin,
      )!;
      const displayed = applyQueryFirstLetterCaseIfNeeded(word.value);
      return this.appHelper.useWikiLinks
        ? `[[${link}|${displayed}]]`
        : `[${displayed}](${encodeSpace(link)}.md)`;
    }

    const pattern = this.settings
      .insertAliasTransformedFromDisplayedInternalLink.enabled
      ? new RegExp(
          this.settings.insertAliasTransformedFromDisplayedInternalLink
            .beforeRegExp,
        )
      : null;
    const match = (value: string) =>
      pattern ? Boolean(value.match(pattern)) : false;
    const replaceByPattern = (value: string) =>
      pattern
        ? value.replace(
            pattern,
            this.settings.insertAliasTransformedFromDisplayedInternalLink.after,
          )
        : value;

    const { displayed, link } = this.appHelper.optimizeMarkdownLinkText(
      word.phantom ? word.value : word.createdPath,
    )!;
    if (
      this.appHelper.newLinkFormat === "shortest" &&
      displayed.includes("/")
    ) {
      const alias = applyQueryFirstLetterCaseIfNeeded(word.value);
      return this.appHelper.useWikiLinks
        ? `[[${link}|${alias}]]`
        : `[${alias}](${encodeSpace(link)}.md)`;
    }

    if (this.appHelper.useWikiLinks) {
      if (match(link)) {
        const alias = applyQueryFirstLetterCaseIfNeeded(replaceByPattern(link));
        return `[[${link}|${alias}]]`;
      }

      const alias = applyQueryFirstLetterCaseIfNeeded(displayed);
      return alias !== link ? `[[${link}|${alias}]]` : `[[${link}]]`;
    }

    const displayedText = match(displayed)
      ? replaceByPattern(displayed)
      : displayed;
    const alias = applyQueryFirstLetterCaseIfNeeded(displayedText);
    return `[${alias}](${encodeSpace(link)}.md)`;
  }

  selectSuggestion(word: Word): void {
    if (this.shouldPauseForIme(this.context?.editor)) return;
    this.completionMode = this.matchStrategy.name;

    let forceWithAlias = false;
    let context = this.context;
    if (!context) {
      context = this.spareEditorSuggestContext;
      this.spareEditorSuggestContext = null;
      forceWithAlias = true;
    }
    if (!context) {
      return;
    }

    let insertedText = word.value;
    if (word.type === "internalLink") {
      insertedText = this.constructInternalLinkText(word, forceWithAlias, {
        preserveFirstLetterCase:
          this.settings.preserveFirstLetterCaseOnInternalLink,
      });
    }

    if (word.type === "frontMatter") {
      if (isInternalLink(insertedText)) {
        insertedText = `"${insertedText}"`;
      }
      if (this.settings.insertCommaAfterFrontMatterCompletion) {
        insertedText = `${insertedText}, `;
      }
    } else {
      if (
        this.settings.insertSpaceAfterCompletion &&
        !(word.type === "customDictionary" && word.ignoreSpaceAfterCompletion)
      ) {
        insertedText = `${insertedText} `;
      }
    }

    let positionToMove = -1;

    if (word.type === "customDictionary") {
      if (word.insertedText) {
        insertedText = word.insertedText;
      }

      const caret = word.caretSymbol;
      if (caret) {
        positionToMove = insertedText.indexOf(caret);
        insertedText = insertedText.replace(caret, "");
      }
    }

    const editor = context.editor;
    editor.replaceRange(
      insertedText,
      {
        ...context.start,
        ch: this.contextStartCh + word.offset!,
      },
      context.end,
    );

    if (positionToMove !== -1) {
      editor.setCursor(
        editor.offsetToPos(
          editor.posToOffset(editor.getCursor()) -
            insertedText.length +
            positionToMove,
        ),
      );
    }

    // The workaround of strange behavior for that cursor doesn't move after completion only if it doesn't input any word.
    if (this.appHelper.equalsAsEditorPosition(context.start, context.end)) {
      editor.setCursor(
        editor.offsetToPos(
          editor.posToOffset(editor.getCursor()) + insertedText.length,
        ),
      );
    }

    this.selectionHistoryStorage?.increment(word as HitWord);
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log("[Autocomplete] 补全历史已更新");
    }

    this.close();
    this.debounceClose(
      editor,
      editor.getCursor().line,
      editor.getLine(editor.getCursor().line),
    );
  }

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }

  setSelectionLock(lock: boolean) {
    this.selectionLock = lock;
    const lockClass = "various-complements__selection-lock";

    const body = document.querySelector("body")!;
    if (lock) {
      body.addClass(lockClass);
    } else {
      body.removeClass(lockClass);
    }
  }
}
