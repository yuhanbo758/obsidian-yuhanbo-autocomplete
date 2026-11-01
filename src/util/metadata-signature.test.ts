import { expect, test } from "@jest/globals";
import type { CachedMetadata } from "obsidian";
import { metadataSignature } from "./metadata-signature";

test("正文修改导致的位置偏移不触发链接及属性索引重建", () => {
  const cache = (offset: number) =>
    ({
      frontmatter: { aliases: ["别名"], position: { start: { offset } } },
      links: [{ link: "笔记", position: { start: { offset } } }],
    }) as unknown as CachedMetadata;
  expect(metadataSignature(cache(0))).toEqual(metadataSignature(cache(100)));
});

test("别名、链接与属性的真实变化仍能使对应索引失效", () => {
  const initial = metadataSignature({ frontmatter: { aliases: ["旧别名"] } });
  const updated = metadataSignature({ frontmatter: { aliases: ["新别名"] } });
  expect(updated.frontmatter).not.toBe(initial.frontmatter);
  const linked = metadataSignature({
    links: [{ link: "新链接" }],
  } as CachedMetadata);
  expect(linked.links).not.toBe(initial.links);
  expect(metadataSignature(null)).toEqual(metadataSignature({}));
});
