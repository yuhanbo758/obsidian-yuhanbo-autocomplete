import { yieldToMainThread } from "../../util/yield-main-thread";
import { CedictSegmenter, type TextSegment } from "../cedict-segmenter";
import { AbstractTokenizer } from "./AbstractTokenizer";

export class ChineseTokenizer extends AbstractTokenizer {
  private segments: (content: string) => Iterable<TextSegment | null>;
  readonly indexingMetrics = { runs: 0, yields: 0, maxBatchMilliseconds: 0 };

  static create(dict?: string): ChineseTokenizer {
    const ins = new ChineseTokenizer();
    if (dict) {
      const segmenter = new CedictSegmenter(dict);
      ins.segments = (content) => segmenter.segments(content);
    } else {
      // 默认使用系统中文分词，无需下载大词典；旧 WebView 仍可按汉字和英文词回退。
      const segmenter =
        typeof Intl.Segmenter === "function"
          ? new Intl.Segmenter("zh-CN", { granularity: "word" })
          : undefined;
      ins.segments = function* (content) {
        if (segmenter) {
          for (const { segment: text, index: offset } of segmenter.segment(
            content,
          ))
            yield { text, offset };
        } else {
          for (const match of content.matchAll(
            /[\u3400-\u9fff]|[a-zA-Z0-9_-]+|[^\u3400-\u9fffa-zA-Z0-9_-]/gu,
          ))
            yield { text: match[0], offset: match.index! };
        }
      };
    }
    return ins;
  }

  tokenize(content: string, _raw?: boolean): string[] {
    const tokens: string[] = [];
    for (const segment of this.segments(content)) {
      if (segment && /[\p{L}\p{N}]/u.test(segment.text))
        tokens.push(segment.text);
    }
    return tokens;
  }

  async tokenizeForIndex(
    content: string,
    waitForIdle: () => Promise<boolean>,
  ): Promise<string[] | null> {
    if (!(await waitForIdle())) return null;
    this.indexingMetrics.runs++;
    const tokens: string[] = [];
    let batchStart = performance.now();
    let deadline = batchStart + 4;
    let count = 0;
    for (const segment of this.segments(content)) {
      if (segment && /[\p{L}\p{N}]/u.test(segment.text))
        tokens.push(segment.text);
      if (++count % 128 === 0 && performance.now() >= deadline) {
        this.indexingMetrics.maxBatchMilliseconds = Math.max(
          this.indexingMetrics.maxBatchMilliseconds,
          performance.now() - batchStart,
        );
        this.indexingMetrics.yields++;
        await yieldToMainThread();
        if (!(await waitForIdle())) return null;
        batchStart = performance.now();
        deadline = batchStart + 4;
      }
    }
    this.indexingMetrics.maxBatchMilliseconds = Math.max(
      this.indexingMetrics.maxBatchMilliseconds,
      performance.now() - batchStart,
    );
    return tokens;
  }

  recursiveTokenize(
    content: string,
    maxTokens = Infinity,
  ): { word: string; offset: number }[] {
    // 只生成调用方需要的末尾候选，避免长中文行重复 slice/join 造成平方级分配。
    return Array.from(this.segments(content))
      .filter((segment): segment is TextSegment => segment !== null)
      .filter(({ text, offset }) => offset === 0 || /[\p{L}\p{N}]/u.test(text))
      .slice(-Math.max(1, maxTokens))
      .map(({ offset }) => ({ word: content.slice(offset), offset }));
  }
}
