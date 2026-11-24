import { App, Modal, Notice, setIcon, setTooltip } from "obsidian";
import { AppHelper } from "../app-helper";
import type { CustomDictionaryWord } from "../model/Word";

export class CustomDictionaryWordAddModal extends Modal {
  constructor(
    app: App,
    private readonly dictionaryPaths: string[],
    private readonly initialValue: string,
    private readonly dividerForDisplay: string,
    private readonly onSubmit: (
      path: string,
      word: CustomDictionaryWord,
    ) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("添加到自定义词库");
    const form = this.contentEl.createDiv("autocomplete-dictionary-modal");
    form.createEl("h3", { text: "词库" });
    const row = form.createDiv("autocomplete-dictionary-row");
    const dictionary = row.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": "词库" },
    });
    for (const path of this.dictionaryPaths) {
      dictionary.createEl("option", { text: path, value: path });
    }
    const open = row.createEl("button", {
      cls: "clickable-icon",
      type: "button",
      attr: { "aria-label": "打开词库文件" },
    });
    setIcon(open, "file");
    setTooltip(open, "打开词库文件");
    open.onclick = () => {
      const helper = new AppHelper(this.app);
      const file = helper.getMarkdownFileByPath(dictionary.value);
      if (!file) {
        new Notice(`无法打开：${dictionary.value}`);
        return;
      }
      this.close();
      helper.openMarkdownFile(file, true);
    };

    const wordTitle = form.createEl("h3", { text: "词语" });
    const input = this.createTextArea(form, "词语");
    input.value = this.initialValue;

    const displaySection = form.createDiv();
    displaySection.hidden = true;
    displaySection.createEl("h3", { text: "显示文字" });
    const displayWord = this.createTextArea(displaySection, "显示文字");
    if (this.dividerForDisplay) {
      const label = form.createEl("label");
      form.insertBefore(label, displaySection);
      const split = label.createEl("input", { type: "checkbox" });
      label.appendText("分别指定显示文字和插入内容");
      split.onchange = () => {
        displaySection.hidden = !split.checked;
        const title = split.checked ? "插入内容" : "词语";
        wordTitle.setText(title);
        input.setAttribute("aria-label", title);
        if (split.checked) displayWord.focus();
      };
    }

    form.createEl("h3", { text: "说明" });
    const description = form.createEl("input", {
      cls: "autocomplete-dictionary-input",
      type: "text",
      attr: { "aria-label": "说明" },
    });
    form.createEl("h3", { text: "别名（每行一个）" });
    const aliases = this.createTextArea(form, "别名（每行一个）");
    const submit = form
      .createDiv("autocomplete-dictionary-actions")
      .createEl("button", { text: "添加", type: "button" });

    let saving = false;
    const refresh = () => {
      open.disabled = !dictionary.value;
      submit.disabled = saving || !input.value || !dictionary.value;
      submit.toggleClass("mod-cta", !submit.disabled);
    };
    dictionary.onchange = refresh;
    input.oninput = refresh;
    submit.onclick = () => {
      if (submit.disabled) return;
      const path = dictionary.value;
      const displayed = displaySection.hidden ? "" : displayWord.value;
      saving = true;
      refresh();
      void this.onSubmit(path, {
        value: displayed || input.value,
        description: description.value,
        aliases: aliases.value.split("\n"),
        type: "customDictionary",
        createdPath: path,
        insertedText: displayed ? input.value : undefined,
      })
        .catch(() => new Notice("词库写入失败，请检查文件是否可编辑。"))
        .finally(() => {
          saving = false;
          refresh();
        });
    };
    refresh();
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private createTextArea(
    parent: HTMLElement,
    label: string,
  ): HTMLTextAreaElement {
    return parent.createEl("textarea", {
      cls: "autocomplete-dictionary-input",
      attr: { rows: 3, "aria-label": label },
    });
  }
}
