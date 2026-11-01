import type { App } from "obsidian";
import type { AppHelper } from "../app-helper";
import type { Word } from "../model/Word";
import type { Tokenizer } from "../tokenizer/tokenizer";
import { isMatchedGlobPatterns } from "../util/glob";
import { dirname } from "../util/path";
import { startsSmallLetterOnlyFirst, synonymAliases } from "../util/strings";
import { yieldToMainThread } from "../util/yield-main-thread";
import { pushWord, type WordsByFirstLetter } from "./suggester";

export class CurrentVaultWordProvider {
  wordsByFirstLetter: WordsByFirstLetter = {};
  private words: Word[] = [];
  private tokenizer: Tokenizer;
  private revision = 0;
  private cacheKey = "";
  private settingsKey = "";
  private indexDirty = true;
  private fileWords = new Map<string, { stamp: string; words: Word[] }>();
  private includePrefixPatterns: string[];
  private excludePrefixPatterns: string[];
  private excludePathGlobPatterns: string[];
  private onlyUnderCurrentDirectory: boolean;

  constructor(
    private app: App,
    private appHelper: AppHelper,
  ) {}

  async refreshWords(
    option: {
      minNumberOfCharacters: number;
      makeSynonymAboutEmoji: boolean;
      makeSynonymAboutAccentsDiacritics: boolean;
      excludeWordPatterns: string[];
    },
    waitForIdle: () => Promise<boolean> = async () => true,
  ): Promise<void> {
    const revision = ++this.revision;
    const cacheKey = JSON.stringify(option);
    if (cacheKey !== this.cacheKey) {
      this.fileWords.clear();
      this.indexDirty = true;
    }
    this.cacheKey = cacheKey;

    if (!(await waitForIdle()) || revision !== this.revision) return;
    const currentDirname = this.appHelper.getCurrentDirname();

    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      const p = file.path;
      return (
        (this.includePrefixPatterns.length === 0 ||
          this.includePrefixPatterns.some((x) => p.startsWith(x))) &&
        !this.excludePrefixPatterns.some((x) => p.startsWith(x)) &&
        !isMatchedGlobPatterns(p, this.excludePathGlobPatterns) &&
        (!this.onlyUnderCurrentDirectory || dirname(p) === currentDirname)
      );
    });
    const livePaths = new Set(files.map((f) => f.path));
    for (const path of this.fileWords.keys()) {
      if (!livePaths.has(path)) {
        this.fileWords.delete(path);
        this.indexDirty = true;
      }
    }

    const excludePatterns = option.excludeWordPatterns.map(
      (x) => new RegExp(`^${x}$`),
    );
    let deadline = performance.now() + 4;
    const yieldToInput = async () => {
      await yieldToMainThread();
      if (!(await waitForIdle()) || revision !== this.revision) return false;
      deadline = performance.now() + 4;
      return true;
    };
    for (const file of files) {
      const path = file.path;
      const stamp = `${file.stat.mtime}:${file.stat.size}`;
      let cached = this.fileWords.get(path);
      if (!cached || cached.stamp !== stamp) {
        let content: string;
        try {
          content = await this.app.vault.cachedRead(file);
        } catch {
          continue;
        } // 建索引期间被删除或重命名的文件留待下次刷新。
        if (!(await waitForIdle()) || revision !== this.revision) return;
        const rawTokens = this.tokenizer.tokenizeForIndex
          ? await this.tokenizer.tokenizeForIndex(
              content,
              async () => revision === this.revision && (await waitForIdle()),
            )
          : this.tokenizer.tokenize(content);
        if (!rawTokens || revision !== this.revision) return;
        const seen = new Set<string>();
        const words: Word[] = [];
        let count = 0;
        for (const token of rawTokens) {
          if (
            token.length >= option.minNumberOfCharacters &&
            !this.tokenizer.shouldIgnoreOnCurrent(token)
          ) {
            const value = startsSmallLetterOnlyFirst(token)
              ? token.toLowerCase()
              : token;
            if (
              !seen.has(value) &&
              !excludePatterns.some((pattern) => pattern.test(value))
            ) {
              seen.add(value);
              words.push({
                value,
                type: "currentVault",
                createdPath: path,
                description: path,
                aliases: synonymAliases(value, {
                  emoji: option.makeSynonymAboutEmoji,
                  accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
                }),
              });
            }
          }
          if (
            ++count % 128 === 0 &&
            performance.now() >= deadline &&
            !(await yieldToInput())
          )
            return;
        }
        cached = { stamp, words };
        this.fileWords.set(path, cached);
        this.indexDirty = true;
      }
      if (performance.now() >= deadline && !(await yieldToInput())) return;
    }
    if (!this.indexDirty || revision !== this.revision) return;

    // 缓存读取、去重与首字索引都分批执行；结果完整后再替换，取消不会留下半成品。
    const wordByValue = new Map<string, Word>();
    let count = 0;
    for (const file of files) {
      for (const word of this.fileWords.get(file.path)?.words ?? []) {
        wordByValue.set(word.value, word);
        if (
          ++count % 256 === 0 &&
          performance.now() >= deadline &&
          !(await yieldToInput())
        )
          return;
      }
    }
    const words: Word[] = [];
    const wordsByFirstLetter: WordsByFirstLetter = {};
    for (const word of wordByValue.values()) {
      words.push(word);
      pushWord(wordsByFirstLetter, word.value.charAt(0), word);
      word.aliases?.forEach((alias) =>
        pushWord(wordsByFirstLetter, alias.charAt(0), word),
      );
      if (
        ++count % 256 === 0 &&
        performance.now() >= deadline &&
        !(await yieldToInput())
      )
        return;
    }
    if (revision !== this.revision) return;
    this.words = words;
    this.wordsByFirstLetter = wordsByFirstLetter;
    this.indexDirty = false;
  }

  clearWords(): void {
    ++this.revision;
    this.fileWords.clear();
    this.indexDirty = true;
    this.words = [];
    this.wordsByFirstLetter = {};
  }

  get wordCount(): number {
    return this.words.length;
  }

  setSettings(
    tokenizer: Tokenizer,
    includePrefixPatterns: string[],
    excludePrefixPatterns: string[],
    excludePathGlobPatterns: string[],
    onlyUnderCurrentDirectory: boolean,
  ) {
    const settingsKey = JSON.stringify([
      includePrefixPatterns,
      excludePrefixPatterns,
      excludePathGlobPatterns,
      onlyUnderCurrentDirectory,
    ]);
    if (this.tokenizer !== tokenizer || settingsKey !== this.settingsKey)
      ++this.revision;
    this.settingsKey = settingsKey;
    if (this.tokenizer !== tokenizer) {
      this.fileWords.clear();
      this.indexDirty = true;
    }
    this.tokenizer = tokenizer;
    this.includePrefixPatterns = includePrefixPatterns;
    this.excludePrefixPatterns = excludePrefixPatterns;
    this.excludePathGlobPatterns = excludePathGlobPatterns;
    this.onlyUnderCurrentDirectory = onlyUnderCurrentDirectory;
  }
}
