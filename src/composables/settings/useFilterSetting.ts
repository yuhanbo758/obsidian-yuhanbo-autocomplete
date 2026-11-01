import { SearchComponent, type Setting, type SettingGroup } from "obsidian";

const ALWAYS_VISIBLE = () => true;
type FilterTarget = {
  element: HTMLElement;
  text: string;
  isVisible: () => boolean;
  matched: boolean;
};
type Section = {
  heading: HTMLElement;
  elements: HTMLElement[];
  targets: FilterTarget[];
};

/** 全页共用一个搜索状态；功能开关的可见性条件与关键词过滤同时生效。 */
export class SettingsSearchController {
  private targets = new Map<HTMLElement, FilterTarget>();
  private conditional = new Map<HTMLElement, () => boolean>();
  private sections: Section[] = [];
  private query = "";
  private summaryEl: HTMLElement;

  constructor(private containerEl: HTMLElement) {
    const toolbar = containerEl.createDiv({
      cls: "autocomplete-settings-search",
    });
    new SearchComponent(toolbar)
      .setPlaceholder("搜索设置名称或说明…")
      .onChange((query) => {
        this.query = query;
        this.refresh();
      });
    this.summaryEl = toolbar.createDiv({
      cls: "autocomplete-settings-search-summary",
    });
    this.summaryEl.setAttribute("role", "status");
    this.summaryEl.setAttribute("aria-live", "polite");
  }

  registerRow(element: HTMLElement, isVisible = ALWAYS_VISIBLE): void {
    const target: FilterTarget = {
      element,
      isVisible,
      matched: true,
      text: `${element.querySelector(".setting-item-name")?.textContent ?? ""} ${element.querySelector(".setting-item-description")?.textContent ?? ""}`.toLocaleLowerCase(),
    };
    this.targets.set(element, target);
    if (element.querySelector("textarea"))
      element.addClass("autocomplete-settings-multiline");
    element.toggle(isVisible());
  }

  registerConditional(element: HTMLElement, isVisible: () => boolean): void {
    this.conditional.set(element, isVisible);
    element.toggle(isVisible());
  }

  finalize(): void {
    for (const row of Array.from(
      this.containerEl.querySelectorAll<HTMLElement>(
        ".setting-item:not(.setting-item-heading)",
      ),
    )) {
      if (!this.targets.has(row)) this.registerRow(row);
    }
    let current: Section | undefined;
    for (const element of Array.from(
      this.containerEl.children,
    ) as HTMLElement[]) {
      if (element.hasClass("setting-item-heading")) {
        current = { heading: element, elements: [], targets: [] };
        this.sections.push(current);
      } else if (current) current.elements.push(element);
    }
    for (const section of this.sections) {
      section.targets = Array.from(this.targets.values()).filter((target) =>
        section.elements.some((element) => element.contains(target.element)),
      );
    }
    this.refresh();
  }

  refresh(): void {
    const terms = this.query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    let matches = 0;
    for (const target of this.targets.values()) {
      target.matched =
        target.isVisible() && terms.every((term) => target.text.includes(term));
      target.element.toggle(target.matched);
      if (target.matched) ++matches;
    }
    for (const [element, isVisible] of this.conditional)
      element.toggle(terms.length === 0 && isVisible());
    for (const section of this.sections) {
      const visible =
        terms.length === 0 || section.targets.some((target) => target.matched);
      section.heading.toggle(visible);
      for (const element of section.elements) {
        if (!this.targets.has(element) && !this.conditional.has(element))
          element.toggle(visible);
      }
    }
    this.summaryEl.setText(
      terms.length === 0
        ? "可搜索设置名称和说明，多个关键词用空格分隔。"
        : matches > 0
          ? `找到 ${matches} 项设置`
          : "未找到匹配项。部分选项需先启用对应功能。",
    );
  }
}

export const useFilterSetting = (
  group: SettingGroup,
  search: SettingsSearchController,
) => {
  const addFilterableSetting = (
    name: string,
    desc: string | DocumentFragment | null,
    build: (setting: Setting) => void,
    option?: { visible?: () => boolean },
  ) => {
    group.addSetting((setting) => {
      setting.setName(name);
      if (desc) setting.setDesc(desc);
      build(setting);
      if (setting.controlEl.querySelector("textarea")) {
        setting.descEl.createDiv({
          text: "编辑完成后离开输入框即可应用。",
          cls: "autocomplete-settings-input-hint",
        });
      }
      search.registerRow(setting.settingEl, option?.visible ?? ALWAYS_VISIBLE);
    });
  };
  return {
    addFilterableSetting,
    addConditionalElement: (element: HTMLElement, isVisible: () => boolean) =>
      search.registerConditional(element, isVisible),
    refresh: () => search.refresh(),
  };
};
