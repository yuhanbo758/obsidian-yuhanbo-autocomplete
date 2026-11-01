import { expect, test } from "@jest/globals";
import type { Word } from "../model/Word";
import type { IndexedWords } from "../ui/AutoCompleteSuggest";
import { suggestWords, suggestWordsByPartialMatch } from "./suggester";

test("中文首字桶不因大小写重复，候选数量能达到设置上限", () => {
  const words: Word[] = Array.from({ length: 10 }, (_, i) => ({
    value: "中" + "文".repeat(i + 1),
    type: "customDictionary",
    createdPath: "fixture",
  }));
  const index: IndexedWords = {
    currentFile: {},
    currentVault: {},
    customDictionary: { 中: words },
    internalLink: {},
    frontMatter: {},
  };
  expect(suggestWords(index, "中", 10)).toHaveLength(10);
});

test("同一词的多个别名不占用其他候选名额", () => {
  const word: Word = {
    value: "中文词库",
    aliases: ["中文", "词库"],
    type: "customDictionary",
    createdPath: "fixture",
  };
  const other: Word = {
    value: "中文输入",
    type: "currentFile",
    createdPath: "fixture.md",
  };
  const index: IndexedWords = {
    currentFile: { 中: [other] },
    currentVault: {},
    customDictionary: { 中: [word, word], 词: [word] },
    internalLink: {},
    frontMatter: {},
  };
  expect(
    suggestWordsByPartialMatch(index, "中", 2)
      .map((x) => x.value)
      .sort(),
  ).toEqual(["中文词库", "中文输入"].sort());
});
