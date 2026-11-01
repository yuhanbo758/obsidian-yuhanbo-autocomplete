import { expect, jest, test } from "@jest/globals";
import { Notice } from "obsidian";
import { BUILTIN_WORDS } from "../dictionary/builtin-words";
import { ColumnDelimiter } from "../option/ColumnDelimiter";
import { CustomDictionaryWordProvider } from "./CustomDictionaryWordProvider";
type App = import("obsidian").App;
type AppHelper = import("../app-helper").AppHelper;

jest.mock(
  "obsidian",
  () => ({
    Notice: class MockNotice {
      static calls = 0;
      constructor() {
        ++MockNotice.calls;
      }
    },
    requestUrl: () => {
      throw new Error("unexpected network request");
    },
  }),
  {
    virtual: true,
  },
);

test("自定义同名词覆盖内置插入内容，默认词库不需要网络", async () => {
  const adapter = {
    read: jest.fn(async () => "工作计划>>>自定义任务"),
    append: jest.fn(),
  };
  const provider = new CustomDictionaryWordProvider(
    { vault: { adapter } } as unknown as App,
    {} as AppHelper,
  );
  provider.setSettings(["dictionary.txt"], ColumnDelimiter.TAB, ">>>");
  await provider.refreshCustomWords({
    builtin: true,
    regexp: "",
    delimiterForDisplay: ">>>",
    makeSynonymAboutEmoji: false,
    makeSynonymAboutAccentsDiacritics: false,
  });
  expect(provider.wordByValue["工作计划"].insertedText).toBe("自定义任务");
  expect(
    provider.wordsByFirstLetter["工"].filter(
      (word) => word.value === "工作计划",
    ),
  ).toHaveLength(1);
  expect(provider.wordCount).toBe(BUILTIN_WORDS.length);
});

test("文件追加失败时不在内存中留下未保存的词语", async () => {
  const adapter = {
    append: jest.fn(async () => {
      throw new Error("read-only");
    }),
  };
  const provider = new CustomDictionaryWordProvider(
    { vault: { adapter } } as unknown as App,
    {} as AppHelper,
  );
  provider.setSettings(["dictionary.txt"], ColumnDelimiter.TAB, null);
  await expect(
    provider.addWordWithDictionary(
      {
        value: "自定义临时词",
        type: "customDictionary",
        createdPath: "dictionary.txt",
      },
      "dictionary.txt",
      { emoji: false, accentsDiacritics: false },
    ),
  ).rejects.toThrow("read-only");
  expect(provider.wordByValue["自定义临时词"]).toBeUndefined();
  expect(provider.wordCount).toBe(0);
});

test("切换词库配置时丢弃仍在读取的旧词库", async () => {
  let finish!: (text: string) => void;
  const adapter = {
    read: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  };
  const provider = new CustomDictionaryWordProvider(
    { vault: { adapter } } as unknown as App,
    {} as AppHelper,
  );
  provider.setSettings(["old.txt"], ColumnDelimiter.TAB, null);
  const pending = provider.refreshCustomWords({
    builtin: false,
    regexp: "",
    makeSynonymAboutEmoji: false,
    makeSynonymAboutAccentsDiacritics: false,
  });
  provider.setSettings(["new.txt"], ColumnDelimiter.TAB, null);
  finish("旧配置词条");
  await pending;
  expect(provider.wordCount).toBe(0);
});

test("卸载后异步读取失败不再弹出过期通知", async () => {
  let reject!: (error: Error) => void;
  const adapter = {
    read: () =>
      new Promise<string>((_resolve, fail) => {
        reject = fail;
      }),
  };
  const provider = new CustomDictionaryWordProvider(
    { vault: { adapter } } as unknown as App,
    {} as AppHelper,
  );
  provider.setSettings(["old.txt"], ColumnDelimiter.TAB, null);
  const notice = Notice as unknown as { calls: number };
  notice.calls = 0;
  const pending = provider.refreshCustomWords({
    builtin: false,
    regexp: "",
    makeSynonymAboutEmoji: false,
    makeSynonymAboutAccentsDiacritics: false,
  });
  provider.clearWords();
  reject(new Error("late error"));
  await pending;
  expect(notice.calls).toBe(0);
});
