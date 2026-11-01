import { build } from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

await mkdir("reports", { recursive: true });
const outfile = new URL(
  "../reports/benchmark.cjs",
  import.meta.url,
).pathname.replace(/^\/(.:)/, "$1");
await build({
  stdin: {
    contents:
      'export { ChineseTokenizer } from "./src/tokenizer/tokenizers/ChineseTokenizer"; export { suggestWords } from "./src/provider/suggester";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile,
});
const { ChineseTokenizer, suggestWords } = createRequire(import.meta.url)(
  outfile,
);
const tokenizer = ChineseTokenizer.create(
  "中文 中文 [zhong1 wen2] /Chinese/\n知识 知识 [zhi1 shi2] /knowledge/\n管理 管理 [guan3 li3] /manage/\n",
);
const timings = [];
for (const length of [1000, 4000, 8000]) {
  const content = "中文知识管理".repeat(Math.ceil(length / 6)).slice(0, length);
  const start = performance.now();
  const result = tokenizer.recursiveTokenize(content, 3);
  timings.push({
    length,
    milliseconds: +(performance.now() - start).toFixed(2),
    suffixes: result.length,
  });
}
const words = Array.from({ length: 20000 }, (_, i) => ({
  value: `中文${i}`,
  type: "customDictionary",
  createdPath: "fixture",
}));
const start = performance.now();
suggestWords(
  {
    currentFile: {},
    currentVault: {},
    customDictionary: { 中: words },
    internalLink: {},
    frontMatter: {},
  },
  "中",
  10,
);
const milliseconds = +(performance.now() - start).toFixed(2);
const fixture = Array.from({ length: 10 }, (_, i) => ({
  value: `中${"文".repeat(i + 1)}`,
  type: "customDictionary",
  createdPath: "fixture",
}));
const suggestions = suggestWords(
  {
    currentFile: {},
    currentVault: {},
    customDictionary: { 中: fixture },
    internalLink: {},
    frontMatter: {},
  },
  "中",
  10,
);
const result = {
  node: process.version,
  chineseSuffixes: timings,
  suggestions: {
    indexedWords: words.length,
    milliseconds,
    completenessFixture: 10,
    requested: 10,
    returned: suggestions.length,
  },
};
const name = process.argv.includes("--baseline") ? "baseline" : "optimized";
await writeFile(`reports/${name}.json`, JSON.stringify(result, null, 2) + "\n");
await rm(outfile);
console.log(JSON.stringify(result, null, 2));
