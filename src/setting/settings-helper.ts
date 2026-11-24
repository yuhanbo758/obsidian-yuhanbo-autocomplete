import { Notice, type TextAreaComponent, type TextComponent } from "obsidian";

export function onTextChange<T extends TextComponent | TextAreaComponent>(
  component: T,
  handler: (value: string) => Promise<void>,
  option?: { className?: string },
): T {
  component.inputEl.addEventListener("change", () => {
    // 使用组件本身的 inputEl，兼容设置弹出窗口的 DOM realm。
    void handler(component.inputEl.value).catch(() => {
      new Notice("保存设置失败，请重试。");
    });
  });
  if (option?.className) {
    component.inputEl.className = option.className;
  }
  return component;
}
