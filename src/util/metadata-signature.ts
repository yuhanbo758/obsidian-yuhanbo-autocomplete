import type { CachedMetadata } from "obsidian";

export function metadataSignature(cache: CachedMetadata | null) {
  const { position: _position, ...frontmatter } = cache?.frontmatter ?? {};
  return {
    frontmatter: JSON.stringify(frontmatter),
    // 正文长度变化会移动 position；只有链接内容变化才需要更新链接索引。
    links: JSON.stringify([
      cache?.links?.map((entry) => entry.link) ?? [],
      cache?.embeds?.map((entry) => entry.link) ?? [],
      cache?.frontmatterLinks?.map((entry) => entry.link) ?? [],
    ]),
  };
}
