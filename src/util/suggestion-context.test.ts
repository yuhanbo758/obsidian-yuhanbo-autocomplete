import { expect, test } from "@jest/globals";
import type { EditorSuggestContext } from "obsidian";
import { sameSuggestionContext } from "./suggestion-context";

const context = {
  editor: {},
  file: {},
  query: "autoc",
  start: { line: 2, ch: 0 },
  end: { line: 2, ch: 5 },
} as EditorSuggestContext;

test("核心重建相同查询对象时，仍接受当前有效结果", () => {
  expect(
    sameSuggestionContext(context, {
      ...context,
      start: { ...context.start },
      end: { ...context.end },
    }),
  ).toBe(true);
});

test("输入、删除或光标范围变化后，不接受旧查询结果", () => {
  expect(sameSuggestionContext(context, { ...context, query: "autoco" })).toBe(
    false,
  );
  expect(
    sameSuggestionContext(context, { ...context, end: { line: 2, ch: 4 } }),
  ).toBe(false);
  expect(
    sameSuggestionContext(context, { ...context, start: { line: 2, ch: 1 } }),
  ).toBe(false);
  expect(sameSuggestionContext(context, null)).toBe(false);
});

test("切换笔记或窗口后，即使查询相同也不串用旧结果", () => {
  expect(
    sameSuggestionContext(context, {
      ...context,
      editor: {},
    } as EditorSuggestContext),
  ).toBe(false);
  expect(
    sameSuggestionContext(context, {
      ...context,
      file: {},
    } as EditorSuggestContext),
  ).toBe(false);
});
