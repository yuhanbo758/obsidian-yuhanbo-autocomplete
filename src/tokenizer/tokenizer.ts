import type { App } from "obsidian";

import type { Settings } from "../setting/settings";
import { ArabicTokenizer } from "./tokenizers/ArabicTokenizer";
import { ChineseTokenizer } from "./tokenizers/ChineseTokenizer";
import { DefaultTokenizer } from "./tokenizers/DefaultTokenizer";
import { EnglishOnlyTokenizer } from "./tokenizers/EnglishOnlyTokenizer";
import { JapaneseTokenizer } from "./tokenizers/JapaneseTokenizer";
import { KoreanTokenizer } from "./tokenizers/KoreanTokenizer";
import type { TokenizeStrategy } from "./TokenizeStrategy";

export type TrimTarget = "input" | "indexing";

export interface FactoryArgs {
  treatUnderscoreAsPartOfWord?: boolean;
}

export interface Tokenizer {
  tokenize(content: string, raw?: boolean): string[];
  tokenizeForIndex?(
    content: string,
    waitForIdle: () => Promise<boolean>,
  ): Promise<string[] | null>;
  recursiveTokenize(
    content: string,
    maxTokens?: number,
  ): { word: string; offset: number }[];
  getTrimPattern(target: TrimTarget): RegExp;
  shouldIgnoreOnCurrent(query: string): boolean;
}

export async function createTokenizer(
  strategy: TokenizeStrategy,
  app: App,
  settings: Settings,
): Promise<Tokenizer> {
  switch (strategy.name) {
    case "default":
      return new DefaultTokenizer({
        treatUnderscoreAsPartOfWord: settings.treatUnderscoreAsPartOfWord,
      });
    case "english-only":
      return new EnglishOnlyTokenizer({
        treatUnderscoreAsPartOfWord: settings.treatUnderscoreAsPartOfWord,
      });
    case "arabic":
      return new ArabicTokenizer();
    case "japanese":
      return new JapaneseTokenizer();
    case "chinese":
      if (!settings.cedictPath.trim()) {
        return ChineseTokenizer.create();
      }
      const hasCedict = await app.vault.adapter.exists(settings.cedictPath);
      if (!hasCedict) {
        throw new Error(
          `未找到中文分词词典：${settings.cedictPath}。清空此路径可使用内置中文分词。`,
        );
      }
      const dict = await app.vault.adapter.read(settings.cedictPath);
      return ChineseTokenizer.create(dict);
    case "korean":
      return new KoreanTokenizer();
  }
}
