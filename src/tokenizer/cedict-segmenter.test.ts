import { expect, test } from "@jest/globals";
import reference from "chinese-tokenizer";
import { ChineseTokenizer } from "./tokenizers/ChineseTokenizer";

const dictionary = [
  "知識管理 知识管理 [zhi1 shi2 guan3 li3] /knowledge management/",
  "人工智能 人工智能 [ren2 gong1 zhi4 neng2] /AI/",
  "中 中 [zhong1] /middle/",
  "國 国 [guo2] /country/",
  "中國 中国 [zhong1 guo2] /China/",
  "A A [ei1] /A/",
  "AB AB [ei1 bi1] /AB/",
  "𠀀 𠀀 [he1] /rare character/",
  "😀哈 😀哈 [ha1] /fixture/",
].join("\n");

test("与原 CEDICT 分词保持繁简、最长匹配、未知文本及 Unicode 行为一致", () => {
  const tokenize = reference.load(dictionary);
  const current = ChineseTokenizer.create(dictionary);
  const samples = [
    "知识管理 test\n人工智能",
    "ABCD aABCD 中国",
    "中，国：未知词。ABC",
    "𠀀😀哈\r\n知识管理 abc-def.md",
    "unknown".repeat(1000),
  ];
  let seed = 173;
  const parts = [
    "中国",
    "中國",
    "未知词",
    "AB",
    "x",
    " ",
    "\n",
    "𠀀",
    "😀哈",
    "，",
  ];
  for (let i = 0; i < 30; i++) {
    let text = "";
    for (let j = 0; j < 50; j++) {
      seed = (seed * 16807) % 2147483647;
      text += parts[seed % parts.length];
    }
    samples.push(text);
  }
  for (const text of samples) {
    expect(current.tokenize(text)).toEqual(
      tokenize(text)
        .map(({ text }) => text)
        .filter((text) => /[\p{L}\p{N}]/u.test(text)),
    );
  }
});

test("分批后台分词与同步结果一致", async () => {
  const current = ChineseTokenizer.create(dictionary);
  const content = "知识管理 中国 AB unknown\n".repeat(1000);
  expect(await current.tokenizeForIndex(content, async () => true)).toEqual(
    current.tokenize(content),
  );
});

test("超长未知英文串的中途仍能取消，不发布部分结果", async () => {
  const current = ChineseTokenizer.create(dictionary);
  let waits = 0;
  expect(
    await current.tokenizeForIndex(
      "x".repeat(1000000),
      async () => ++waits === 1,
    ),
  ).toBeNull();
  expect(waits).toBeGreaterThan(1);
});
