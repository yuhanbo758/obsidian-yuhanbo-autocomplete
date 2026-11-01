import type { EditorSuggestContext } from "obsidian";

export function sameSuggestionContext(
  a: EditorSuggestContext,
  b: EditorSuggestContext | null,
): boolean {
  // 核心可能为同一查询重新创建对象，不能只比较 context 的引用。
  return (
    !!b &&
    a.editor === b.editor &&
    a.file === b.file &&
    a.query === b.query &&
    a.start.line === b.start.line &&
    a.start.ch === b.start.ch &&
    a.end.line === b.end.line &&
    a.end.ch === b.end.ch
  );
}
