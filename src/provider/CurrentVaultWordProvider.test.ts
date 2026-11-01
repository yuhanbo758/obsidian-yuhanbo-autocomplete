import { expect, jest, test } from "@jest/globals";
import type { App, TFile } from "obsidian";
import type { AppHelper } from "../app-helper";
import { DefaultTokenizer } from "../tokenizer/tokenizers/DefaultTokenizer";
import { CurrentVaultWordProvider } from "./CurrentVaultWordProvider";

const option = {
  minNumberOfCharacters: 2,
  makeSynonymAboutEmoji: false,
  makeSynonymAboutAccentsDiacritics: false,
  excludeWordPatterns: [],
};
const file = (path: string, mtime = 1) =>
  ({ path, stat: { mtime, size: 10 } }) as TFile;

function fixture() {
  const files = [file("a/one.md"), file("b/two.md")];
  const cachedRead = jest.fn(
    async (f: TFile): Promise<string> =>
      f.path.startsWith("a/") ? "alpha alphabeta" : "bravo bravodelta",
  );
  const app = {
    vault: { getMarkdownFiles: () => files, cachedRead },
  } as unknown as App;
  const helper = { getCurrentDirname: () => "a" } as AppHelper;
  const provider = new CurrentVaultWordProvider(app, helper);
  const tokenizer = new DefaultTokenizer();
  provider.setSettings(tokenizer, ["a/", "b/"], [], [], false);
  return { files, provider, cachedRead, tokenizer };
}

test("多个包含路径按任意匹配处理；再次刷新只读取被修改的文件", async () => {
  const { files, provider, cachedRead } = fixture();
  await provider.refreshWords(option);
  expect(provider.wordCount).toBe(4);
  expect(cachedRead).toHaveBeenCalledTimes(2);
  await provider.refreshWords(option);
  expect(cachedRead).toHaveBeenCalledTimes(2);
  files[0].stat.mtime++;
  await provider.refreshWords(option);
  expect(cachedRead).toHaveBeenCalledTimes(3);
});

test("删除和重命名后清除旧词与旧路径", async () => {
  const { files, provider } = fixture();
  await provider.refreshWords(option);
  files.shift();
  files[0].path = "b/renamed.md";
  await provider.refreshWords(option);
  expect(provider.wordsByFirstLetter.a).toBeUndefined();
  expect(provider.wordsByFirstLetter.b[0].createdPath).toBe("b/renamed.md");
});

test("卸载或禁用索引可取消尚未结束的刷新", async () => {
  const { provider, cachedRead } = fixture();
  let finish!: (value: string) => void;
  cachedRead.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = provider.refreshWords(option);
  await Promise.resolve();
  provider.clearWords();
  finish("alpha");
  await pending;
  expect(provider.wordCount).toBe(0);
  expect(provider.wordsByFirstLetter).toEqual({});
});

test("切换分词器或过滤条件后重新读取词表", async () => {
  const { provider, cachedRead } = fixture();
  await provider.refreshWords(option);
  await provider.refreshWords({ ...option, minNumberOfCharacters: 7 });
  expect(provider.wordCount).toBe(2);
  expect(cachedRead).toHaveBeenCalledTimes(4);
  provider.setSettings(new DefaultTokenizer(), [], [], [], false);
  await provider.refreshWords(option);
  expect(cachedRead).toHaveBeenCalledTimes(6);
});

test("未修改任何文件时保留原首字索引，不重复合并全库", async () => {
  const { provider } = fixture();
  await provider.refreshWords(option);
  const index = provider.wordsByFirstLetter;
  await provider.refreshWords(option);
  expect(provider.wordsByFirstLetter).toBe(index);
});

test("组词期间不读取或分词，取消等待后不发布新索引", async () => {
  const { provider, cachedRead } = fixture();
  let resume!: (ready: boolean) => void;
  const pending = provider.refreshWords(
    option,
    () =>
      new Promise<boolean>((resolve) => {
        resume = resolve;
      }),
  );
  expect(cachedRead).not.toHaveBeenCalled();
  provider.clearWords();
  resume(true);
  await pending;
  expect(cachedRead).not.toHaveBeenCalled();
  expect(provider.wordCount).toBe(0);
});

test("异步读取期间切换配置后，旧索引不能发布", async () => {
  const { provider, cachedRead } = fixture();
  let finish!: (content: string) => void;
  cachedRead.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = provider.refreshWords(option);
  await Promise.resolve();
  provider.setSettings(new DefaultTokenizer(), [], [], [], false);
  finish("old stale words");
  await pending;
  expect(provider.wordCount).toBe(0);
});
