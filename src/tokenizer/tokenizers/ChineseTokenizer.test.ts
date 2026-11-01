import { describe, expect, test } from "@jest/globals";
import { ChineseTokenizer } from "./ChineseTokenizer";

describe("中文优先分词", () => {
  test("无需外部词典，保留英文并移除中文标点", () => {
    const tokens = ChineseTokenizer.create().tokenize(
      "知识管理，Obsidian plugin！",
    );
    expect(tokens).toContain("知识");
    expect(tokens).toContain("管理");
    expect(tokens).toContain("Obsidian");
    expect(tokens).not.toContain("，");
  });

  test("长行只产生需要的后缀，偏移保持 UTF-16 编辑器坐标", () => {
    const tokenizer = ChineseTokenizer.create();
    const content = "知识管理".repeat(2000) + "😀中文输入";
    const result = tokenizer.recursiveTokenize(content, 3);
    expect(result).toHaveLength(3);
    for (const { word, offset } of result)
      expect(content.slice(offset)).toBe(word);
    expect(result.at(-1)?.word).toBe("输入");
  });

  test("仍支持用户提供的 CC-CEDICT 词典", () => {
    const tokenizer = ChineseTokenizer.create(
      "知識管理 知识管理 [zhi1 shi2 guan3 li3] /knowledge management/\n",
    );
    expect(tokenizer.tokenize("知识管理 test")).toEqual(["知识管理", "test"]);
  });

  test("缺少 Intl.Segmenter 的旧 WebView 使用离线回退", () => {
    const original = Intl.Segmenter;
    try {
      Object.defineProperty(Intl, "Segmenter", {
        value: undefined,
        configurable: true,
      });
      expect(ChineseTokenizer.create().tokenize("中文 Obsidian")).toEqual([
        "中",
        "文",
        "Obsidian",
      ]);
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        value: original,
        configurable: true,
      });
    }
  });
});
