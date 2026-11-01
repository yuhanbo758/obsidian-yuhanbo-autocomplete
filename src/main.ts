import { debounce, normalizePath, Notice, Plugin } from "obsidian";
import { merge } from "ts-deepmerge";
import { AppHelper } from "./app-helper";
import {
  DEFAULT_SETTINGS,
  type Settings,
  VariousComplementsSettingTab,
} from "./setting/settings";
import { AutoCompleteSuggest } from "./ui/AutoCompleteSuggest";
import { CustomDictionaryWordAddModal } from "./ui/CustomDictionaryWordAddModal";
import { ProviderStatusBar } from "./ui/ProviderStatusBar";
import { EditorInputActivity } from "./util/editor-input-activity";

export default class AutocompletePlugin extends Plugin {
  appHelper: AppHelper;
  settings: Settings;
  settingTab: VariousComplementsSettingTab;
  suggester: AutoCompleteSuggest;
  statusBar?: ProviderStatusBar;
  private inputActivity = new EditorInputActivity();

  onunload() {
    super.onunload();
    this.inputActivity.dispose();
    this.suggester?.unregister();
  }

  async onload() {
    this.appHelper = new AppHelper(this.app);

    await this.loadSettings();
    this.settingTab = new VariousComplementsSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    if (this.appHelper.isMobile() && this.settings.disableOnMobile) {
      // End
      return;
    }

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        if (!this.appHelper.getSelection()) {
          return;
        }

        menu.addItem((item) =>
          item
            .setTitle("添加到自定义词库")
            .setIcon("stacked-levels")
            .onClick(() => {
              this.addWordToCustomDictionary();
            }),
        );
      }),
    );

    this.statusBar = ProviderStatusBar.new(
      this.addStatusBarItem(),
      this.settings.showMatchStrategy,
      this.settings.showIndexingStatus,
      this.settings.showComplementAutomatically,
    );
    this.statusBar.setOnClickStrategyListener(async () => {
      await this.settingTab.toggleMatchStrategy();
    });
    this.statusBar.setOnClickComplementAutomatically(async () => {
      await this.settingTab.toggleComplementAutomatically();
    });

    const debouncedSaveData = debounce(async () => {
      const storage = this.suggester?.selectionHistoryStorage;
      if (!storage?.shouldPersist) return;
      const version = storage.version;
      try {
        await this.appHelper.saveJson(
          normalizePath(
            this.settings.intelligentSuggestionPrioritization.historyFilePath ||
              this.defaultHistoryPath,
          ),
          storage.data,
          this.settings.intelligentSuggestionPrioritization
            .prettyPrintHistoryFile
            ? 2
            : undefined,
        );
        storage.syncPersistVersion(version);
      } catch {
        new Notice("补全历史保存失败，将在后续笔记修改时重试。");
      }
    }, 5000);

    this.trackEditorInput();
    this.suggester = await AutoCompleteSuggest.new(
      this.app,
      this.settings,
      this.statusBar,
      debouncedSaveData,
      (ref) => this.registerEvent(ref),
      this.defaultHistoryPath,
      this.inputActivity,
    );
    this.register(() => debouncedSaveData.cancel());
    this.registerEditorSuggest(this.suggester);

    this.addCommand({
      id: "reload-custom-dictionaries",
      name: "重新加载词库",
      callback: async () => {
        await this.suggester.refreshCustomDictionaryTokens();
      },
    });

    this.addCommand({
      id: "reload-current-vault",
      name: "重新建立全库词语索引",
      callback: async () => {
        await this.suggester.refreshCurrentVaultTokens();
      },
    });

    this.addCommand({
      id: "toggle-match-strategy",
      name: "切换匹配策略",
      callback: async () => {
        await this.settingTab.toggleMatchStrategy();
      },
    });

    this.addCommand({
      id: "toggle-complement-automatically",
      name: "切换自动补全",
      callback: async () => {
        await this.settingTab.toggleComplementAutomatically();
      },
    });

    this.addCommand({
      id: "show-suggestions",
      name: "显示补全建议",
      callback: async () => {
        this.suggester.triggerComplete();
      },
    });

    this.addCommand({
      id: "hide-suggestions",
      name: "隐藏补全建议",
      callback: async () => {
        this.suggester.hideCompletion();
      },
    });

    this.addCommand({
      id: "fallback-linkify",
      name: "将输入转换为链接",
      callback: async () => {
        this.suggester.triggerComplete({ fallbackLinkify: true });
      },
    });

    this.addCommand({
      id: "add-word-custom-dictionary",
      name: "添加词语到自定义词库",
      callback: async () => {
        this.addWordToCustomDictionary();
      },
    });

    this.addCommand({
      id: "predictable-complements",
      name: "循环补全附近词语",
      callback: async () => {
        this.suggester.predictableComplete();
      },
    });

    this.addCommand({
      id: "copy-plugin-settings",
      name: "复制插件设置",
      callback: async () => {
        await navigator.clipboard.writeText(
          this.settingTab.getPluginSettingsAsJsonString(),
        );
        // noinspection ObjectAllocationIgnored
        new Notice("已复制插件设置");
      },
    });
  }

  private trackEditorInput(): void {
    const documents = new WeakSet<Document>();
    const attach = (doc: Document) => {
      if (documents.has(doc)) return;
      documents.add(doc);
      const contentFor = (event: Event) => {
        // 弹出窗口属于不同 realm，不能用主窗口的 instanceof 判断事件目标。
        const target = event.target as Element | null;
        return typeof target?.closest === "function"
          ? target.closest(".markdown-source-view .cm-content")
          : null;
      };
      const composing = (event: Event) => {
        const content = contentFor(event);
        if (!content) return;
        if (event.type === "compositionstart") {
          this.inputActivity.startComposition(content);
          this.suggester?.pauseForComposition();
        } else if (this.inputActivity.observeComposingInput(content)) {
          this.suggester?.pauseForComposition();
        }
      };
      this.registerDomEvent(doc, "compositionstart", composing, true);
      this.registerDomEvent(doc, "compositionupdate", composing, true);
      this.registerDomEvent(
        doc,
        "compositionend",
        (event) => {
          const content = contentFor(event);
          if (!content) return;
          this.inputActivity.endComposition(content);
          this.suggester?.resumeAfterComposition();
        },
        true,
      );
      this.registerDomEvent(
        doc,
        "beforeinput",
        (event) => {
          if (!contentFor(event)) return;
          this.inputActivity.markInput();
          if (event.isComposing) composing(event);
        },
        true,
      );
      this.registerDomEvent(
        doc,
        "input",
        (event) => {
          const content = contentFor(event);
          if (!content) return;
          this.inputActivity.markInput();
          const isComposing = (event as InputEvent).isComposing === true;
          if (!isComposing) this.inputActivity.endComposition(content);
          if (!isComposing || this.inputActivity.hasEndedComposition(content))
            this.suggester?.resumeAfterComposition();
        },
        true,
      );
      this.registerDomEvent(
        doc,
        "keydown",
        (event) => {
          if (contentFor(event)) this.inputActivity.markInput();
        },
        true,
      );
      this.registerDomEvent(
        doc,
        "focusout",
        (event) => {
          const content = contentFor(event);
          if (content) this.inputActivity.endComposition(content);
        },
        true,
      );
      if (doc.defaultView)
        this.registerDomEvent(doc.defaultView, "blur", () =>
          this.inputActivity.endComposition(),
        );
    };
    attach(document);
    this.app.workspace.iterateAllLeaves((leaf) =>
      attach(leaf.view.containerEl.ownerDocument),
    );
    this.registerEvent(
      this.app.workspace.on("window-open", (_win, window) =>
        attach(window.document),
      ),
    );
  }

  get defaultHistoryPath(): string {
    // 安装目录由用户指定，不能用插件 ID 推导实际文件路径。
    const directory =
      this.manifest.dir ??
      `${this.app.vault.configDir}/plugins/obsidian-yuhanbo-autocomplete`;
    return normalizePath(`${directory}/histories.json`);
  }

  async loadSettings(): Promise<void> {
    const currentSettings = (await this.loadData()) as Settings;
    this.settings = merge.withOptions(
      { mergeArrays: false },
      DEFAULT_SETTINGS,
      currentSettings ?? {},
    );
  }

  async saveSettings(
    needUpdateTokens: {
      currentFile?: boolean;
      currentVault?: boolean;
      customDictionary?: boolean;
      internalLink?: boolean;
      frontMatter?: boolean;
      intelligentSuggestionPrioritization?: boolean;
    } = {},
  ): Promise<void> {
    await this.saveData(this.settings);
    if (!this.suggester) return;
    await this.suggester.updateSettings(this.settings);
    if (needUpdateTokens.currentFile) {
      await this.suggester.refreshCurrentFileTokens();
    }
    if (needUpdateTokens.currentVault) {
      await this.suggester.refreshCurrentVaultTokens();
    }
    if (needUpdateTokens.customDictionary) {
      await this.suggester.refreshCustomDictionaryTokens();
    }
    if (needUpdateTokens.internalLink) {
      this.suggester.refreshInternalLinkTokens();
    }
    if (needUpdateTokens.frontMatter) {
      this.suggester.refreshFrontMatterTokens();
    }
    if (needUpdateTokens.intelligentSuggestionPrioritization) {
      await this.suggester.refreshIntelligentSuggestionPrioritization();
    }
  }

  addWordToCustomDictionary() {
    const selectedWord = this.appHelper.getSelection();
    const provider = this.suggester.customDictionaryWordProvider;
    if (provider.editablePaths.length === 0) {
      new Notice(
        "请先在设置中启用自定义词库，并填写库内可编辑的文本词库路径。",
      );
      return;
    }
    const modal = new CustomDictionaryWordAddModal(
      this.app,
      provider.editablePaths,
      selectedWord,
      this.settings.delimiterToDivideSuggestionsForDisplayFromInsertion,
      async (dictionaryPath, _word) => {
        // TODO: If support for JSON, this implementation doesn't work correctly
        const word = {
          ..._word,
          caretSymbol: this.settings.caretLocationSymbolAfterComplement,
        };

        if (provider.wordByValue[word.value]) {
          // noinspection ObjectAllocationIgnored
          new Notice(`词语已存在：${word.value}`, 0);
          return;
        }

        await provider.addWordWithDictionary(word, dictionaryPath, {
          emoji: this.settings.matchingWithoutEmoji,
          accentsDiacritics:
            this.settings.treatAccentDiacriticsAsAlphabeticCharacters,
        });
        // noinspection ObjectAllocationIgnored
        new Notice(`已添加：${word.value}`);
        modal.close();
      },
    );

    modal.open();
  }
}
