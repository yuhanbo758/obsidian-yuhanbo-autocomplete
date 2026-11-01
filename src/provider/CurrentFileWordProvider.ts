import type { App } from "obsidian";
import type { AppHelper } from "../app-helper";
import type { Word } from "../model/Word";
import type { Tokenizer } from "../tokenizer/tokenizer";
import {
  allAlphabets,
  startsSmallLetterOnlyFirst,
  synonymAliases,
} from "../util/strings";
import { yieldToMainThread } from "../util/yield-main-thread";
import { pushWord, type WordsByFirstLetter } from "./suggester";

export class CurrentFileWordProvider {
  wordsByFirstLetter: WordsByFirstLetter = {};
  private words: Word[] = [];
  private tokenizer: Tokenizer;
  private lastSnapshot = "";
  private revision = 0;

  constructor(
    private app: App,
    private appHelper: AppHelper,
  ) {}

  async refreshWords(
    option: {
      onlyEnglish: boolean;
      minNumberOfCharacters: number;
      makeSynonymAboutEmoji: boolean;
      makeSynonymAboutAccentsDiacritics: boolean;
      excludeWordPatterns: string[];
    },
    waitForIdle: () => Promise<boolean> = async () => true,
  ): Promise<void> {
    const revision = ++this.revision;
    const editor = this.appHelper.getCurrentEditor();
    if (!editor) {
      return;
    }

    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return;
    }

    // 活动编辑器包含尚未保存的内容，避免每次保存事件都重新读取磁盘。
    const content = editor.getValue();
    const snapshot = JSON.stringify([file.path, content, option]);
    if (snapshot === this.lastSnapshot) return;
    const ready = async () =>
      revision === this.revision && (await waitForIdle());
    const tokenize = (value: string) =>
      this.tokenizer.tokenizeForIndex
        ? this.tokenizer.tokenizeForIndex(value, ready)
        : Promise.resolve(this.tokenizer.tokenize(value));
    if (!(await ready())) return;
    const prefix = editor
      .getLine(editor.getCursor().line)
      .slice(0, editor.getCursor().ch);
    const currentTokens = await tokenize(prefix);
    if (!currentTokens || revision !== this.revision) return;
    const currentToken = currentTokens.at(-1);
    const rawTokens = await tokenize(content);
    if (!rawTokens || revision !== this.revision) return;
    const excludePatterns = option.excludeWordPatterns.map(
      (value) => new RegExp(`^${value}$`),
    );
    const seen = new Set<string>();
    const words: Word[] = [];
    const index: WordsByFirstLetter = {};
    let deadline = performance.now() + 4;
    let count = 0;
    for (const token of rawTokens) {
      if (
        token.length >= option.minNumberOfCharacters &&
        !this.tokenizer.shouldIgnoreOnCurrent(token) &&
        (!option.onlyEnglish || allAlphabets(token))
      ) {
        const value = startsSmallLetterOnlyFirst(token)
          ? token.toLowerCase()
          : token;
        if (
          value !== currentToken &&
          !seen.has(value) &&
          !excludePatterns.some((pattern) => pattern.test(value))
        ) {
          seen.add(value);
          const word: Word = {
            value,
            type: "currentFile",
            createdPath: file.path,
            aliases: synonymAliases(value, {
              emoji: option.makeSynonymAboutEmoji,
              accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
            }),
          };
          words.push(word);
          pushWord(index, word.value.charAt(0), word);
          word.aliases?.forEach((alias) =>
            pushWord(index, alias.charAt(0), word),
          );
        }
      }
      if (++count % 128 === 0 && performance.now() >= deadline) {
        await yieldToMainThread();
        if (!(await ready())) return;
        deadline = performance.now() + 4;
      }
    }
    // 暂停期间可能切换笔记或继续编辑，只提交仍对应当前内容的完整结果。
    if (
      revision !== this.revision ||
      this.appHelper.getCurrentEditor() !== editor ||
      this.app.workspace.getActiveFile() !== file ||
      editor.getValue() !== content
    )
      return;
    this.words = words;
    this.wordsByFirstLetter = index;
    this.lastSnapshot = snapshot;
  }

  clearWords(): void {
    ++this.revision;
    this.lastSnapshot = "";
    this.words = [];
    this.wordsByFirstLetter = {};
  }

  get wordCount(): number {
    return this.words.length;
  }

  setSettings(tokenizer: Tokenizer) {
    if (this.tokenizer !== tokenizer) {
      ++this.revision;
      this.lastSnapshot = "";
    }
    this.tokenizer = tokenizer;
  }
}
