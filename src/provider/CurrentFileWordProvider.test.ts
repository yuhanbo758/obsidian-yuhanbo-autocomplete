import { expect, jest, test } from "@jest/globals";
import type { App } from "obsidian";
import type { AppHelper } from "../app-helper";
import { ChineseTokenizer } from "../tokenizer/tokenizers/ChineseTokenizer";
import { CurrentFileWordProvider } from "./CurrentFileWordProvider";

const option = {
  onlyEnglish: false,
  minNumberOfCharacters: 2,
  makeSynonymAboutEmoji: false,
  makeSynonymAboutAccentsDiacritics: false,
  excludeWordPatterns: [],
};
function fixture() {
  let content = "知识管理 人工智能";
  const editor = {
    getValue: () => content,
    getLine: () => content,
    getCursor: () => ({ line: 0, ch: 0 }),
  };
  const file = { path: "fixture.md" };
  const app = { workspace: { getActiveFile: () => file } } as unknown as App;
  const helper = { getCurrentEditor: () => editor } as unknown as AppHelper;
  const provider = new CurrentFileWordProvider(app, helper);
  const tokenizer = ChineseTokenizer.create();
  provider.setSettings(tokenizer);
  return {
    provider,
    tokenizer,
    setContent: (value: string) => {
      content = value;
    },
  };
}

test("后台刷新完整提交并复用未变化快照", async () => {
  const { provider, tokenizer } = fixture();
  const tokenize = jest.spyOn(tokenizer, "tokenizeForIndex");
  await provider.refreshWords(option);
  expect(provider.wordCount).toBeGreaterThan(0);
  const index = provider.wordsByFirstLetter,
    calls = tokenize.mock.calls.length;
  await provider.refreshWords(option);
  expect(provider.wordsByFirstLetter).toBe(index);
  expect(tokenize).toHaveBeenCalledTimes(calls);
});

test("等待组词结束期间卸载不会发布旧文件词表", async () => {
  const { provider } = fixture();
  let resume!: (value: boolean) => void;
  const pending = provider.refreshWords(
    option,
    () =>
      new Promise<boolean>((resolve) => {
        resume = resolve;
      }),
  );
  provider.clearWords();
  resume(true);
  await pending;
  expect(provider.wordCount).toBe(0);
});

test("暂停期间继续输入后不发布与编辑器内容不一致的结果", async () => {
  const { provider, setContent } = fixture();
  let resume!: (value: boolean) => void;
  let calls = 0;
  const pending = provider.refreshWords(option, async () =>
    ++calls === 1
      ? new Promise<boolean>((resolve) => {
          resume = resolve;
        })
      : true,
  );
  setContent("新内容");
  resume(true);
  await pending;
  expect(provider.wordCount).toBe(0);
});
