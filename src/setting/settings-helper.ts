import type { TextAreaComponent, TextComponent } from "obsidian";

export namespace TextComponentEvent {
  export function onChange<T extends TextComponent | TextAreaComponent>(
    component: T,
    handler: (value: string) => void,
    option?: { className?: string },
  ): T {
    component.inputEl.addEventListener("change", async (ev) => {
      // 使用组件本身的 inputEl，兼容设置弹出窗口的 DOM realm。
      handler(component.inputEl.value);
    });
    if (option?.className) {
      component.inputEl.className = option.className;
    }
    return component;
  }
}
