export interface TextSegment {
  text: string;
  offset: number;
}

interface Node {
  children: Map<string, Node>;
  terminal?: boolean;
}

const punctuation = new Set(
  Array.from("·×—‘’“”…、。《》『』【】！（），：；？"),
);
const characterAt = (text: string, offset: number) => {
  const code = text.charCodeAt(offset);
  const next = text.charCodeAt(offset + 1);
  return code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
    ? text.slice(offset, offset + 2)
    : text[offset];
};

/** 只建立补全使用的文本索引，不构造拼音、释义等会被调用方丢弃的元数据。 */
export class CedictSegmenter {
  private root: Node = { children: new Map() };
  private singleCharacters = new Set(punctuation);

  constructor(dictionary: string) {
    for (const line of dictionary.split("\n")) {
      if (line.trim() === "" || line[0] === "#") continue;
      const match = line.match(/^(\S+)\s(\S+)\s\[([^\]]+)\]\s\/(.+)\//);
      if (!match) continue;
      for (const word of [match[1], match[2]]) {
        let node = this.root;
        const characters = Array.from(word);
        if (characters.length === 1) this.singleCharacters.add(word);
        for (const character of characters) {
          let child = node.children.get(character);
          if (!child) {
            child = { children: new Map() };
            node.children.set(character, child);
          }
          node = child;
        }
        node.terminal = true;
      }
    }
  }

  *segments(content: string): Generator<TextSegment | null> {
    // 保留原分词器去除 CR、最长匹配、未知字符连续成词的行为。
    const text = content.replace(/\r/g, "");
    let offset = 0;
    let work = 0;
    while (offset < text.length) {
      let node = this.root;
      let end = offset;
      let longest = offset;
      let characters = 0;
      while (end < text.length) {
        const character = characterAt(text, end);
        const child = node.children.get(character);
        if (!child) break;
        node = child;
        end += character.length;
        characters++;
        if (node.terminal && characters > 1) longest = end;
        if (++work % 256 === 0) yield null;
      }
      if (longest === offset) {
        const character = characterAt(text, offset);
        end = offset + character.length;
        if (!this.singleCharacters.has(character) && !/\s/.test(character)) {
          while (end < text.length) {
            const next = characterAt(text, end);
            if (this.singleCharacters.has(next) || /\s/.test(next)) break;
            end += next.length;
            // 超长英文串也提供暂停点，不在一次 next() 中扫描完整个大文件。
            if (++work % 256 === 0) yield null;
          }
        }
      } else end = longest;
      yield { text: text.slice(offset, end), offset };
      offset = end;
    }
  }
}
