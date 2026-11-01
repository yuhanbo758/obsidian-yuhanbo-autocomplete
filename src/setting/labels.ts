const LABELS: Record<string, string> = {
  default: "默认（英文等）",
  chinese: "中文优先（兼容英文）",
  "english-only": "仅英文",
  japanese: "日文",
  korean: "韩文",
  arabic: "阿拉伯文",
  prefix: "前缀匹配（推荐）",
  partial: "部分匹配",
  inherit: "沿用全局设置",
  Tab: "制表符",
  Comma: "逗号",
  Pipe: "竖线",
  None: "不显示",
  Short: "简短说明",
  Full: "完整说明",
  select: "确认补全",
  "select with custom alias": "使用自定义别名补全",
  "select with custom alias and add to aliases": "使用自定义别名补全并保存别名",
  "select with query alias": "以输入文字作为别名补全",
  up: "上一条建议",
  down: "下一条建议",
  open: "打开来源文件",
  completion: "补全共同前缀",
  "insert as text": "作为纯文本插入",
};
for (let i = 1; i <= 9; ++i)
  LABELS[
    `select ${i}${i === 1 ? "st" : i === 2 ? "nd" : i === 3 ? "rd" : "th"}`
  ] = `选择第 ${i} 条建议`;

export const label = (key: string): string => LABELS[key] ?? key;

export const localizedOptions = (
  values: { name: string }[],
): Record<string, string> =>
  Object.fromEntries(values.map(({ name }) => [name, label(name)]));
