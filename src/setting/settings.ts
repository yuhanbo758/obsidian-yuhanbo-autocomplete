import { App, Notice, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import {
  SettingsSearchController,
  useFilterSetting,
} from "../composables/settings/useFilterSetting";
import type { Hotkey } from "../keys";
import { hotkey2String, string2Hotkey } from "../keys";
import type VariousComponents from "../main";
import { ColumnDelimiter } from "../option/ColumnDelimiter";
import { DescriptionOnSuggestion } from "../option/DescriptionOnSuggestion";
import { MatchStrategy } from "../provider/MatchStrategy";
import { SpecificMatchStrategy } from "../provider/SpecificMatchStrategy";
import { TokenizeStrategy } from "../tokenizer/TokenizeStrategy";
import { isPresent } from "../types";
import { smartLineBreakSplit } from "../util/strings";
import { label, localizedOptions } from "./labels";
import { TextComponentEvent } from "./settings-helper";

export interface Settings {
  // general
  enableBuiltinDictionary: boolean;
  strategy: string;
  cedictPath: string;
  matchStrategy: string;
  fuzzyMatch: boolean;
  minFuzzyMatchScore: number;
  matchingWithoutEmoji: boolean;
  treatAccentDiacriticsAsAlphabeticCharacters: boolean;
  treatUnderscoreAsPartOfWord: boolean;
  maxNumberOfSuggestions: number;
  maxNumberOfWordsAsPhrase: number;
  minNumberOfCharactersTriggered: number;
  minNumberOfWordsTriggeredPhrase: number;
  complementAutomatically: boolean;
  delayMilliSeconds: number;
  disableSuggestionsDuringImeOn: boolean;
  disableSuggestionsInMathBlock: boolean;
  disableSuggestionsInCodeBlock: boolean;
  // XXX: Want to rename at next major version up
  insertSpaceAfterCompletion: boolean;
  firstCharactersDisableSuggestions: string;
  patternsToSuppressTrigger: string[];
  phrasePatternsToSuppressTrigger: string[];
  noAutoFocusUntilCycle: boolean;

  // appearance
  showMatchStrategy: boolean;
  showComplementAutomatically: boolean;
  showIndexingStatus: boolean;
  descriptionOnSuggestion: string;

  // key customization
  hotkeys: {
    select: Hotkey[];
    "select with custom alias": Hotkey[];
    "select with custom alias and add to aliases": Hotkey[];
    "select with query alias": Hotkey[];
    up: Hotkey[];
    down: Hotkey[];
    "select 1st": Hotkey[];
    "select 2nd": Hotkey[];
    "select 3rd": Hotkey[];
    "select 4th": Hotkey[];
    "select 5th": Hotkey[];
    "select 6th": Hotkey[];
    "select 7th": Hotkey[];
    "select 8th": Hotkey[];
    "select 9th": Hotkey[];
    open: Hotkey[];
    completion: Hotkey[];
    "insert as text": Hotkey[];
  };
  propagateEsc: boolean;

  // current file complement
  enableCurrentFileComplement: boolean;
  currentFileMinNumberOfCharacters: number;
  onlyComplementEnglishOnCurrentFileComplement: boolean;
  excludeCurrentFileWordPatterns: string[];

  // current vault complement
  enableCurrentVaultComplement: boolean;
  currentVaultMinNumberOfCharacters: number;
  includeCurrentVaultPathPrefixPatterns: string;
  excludeCurrentVaultPathPrefixPatterns: string;
  excludeCurrentVaultPathGlobPatterns: string[];
  includeCurrentVaultOnlyFilesUnderCurrentDirectory: boolean;
  excludeCurrentVaultWordPatterns: string[];

  // custom dictionary complement
  enableCustomDictionaryComplement: boolean;
  customDictionaryPaths: string;
  columnDelimiter: string;
  customDictionaryWordRegexPattern: string;
  delimiterToHideSuggestion: string;
  delimiterToDivideSuggestionsForDisplayFromInsertion: string;
  caretLocationSymbolAfterComplement: string;
  displayedTextSuffix: string;

  // internal link complement
  enableInternalLinkComplement: boolean;
  suggestInternalLinkWithAlias: boolean;
  preserveFirstLetterCaseOnInternalLink: boolean;
  excludeInternalLinkPathPrefixPatterns: string;
  excludeInternalLinkPathGlobPatterns: string[];
  excludeSelfInternalLink: boolean;
  excludeExistingInActiveFileInternalLinks: boolean;
  excludeUnresolvedInternalLinks: boolean;
  excludeInternalLinksInCode: boolean;

  updateInternalLinksOnSave: boolean;
  insertAliasTransformedFromDisplayedInternalLink: {
    enabled: boolean;
    beforeRegExp: string;
    after: string;
  };
  frontMatterKeyForExclusionInternalLink: string;
  tagsForExclusionInternalLink: string[];

  // front matter complement
  enableFrontMatterComplement: boolean;
  frontMatterComplementMatchStrategy: string;
  insertCommaAfterFrontMatterCompletion: boolean;

  // provider-specific trigger settings
  currentFileMinNumberOfCharactersForTrigger: number;
  currentVaultMinNumberOfCharactersForTrigger: number;
  customDictionaryMinNumberOfCharactersForTrigger: number;
  internalLinkMinNumberOfCharactersForTrigger: number;

  intelligentSuggestionPrioritization: {
    enabled: boolean;
    historyFilePath: string;
    prettyPrintHistoryFile: boolean;
    // If set 0, it will never remove
    maxDaysToKeepHistory: number;
    // If set 0, it will never remove
    maxNumberOfHistoryToKeep: number;
  };

  // mobile
  disableOnMobile: boolean;

  // debug
  showLogAboutPerformanceInConsole: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  // general
  enableBuiltinDictionary: true,
  strategy: "chinese",
  cedictPath: "",
  matchStrategy: "prefix",
  fuzzyMatch: false,
  minFuzzyMatchScore: 0.5,
  matchingWithoutEmoji: true,
  treatAccentDiacriticsAsAlphabeticCharacters: false,
  treatUnderscoreAsPartOfWord: false,

  maxNumberOfSuggestions: 8,
  maxNumberOfWordsAsPhrase: 3,
  minNumberOfCharactersTriggered: 0,
  minNumberOfWordsTriggeredPhrase: 1,
  complementAutomatically: true,
  delayMilliSeconds: 100,
  disableSuggestionsDuringImeOn: true,
  disableSuggestionsInMathBlock: false,
  disableSuggestionsInCodeBlock: false,
  insertSpaceAfterCompletion: false,
  firstCharactersDisableSuggestions: ":/^",
  patternsToSuppressTrigger: ["^~~~.*", "^```.*"],
  phrasePatternsToSuppressTrigger: [],
  noAutoFocusUntilCycle: false,

  // appearance
  showMatchStrategy: false,
  showComplementAutomatically: false,
  showIndexingStatus: false,
  descriptionOnSuggestion: "Short",

  // key customization
  hotkeys: {
    select: [{ modifiers: [], key: "Enter" }],
    "select with custom alias": [],
    "select with custom alias and add to aliases": [],
    "select with query alias": [],
    up: [{ modifiers: [], key: "ArrowUp" }],
    down: [{ modifiers: [], key: "ArrowDown" }],
    "select 1st": [],
    "select 2nd": [],
    "select 3rd": [],
    "select 4th": [],
    "select 5th": [],
    "select 6th": [],
    "select 7th": [],
    "select 8th": [],
    "select 9th": [],
    open: [],
    completion: [],
    "insert as text": [],
  },
  propagateEsc: false,

  // current file complement
  enableCurrentFileComplement: true,
  currentFileMinNumberOfCharacters: 0,
  onlyComplementEnglishOnCurrentFileComplement: false,
  excludeCurrentFileWordPatterns: [],

  // current vault complement
  enableCurrentVaultComplement: false,
  currentVaultMinNumberOfCharacters: 0,
  includeCurrentVaultPathPrefixPatterns: "",
  excludeCurrentVaultPathPrefixPatterns: "",
  excludeCurrentVaultPathGlobPatterns: [],
  includeCurrentVaultOnlyFilesUnderCurrentDirectory: false,
  excludeCurrentVaultWordPatterns: [],

  // custom dictionary complement
  enableCustomDictionaryComplement: false,
  customDictionaryPaths: "",
  columnDelimiter: "Tab",
  customDictionaryWordRegexPattern: "",
  delimiterToHideSuggestion: "",
  delimiterToDivideSuggestionsForDisplayFromInsertion: "",
  caretLocationSymbolAfterComplement: "",
  displayedTextSuffix: " => ...",

  // internal link complement
  enableInternalLinkComplement: true,
  suggestInternalLinkWithAlias: false,
  preserveFirstLetterCaseOnInternalLink: false,
  excludeInternalLinkPathPrefixPatterns: "",
  excludeInternalLinkPathGlobPatterns: [],
  excludeSelfInternalLink: false,
  excludeExistingInActiveFileInternalLinks: false,
  excludeUnresolvedInternalLinks: false,
  excludeInternalLinksInCode: false,
  updateInternalLinksOnSave: true,
  insertAliasTransformedFromDisplayedInternalLink: {
    enabled: false,
    beforeRegExp: "",
    after: "",
  },
  frontMatterKeyForExclusionInternalLink: "",
  tagsForExclusionInternalLink: [],

  // front matter complement
  enableFrontMatterComplement: false,
  frontMatterComplementMatchStrategy: "inherit",
  insertCommaAfterFrontMatterCompletion: false,

  // provider-specific trigger settings
  currentFileMinNumberOfCharactersForTrigger: 0,
  currentVaultMinNumberOfCharactersForTrigger: 0,
  customDictionaryMinNumberOfCharactersForTrigger: 0,
  internalLinkMinNumberOfCharactersForTrigger: 0,

  intelligentSuggestionPrioritization: {
    enabled: true,
    historyFilePath: "",
    prettyPrintHistoryFile: false,
    maxDaysToKeepHistory: 30,
    maxNumberOfHistoryToKeep: 0,
  },

  // mobile
  disableOnMobile: false,

  // debug
  showLogAboutPerformanceInConsole: false,
};

export class VariousComplementsSettingTab extends PluginSettingTab {
  app: App;
  plugin: VariousComponents;
  private search: SettingsSearchController;

  constructor(app: App, plugin: VariousComponents) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass("yuhanbo-autocomplete-settings");
    this.search = new SettingsSearchController(containerEl);

    this.addMainSettings(containerEl);
    this.addAppearanceSettings(containerEl);
    this.addKeyCustomizationSettings(containerEl);
    this.addCurrentFileComplementSettings(containerEl);
    this.addCurrentVaultComplementSettings(containerEl);
    this.addCustomDictionaryComplementSettings(containerEl);
    this.addInternalLinkComplementSettings(containerEl);
    this.addFrontMatterComplementSettings(containerEl);
    this.addIntelligentSuggestionPrioritizationSettings(containerEl);
    this.addMobileSettings(containerEl);
    this.addDebugSettings(containerEl);
    this.search.finalize();
  }

  private addMainSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("常规").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, addConditionalElement, refresh } =
      useFilterSetting(group, this.search);

    const usesChineseStrategy = () =>
      this.plugin.settings.strategy === TokenizeStrategy.CHINESE.name;

    addFilterableSetting(
      "内置中英文词库",
      "随插件提供常用中文词语与少量英文技术词；关闭后仍可使用笔记和自定义词库。",
      (setting) => {
        setting.addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.enableBuiltinDictionary)
            .onChange(async (value) => {
              this.plugin.settings.enableBuiltinDictionary = value;
              await this.plugin.saveSettings({ customDictionary: true });
            }),
        );
      },
    );
    addFilterableSetting("分词策略", null, (setting) => {
      setting.addDropdown((tc) =>
        tc
          .addOptions(localizedOptions(TokenizeStrategy.values()))
          .setValue(this.plugin.settings.strategy)
          .onChange(async (value) => {
            this.plugin.settings.strategy = value;
            refresh();
            void refreshCedictWarning();
            await this.plugin.saveSettings({
              currentFile: true,
              currentVault: true,
            });
          }),
      );
    });

    const cedictDesc = document.createDocumentFragment();
    cedictDesc.append(
      createSpan({
        text: "可选：自定义 CC-CEDICT 中文分词词典路径；留空使用内置分词。词典可从",
      }),
      createEl("a", {
        href: "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
        text: " 官方网站下载 ",
      }),
    );

    addFilterableSetting(
      "CC-CEDICT 词典路径（可选）",
      cedictDesc,
      (setting) => {
        setting
          .setClass("yuhanbo-autocomplete-settings__nested")
          .addText((cb) => {
            TextComponentEvent.onChange(cb, async (value) => {
              this.plugin.settings.cedictPath = value;
              void refreshCedictWarning();
              await this.plugin.saveSettings({
                currentFile: true,
                currentVault: true,
              });
            }).setValue(this.plugin.settings.cedictPath);
          });
      },
      { visible: usesChineseStrategy },
    );

    let cedictExists = true;
    let latestCedictCheckId = 0;
    const cedictWarningEl = containerEl.createEl("div", {
      cls: "yuhanbo-autocomplete-settings__warning",
    });
    addConditionalElement(
      cedictWarningEl,
      () => usesChineseStrategy() && !cedictExists,
    );

    const refreshCedictWarning = async () => {
      if (!usesChineseStrategy()) {
        refresh();
        return;
      }

      const checkId = ++latestCedictCheckId;
      const path = this.plugin.settings.cedictPath;
      if (!path.trim()) {
        cedictExists = true;
        refresh();
        return;
      }
      // Regards an I/O failure as existing so as not to show a wrong warning
      const exists = await this.app.vault.adapter
        .exists(path)
        .catch(() => true);
      if (checkId !== latestCedictCheckId) {
        // A newer check has started
        return;
      }

      cedictExists = exists;
      cedictWarningEl.setText(`未找到 ${path}，将回退到内置中文分词。`);
      refresh();
    };
    void refreshCedictWarning();

    addFilterableSetting("匹配策略", null, (setting) => {
      setting.addDropdown((tc) =>
        tc
          .addOptions(localizedOptions(MatchStrategy.values()))
          .setValue(this.plugin.settings.matchStrategy)
          .onChange(async (value) => {
            this.plugin.settings.matchStrategy = value;
            refresh();
            await this.plugin.saveSettings();
          }),
      );
    });
    addConditionalElement(
      containerEl.createEl("div", {
        text: "部分匹配需要扫描更多词语；大型词库建议使用前缀匹配。",
        cls: "yuhanbo-autocomplete-settings__warning",
      }),
      () => this.plugin.settings.matchStrategy === MatchStrategy.PARTIAL.name,
    );

    addFilterableSetting("模糊匹配", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.fuzzyMatch).onChange(async (value) => {
          this.plugin.settings.fuzzyMatch = value;
          await this.plugin.saveSettings();
        });
      });
    });

    addFilterableSetting(
      "模糊匹配最低分数",
      "只显示匹配分数高于此值的建议。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 5.0, 0.1)
            .setValue(this.plugin.settings.minFuzzyMatchScore)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.minFuzzyMatchScore = value;
              await this.plugin.saveSettings();
            }),
        );
      },
    );

    addFilterableSetting(
      "忽略字母重音符号",
      "开启后，aaa 也能匹配 áäā。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.treatAccentDiacriticsAsAlphabeticCharacters,
          ).onChange(async (value) => {
            this.plugin.settings.treatAccentDiacriticsAsAlphabeticCharacters =
              value;
            await this.plugin.saveSettings({
              internalLink: true,
              customDictionary: true,
              currentVault: true,
              currentFile: true,
            });
          });
        });
      },
    );

    addFilterableSetting(
      "将下划线视为单词的一部分",
      "开启后，aaa_bbb 作为一个词处理，不拆分为 aaa 和 bbb。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.treatUnderscoreAsPartOfWord,
          ).onChange(async (value) => {
            this.plugin.settings.treatUnderscoreAsPartOfWord = value;
            await this.plugin.saveSettings({
              internalLink: true,
              customDictionary: true,
              currentVault: true,
              currentFile: true,
            });
          });
        });
      },
      {
        visible: () =>
          TokenizeStrategy.fromName(this.plugin.settings.strategy)
            .canTreatUnderscoreAsPartOfWord,
      },
    );

    addFilterableSetting(
      "匹配时忽略表情符号",
      "开启后，aaa 也能匹配 😀aaa。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.matchingWithoutEmoji).onChange(
            async (value) => {
              this.plugin.settings.matchingWithoutEmoji = value;
              await this.plugin.saveSettings({
                internalLink: true,
                customDictionary: true,
                currentVault: true,
                currentFile: true,
              });
            },
          );
        });
      },
    );

    addFilterableSetting("最多显示建议数", null, (setting) => {
      setting.addSlider((sc) =>
        sc
          .setLimits(1, 255, 1)
          .setValue(this.plugin.settings.maxNumberOfSuggestions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxNumberOfSuggestions = value;
            await this.plugin.saveSettings();
          }),
      );
    });

    addFilterableSetting(
      "短语最多包含词数",
      "词数越多，需要匹配的短语越多；建议保持较小值。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(1, 10, 1)
            .setValue(this.plugin.settings.maxNumberOfWordsAsPhrase)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.maxNumberOfWordsAsPhrase = value;
              await this.plugin.saveSettings();
            }),
        );
      },
    );

    addFilterableSetting(
      "触发补全的最少字符数",
      "设为 0 时使用所选分词策略的默认阈值；中文默认为 1 个字符，英文默认为 3 个字符。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10, 1)
            .setValue(this.plugin.settings.minNumberOfCharactersTriggered)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.minNumberOfCharactersTriggered = value;
              await this.plugin.saveSettings();
            }),
        );
      },
    );

    addFilterableSetting("触发短语补全的最少词数", null, (setting) => {
      setting.addSlider((sc) =>
        sc
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.minNumberOfWordsTriggeredPhrase)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minNumberOfWordsTriggeredPhrase = value;
            await this.plugin.saveSettings();
          }),
      );
    });

    addFilterableSetting("自动显示补全建议", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.complementAutomatically).onChange(
          async (value) => {
            this.plugin.settings.complementAutomatically = value;
            await this.plugin.saveSettings();
          },
        );
      });
    });

    addFilterableSetting("补全触发延迟（毫秒）", null, (setting) => {
      setting.addSlider((sc) =>
        sc
          .setLimits(0, 1000, 10)
          .setValue(this.plugin.settings.delayMilliSeconds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.delayMilliSeconds = value;
            await this.plugin.saveSettings();
          }),
      );
    });

    addFilterableSetting(
      "输入法组词期间暂停补全",
      "组词开始时取消待执行建议，上屏后恢复。后台索引会等待停止输入后再运行。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.disableSuggestionsDuringImeOn,
          ).onChange(async (value) => {
            this.plugin.settings.disableSuggestionsDuringImeOn = value;
            await this.plugin.saveSettings();
          });
        });
      },
    );

    addFilterableSetting(
      "在数学块中暂停补全",
      "暂停数学块内的建议，不影响行内公式。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.disableSuggestionsInMathBlock,
          ).onChange(async (value) => {
            this.plugin.settings.disableSuggestionsInMathBlock = value;
            await this.plugin.saveSettings();
          });
        });
      },
    );

    addFilterableSetting(
      "在代码块中暂停补全",
      "暂停代码块内的建议，不影响行内代码。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.disableSuggestionsInCodeBlock,
          ).onChange(async (value) => {
            this.plugin.settings.disableSuggestionsInCodeBlock = value;
            await this.plugin.saveSettings();
          });
        });
      },
    );

    addFilterableSetting("补全后插入空格", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.insertSpaceAfterCompletion).onChange(
          async (value) => {
            this.plugin.settings.insertSpaceAfterCompletion = value;
            await this.plugin.saveSettings();
          },
        );
      });
    });

    addFilterableSetting("以这些字符开头时暂停补全", null, (setting) => {
      setting.addText((cb) => {
        cb.setValue(
          this.plugin.settings.firstCharactersDisableSuggestions,
        ).onChange(async (value) => {
          this.plugin.settings.firstCharactersDisableSuggestions = value;
          await this.plugin.saveSettings();
        });
      });
    });

    addFilterableSetting(
      "暂停补全的行规则",
      "光标前的行内容匹配这些正则表达式时不触发补全，每行一个规则。",
      (setting) => {
        setting.addTextArea((tc) => {
          const el = TextComponentEvent.onChange(
            tc.setValue(
              this.plugin.settings.patternsToSuppressTrigger.join("\n"),
            ),
            async (value) => {
              this.plugin.settings.patternsToSuppressTrigger =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings();
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path-dense";
          return el;
        });
      },
    );

    addFilterableSetting(
      "暂停补全的短语规则",
      "短语完整匹配这些正则表达式时不触发补全，每行一个规则。",
      (setting) => {
        setting.addTextArea((tc) => {
          const el = TextComponentEvent.onChange(
            tc.setValue(
              this.plugin.settings.phrasePatternsToSuppressTrigger.join("\n"),
            ),
            async (value) => {
              this.plugin.settings.phrasePatternsToSuppressTrigger =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings();
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path-dense";
          return el;
        });
      },
    );

    addFilterableSetting(
      "按切换键后才选中建议",
      "按下切换建议的快捷键之前，不自动聚焦候选项。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.noAutoFocusUntilCycle).onChange(
            async (value) => {
              this.plugin.settings.noAutoFocusUntilCycle = value;
              await this.plugin.saveSettings();
            },
          );
        });
      },
    );
  }

  private addAppearanceSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("外观").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting } = useFilterSetting(group, this.search);

    addFilterableSetting(
      "在状态栏显示匹配策略",
      "在状态栏显示匹配策略，重新加载插件后生效。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.showMatchStrategy).onChange(
            async (value) => {
              this.plugin.settings.showMatchStrategy = value;
              await this.plugin.saveSettings();
            },
          );
        });
      },
    );

    addFilterableSetting(
      "在状态栏显示自动补全开关",
      "在状态栏显示自动补全开关，重新加载插件后生效。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.showComplementAutomatically,
          ).onChange(async (value) => {
            this.plugin.settings.showComplementAutomatically = value;
            await this.plugin.saveSettings();
          });
        });
      },
    );

    addFilterableSetting(
      "在状态栏显示索引状态",
      "在状态栏显示索引状态，重新加载插件后生效。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.showIndexingStatus).onChange(
            async (value) => {
              this.plugin.settings.showIndexingStatus = value;
              await this.plugin.saveSettings();
            },
          );
        });
      },
    );

    addFilterableSetting("建议的说明文字", null, (setting) => {
      setting.addDropdown((tc) =>
        tc
          .addOptions(localizedOptions(DescriptionOnSuggestion.values()))
          .setValue(this.plugin.settings.descriptionOnSuggestion)
          .onChange(async (value) => {
            this.plugin.settings.descriptionOnSuggestion = value;
            await this.plugin.saveSettings();
          }),
      );
    });
  }

  private addKeyCustomizationSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("补全快捷键").setHeading();

    const group = new SettingGroup(containerEl).addClass(
      "yuhanbo-autocomplete-settings__popup-hotkey",
    );
    const { addFilterableSetting } = useFilterSetting(group, this.search);

    const li = createEl("li");
    li.append(
      "可在 ",
      createEl("a", {
        text: "keycode.info",
        href: "https://keycode.info/",
      }),
      " 查询键名，按键后查看 ",
      createEl("code", {
        text: "event.key",
      }),
      " 的值，",
      createEl("b", {
        text: "空格键除外",
      }),
      "。空格键请填写 ",
      createEl("code", {
        text: "Space",
      }),
      "。",
    );

    const ul = createEl("ul");
    ul.createEl("li", {
      text: "Ctrl a 表示同时按下 Ctrl 和 A。",
    });
    ul.createEl("li", {
      text: "Enter|Tab 表示按 Enter 或 Tab 均可触发。",
    });
    ul.createEl("li", {
      text: "Mod 在 Windows 上表示 Ctrl，在 macOS 上表示 Cmd。",
    });
    ul.append(li);

    const df = document.createDocumentFragment();
    df.append(ul);

    group.addSetting((setting) => {
      setting.setHeading().setName("候选列表快捷键").setDesc(df);
    });

    const hotkeys = this.plugin.settings.hotkeys;
    Object.keys(hotkeys).forEach((k: string) => {
      const key = k as keyof Settings["hotkeys"];

      addFilterableSetting(label(key), null, (setting) => {
        setting
          .setClass("yuhanbo-autocomplete-settings__popup-hotkey-item")
          .addText((cb) => {
            return cb
              .setValue(hotkeys[key].map(hotkey2String).join("|"))
              .onChange(async (value: string) => {
                hotkeys[key] = value
                  .split("|")
                  .map((x) => string2Hotkey(x, false))
                  .filter(isPresent);
                await this.plugin.saveSettings();
              });
          });
      });
    });

    new Setting(containerEl)
      .setName("将 Esc 继续传递给编辑器")
      .setDesc("适用于 Vim 模式：按一次 Esc 即可关闭建议并回到普通模式。")
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.propagateEsc).onChange(
          async (value) => {
            this.plugin.settings.propagateEsc = value;
            await this.plugin.saveSettings();
          },
        );
      });
  }

  private addCurrentFileComplementSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("当前笔记补全").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, refresh } = useFilterSetting(
      group,
      this.search,
    );

    const isEnabled = () => this.plugin.settings.enableCurrentFileComplement;

    addFilterableSetting("启用当前笔记补全", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.enableCurrentFileComplement).onChange(
          async (value) => {
            this.plugin.settings.enableCurrentFileComplement = value;
            refresh();
            await this.plugin.saveSettings({ currentFile: true });
          },
        );
      });
    });

    addFilterableSetting(
      "加入词表的最少字符数",
      "设为 0 时使用分词策略的默认值。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 15, 1)
            .setValue(this.plugin.settings.currentFileMinNumberOfCharacters)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.currentFileMinNumberOfCharacters = value;
              await this.plugin.saveSettings({ currentFile: true });
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "当前笔记仅补全英文",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.onlyComplementEnglishOnCurrentFileComplement,
          ).onChange(async (value) => {
            this.plugin.settings.onlyComplementEnglishOnCurrentFileComplement =
              value;
            await this.plugin.saveSettings({ currentFile: true });
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "触发补全的最少字符数",
      "单独指定此来源的触发阈值；设为 0 时沿用全局设置。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10, 1)
            .setValue(
              this.plugin.settings.currentFileMinNumberOfCharactersForTrigger,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.currentFileMinNumberOfCharactersForTrigger =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "排除词语的正则规则",
      "完整匹配这些正则表达式的词不进入候选，每行一个规则。",
      (setting) => {
        setting.addTextArea((tc) => {
          const el = TextComponentEvent.onChange(
            tc.setValue(
              this.plugin.settings.excludeCurrentFileWordPatterns.join("\n"),
            ),
            async (value) => {
              this.plugin.settings.excludeCurrentFileWordPatterns =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings({ currentFile: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path-dense";
          return el;
        });
      },
      { visible: isEnabled },
    );
  }

  private addCurrentVaultComplementSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("全库词语补全").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, addConditionalElement, refresh } =
      useFilterSetting(group, this.search);

    const isEnabled = () => this.plugin.settings.enableCurrentVaultComplement;

    addFilterableSetting("启用全库词语补全", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.enableCurrentVaultComplement).onChange(
          async (value) => {
            this.plugin.settings.enableCurrentVaultComplement = value;
            refresh();
            await this.plugin.saveSettings({ currentVault: true });
          },
        );
      });
    });

    addFilterableSetting(
      "加入词表的最少字符数",
      "设为 0 时使用分词策略的默认值。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 15, 1)
            .setValue(this.plugin.settings.currentVaultMinNumberOfCharacters)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.currentVaultMinNumberOfCharacters = value;
              await this.plugin.saveSettings({ currentVault: true });
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "仅索引这些路径前缀",
      "仅包含以这些路径开头的文件；每行一个，满足任意一个即可。留空表示全部。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(
                this.plugin.settings.includeCurrentVaultPathPrefixPatterns,
              )
              .setPlaceholder("归档/\n临时笔记/"),
            async (value) => {
              this.plugin.settings.includeCurrentVaultPathPrefixPatterns =
                value;
              await this.plugin.saveSettings({ currentVault: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "排除这些路径前缀",
      "排除以这些路径开头的文件，每行一个。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(
                this.plugin.settings.excludeCurrentVaultPathPrefixPatterns,
              )
              .setPlaceholder("归档/\n临时笔记/"),
            async (value) => {
              this.plugin.settings.excludeCurrentVaultPathPrefixPatterns =
                value;
              await this.plugin.saveSettings({ currentVault: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "排除路径的通配规则",
      "每行一个规则，支持 **/attachments、**/*.png 等通配符。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(
                this.plugin.settings.excludeCurrentVaultPathGlobPatterns.join(
                  "\n",
                ),
              )
              .setPlaceholder("**/attachments\n**/*.png"),
            async (value) => {
              this.plugin.settings.excludeCurrentVaultPathGlobPatterns =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings({ currentVault: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );
    addConditionalElement(
      containerEl.createEl("div", {
        text: "通配规则会增加处理开销，能用路径前缀时优先使用路径前缀。",
        cls: "yuhanbo-autocomplete-settings__warning",
      }),
      isEnabled,
    );

    addFilterableSetting(
      "仅索引当前目录中的文件",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings
              .includeCurrentVaultOnlyFilesUnderCurrentDirectory,
          ).onChange(async (value) => {
            this.plugin.settings.includeCurrentVaultOnlyFilesUnderCurrentDirectory =
              value;
            await this.plugin.saveSettings({ currentVault: true });
          });
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "触发补全的最少字符数",
      "单独指定此来源的触发阈值；设为 0 时沿用全局设置。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10, 1)
            .setValue(
              this.plugin.settings.currentVaultMinNumberOfCharactersForTrigger,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.currentVaultMinNumberOfCharactersForTrigger =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "排除词语的正则规则",
      "完整匹配这些正则表达式的词不进入候选，每行一个规则。",
      (setting) => {
        setting.addTextArea((tc) => {
          const el = TextComponentEvent.onChange(
            tc.setValue(
              this.plugin.settings.excludeCurrentVaultWordPatterns.join("\n"),
            ),
            async (value) => {
              this.plugin.settings.excludeCurrentVaultWordPatterns =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings({ currentVault: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path-dense";
          return el;
        });
      },
      { visible: isEnabled },
    );
  }

  private addCustomDictionaryComplementSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("自定义词库").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, refresh } = useFilterSetting(
      group,
      this.search,
    );

    const isEnabled = () =>
      this.plugin.settings.enableCustomDictionaryComplement;

    addFilterableSetting("启用自定义词库", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.enableCustomDictionaryComplement,
        ).onChange(async (value) => {
          this.plugin.settings.enableCustomDictionaryComplement = value;
          refresh();
          await this.plugin.saveSettings({ customDictionary: true });
        });
      });
    });

    addFilterableSetting(
      "自定义词库路径",
      "每行填写一个相对于库根目录的路径或词库网址；填写网址后才会联网获取。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(this.plugin.settings.customDictionaryPaths)
              .setPlaceholder("词库/常用短语.txt"),
            async (value) => {
              this.plugin.settings.customDictionaryPaths = value;
              await this.plugin.saveSettings({ customDictionary: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "词库列分隔符",
      null,
      (setting) => {
        setting.addDropdown((tc) =>
          tc
            .addOptions(localizedOptions(ColumnDelimiter.values()))
            .setValue(this.plugin.settings.columnDelimiter)
            .onChange(async (value) => {
              this.plugin.settings.columnDelimiter = value;
              await this.plugin.saveSettings({ customDictionary: true });
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "词语筛选正则表达式",
      "只加载匹配此正则表达式的词语。",
      (setting) => {
        setting.addText((cb) => {
          cb.setValue(
            this.plugin.settings.customDictionaryWordRegexPattern,
          ).onChange(async (value) => {
            this.plugin.settings.customDictionaryWordRegexPattern = value;
            await this.plugin.saveSettings({ customDictionary: true });
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "隐藏后续文字的分隔符",
      "例如设为 ;;; 时，abcd;;;efg 显示为 abcd，插入时为 abcdefg。",
      (setting) => {
        setting.addText((cb) => {
          cb.setValue(this.plugin.settings.delimiterToHideSuggestion).onChange(
            async (value) => {
              this.plugin.settings.delimiterToHideSuggestion = value;
              await this.plugin.saveSettings({ customDictionary: true });
            },
          );
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "显示文字与插入内容的分隔符",
      "例如设为 >>> 时，显示文字 >>> 插入内容 会显示前者并插入后者。",
      (setting) => {
        setting.addText((cb) => {
          cb.setValue(
            this.plugin.settings
              .delimiterToDivideSuggestionsForDisplayFromInsertion,
          ).onChange(async (value) => {
            this.plugin.settings.delimiterToDivideSuggestionsForDisplayFromInsertion =
              value;
            await this.plugin.saveSettings({ customDictionary: true });
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "补全后的光标标记",
      "例如标记为 <CARET> 时，<li><CARET></li> 插入后会将光标放在两个标签之间。",
      (setting) => {
        setting.addText((cb) => {
          cb.setValue(
            this.plugin.settings.caretLocationSymbolAfterComplement,
          ).onChange(async (value) => {
            this.plugin.settings.caretLocationSymbolAfterComplement = value;
            await this.plugin.saveSettings({ customDictionary: true });
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "特殊插入内容的显示后缀",
      "显示文字与实际插入内容不同时，追加此后缀提示。",
      (setting) => {
        setting.addText((cb) => {
          cb.setValue(this.plugin.settings.displayedTextSuffix).onChange(
            async (value) => {
              this.plugin.settings.displayedTextSuffix = value;
              await this.plugin.saveSettings();
            },
          );
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "触发补全的最少字符数",
      "单独指定此来源的触发阈值；设为 0 时沿用全局设置。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10, 1)
            .setValue(
              this.plugin.settings
                .customDictionaryMinNumberOfCharactersForTrigger,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.customDictionaryMinNumberOfCharactersForTrigger =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );
  }

  private addInternalLinkComplementSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("内部链接补全").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, addConditionalElement, refresh } =
      useFilterSetting(group, this.search);

    const isEnabled = () => this.plugin.settings.enableInternalLinkComplement;
    const usesAliasTransformation = () =>
      isEnabled() &&
      this.plugin.settings.insertAliasTransformedFromDisplayedInternalLink
        .enabled;

    addFilterableSetting("启用内部链接补全", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.enableInternalLinkComplement).onChange(
          async (value) => {
            this.plugin.settings.enableInternalLinkComplement = value;
            refresh();
            await this.plugin.saveSettings({ internalLink: true });
          },
        );
      });
    });

    addFilterableSetting(
      "同时建议文件别名",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.suggestInternalLinkWithAlias,
          ).onChange(async (value) => {
            this.plugin.settings.suggestInternalLinkWithAlias = value;
            await this.plugin.saveSettings({ internalLink: true });
          });
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "保留输入的首字母大小写",
      "输入与文件名的首字母大小写不同时，使用保留输入大小写的别名插入链接。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.preserveFirstLetterCaseOnInternalLink,
          ).onChange(async (value) => {
            this.plugin.settings.preserveFirstLetterCaseOnInternalLink = value;
            await this.plugin.saveSettings();
          });
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "保存时更新内部链接",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.updateInternalLinksOnSave).onChange(
            async (value) => {
              this.plugin.settings.updateInternalLinksOnSave = value;
              await this.plugin.saveSettings({ internalLink: true });
            },
          );
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "排除指向当前笔记的链接",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.excludeSelfInternalLink).onChange(
            async (value) => {
              this.plugin.settings.excludeSelfInternalLink = value;
              await this.plugin.saveSettings({ internalLink: true });
            },
          );
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "排除当前笔记已有的链接",
      "候选中排除当前笔记已有链接；排除后显示的数量可能少于上限。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.excludeExistingInActiveFileInternalLinks,
          ).onChange(async (value) => {
            this.plugin.settings.excludeExistingInActiveFileInternalLinks =
              value;
            await this.plugin.saveSettings({ internalLink: true });
          });
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "排除未创建笔记的链接",
      "不建议尚未创建目标文件的链接。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.excludeUnresolvedInternalLinks,
          ).onChange(async (value) => {
            this.plugin.settings.excludeUnresolvedInternalLinks = value;
            await this.plugin.saveSettings({ internalLink: true });
          });
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "在代码中排除内部链接建议",
      "在代码块和行内代码中只暂停内部链接建议，保留其他词语补全。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(this.plugin.settings.excludeInternalLinksInCode).onChange(
            async (value) => {
              this.plugin.settings.excludeInternalLinksInCode = value;
              await this.plugin.saveSettings();
            },
          );
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "使用转换后的文字作为链接别名",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.insertAliasTransformedFromDisplayedInternalLink
              .enabled,
          ).onChange(async (value) => {
            this.plugin.settings.insertAliasTransformedFromDisplayedInternalLink.enabled =
              value;
            refresh();
            await this.plugin.saveSettings();
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "转换前：带捕获组的正则表达式",
      String.raw`例如： (?<name>.+) \(.+\)$`,
      (setting) => {
        setting
          .setClass("yuhanbo-autocomplete-settings__nested")
          .addText((cb) => {
            cb.setValue(
              this.plugin.settings
                .insertAliasTransformedFromDisplayedInternalLink.beforeRegExp,
            ).onChange(async (value) => {
              this.plugin.settings.insertAliasTransformedFromDisplayedInternalLink.beforeRegExp =
                value;
              await this.plugin.saveSettings();
            });
          });
      },
      { visible: usesAliasTransformation },
    );
    addFilterableSetting(
      "转换后",
      "例如：$<name>",
      (setting) => {
        setting
          .setClass("yuhanbo-autocomplete-settings__nested")
          .addText((cb) => {
            cb.setValue(
              this.plugin.settings
                .insertAliasTransformedFromDisplayedInternalLink.after,
            ).onChange(async (value) => {
              this.plugin.settings.insertAliasTransformedFromDisplayedInternalLink.after =
                value;
              await this.plugin.saveSettings();
            });
          });
      },
      { visible: usesAliasTransformation },
    );

    addFilterableSetting(
      "排除这些路径前缀",
      "排除以这些路径开头的文件，每行一个。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(
                this.plugin.settings.excludeInternalLinkPathPrefixPatterns,
              )
              .setPlaceholder("归档/\n临时笔记/"),
            async (value) => {
              this.plugin.settings.excludeInternalLinkPathPrefixPatterns =
                value;
              await this.plugin.saveSettings({ internalLink: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "排除路径的通配规则",
      "每行一个规则，支持 **/attachments、**/*.png 等通配符。",
      (setting) => {
        setting.addTextArea((tac) => {
          const el = TextComponentEvent.onChange(
            tac
              .setValue(
                this.plugin.settings.excludeInternalLinkPathGlobPatterns.join(
                  "\n",
                ),
              )
              .setPlaceholder("**/attachments\n**/*.png"),
            async (value) => {
              this.plugin.settings.excludeInternalLinkPathGlobPatterns =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings({ internalLink: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path";
          return el;
        });
      },
      { visible: isEnabled },
    );
    addConditionalElement(
      containerEl.createEl("div", {
        text: "通配规则会增加处理开销，能用路径前缀时优先使用路径前缀。",
        cls: "yuhanbo-autocomplete-settings__warning",
      }),
      isEnabled,
    );

    addFilterableSetting(
      "按笔记属性排除链接",
      "笔记包含此名称的属性且值为 true 时，不建议指向该笔记的链接。",
      (setting) => {
        setting.addText((cb) => {
          TextComponentEvent.onChange(cb, async (value) => {
            this.plugin.settings.frontMatterKeyForExclusionInternalLink = value;
            await this.plugin.saveSettings({ internalLink: true });
          }).setValue(
            this.plugin.settings.frontMatterKeyForExclusionInternalLink,
          );
        });
      },
      { visible: isEnabled },
    );
    addFilterableSetting(
      "排除这些标签的笔记",
      "带有这些标签的笔记不进入链接建议，每行一个标签。",
      (setting) => {
        setting.addTextArea((tc) => {
          const el = TextComponentEvent.onChange(
            tc.setValue(
              this.plugin.settings.tagsForExclusionInternalLink.join("\n"),
            ),
            async (value) => {
              this.plugin.settings.tagsForExclusionInternalLink =
                smartLineBreakSplit(value);
              await this.plugin.saveSettings({ internalLink: true });
            },
          );
          el.inputEl.className =
            "yuhanbo-autocomplete-settings__text-area-path-mini";
          return el;
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "触发补全的最少字符数",
      "单独指定此来源的触发阈值；设为 0 时沿用全局设置。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10, 1)
            .setValue(
              this.plugin.settings.internalLinkMinNumberOfCharactersForTrigger,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.internalLinkMinNumberOfCharactersForTrigger =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );
  }

  private addFrontMatterComplementSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("笔记属性补全").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, refresh } = useFilterSetting(
      group,
      this.search,
    );

    const isEnabled = () => this.plugin.settings.enableFrontMatterComplement;

    addFilterableSetting("启用笔记属性补全", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(this.plugin.settings.enableFrontMatterComplement).onChange(
          async (value) => {
            this.plugin.settings.enableFrontMatterComplement = value;
            refresh();
            await this.plugin.saveSettings({ frontMatter: true });
          },
        );
      });
    });

    addFilterableSetting(
      "属性值匹配策略",
      null,
      (setting) => {
        setting.addDropdown((tc) =>
          tc
            .addOptions(localizedOptions(SpecificMatchStrategy.values()))
            .setValue(this.plugin.settings.frontMatterComplementMatchStrategy)
            .onChange(async (value) => {
              this.plugin.settings.frontMatterComplementMatchStrategy = value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "补全属性后插入逗号",
      null,
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.insertCommaAfterFrontMatterCompletion,
          ).onChange(async (value) => {
            this.plugin.settings.insertCommaAfterFrontMatterCompletion = value;
            await this.plugin.saveSettings();
          });
        });
      },
      { visible: isEnabled },
    );
  }

  private addIntelligentSuggestionPrioritizationSettings(
    containerEl: HTMLElement,
  ) {
    new Setting(containerEl).setName("使用历史排序").setHeading();

    const group = new SettingGroup(containerEl);
    const { addFilterableSetting, refresh } = useFilterSetting(
      group,
      this.search,
    );

    const isEnabled = () =>
      this.plugin.settings.intelligentSuggestionPrioritization.enabled;

    addFilterableSetting("启用使用历史排序", null, (setting) => {
      setting.addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.intelligentSuggestionPrioritization.enabled,
        ).onChange(async (value) => {
          this.plugin.settings.intelligentSuggestionPrioritization.enabled =
            value;
          refresh();
          await this.plugin.saveSettings({
            intelligentSuggestionPrioritization: true,
          });
        });
      });
    });

    addFilterableSetting(
      "历史记录路径",
      `默认：${this.plugin.defaultHistoryPath}`,
      (setting) => {
        setting.addText((cb) => {
          TextComponentEvent.onChange(cb, async (value) => {
            this.plugin.settings.intelligentSuggestionPrioritization.historyFilePath =
              value;
            await this.plugin.saveSettings({
              intelligentSuggestionPrioritization: true,
            });
          }).setValue(
            this.plugin.settings.intelligentSuggestionPrioritization
              .historyFilePath,
          );
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "格式化历史记录文件",
      "使用缩进保存历史记录，便于查看 Git 差异。",
      (setting) => {
        setting.addToggle((tc) => {
          tc.setValue(
            this.plugin.settings.intelligentSuggestionPrioritization
              .prettyPrintHistoryFile,
          ).onChange(async (value) => {
            this.plugin.settings.intelligentSuggestionPrioritization.prettyPrintHistoryFile =
              value;
            await this.plugin.saveSettings();
          });
        });
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "历史记录保留天数",
      "设为 0 时不按此条件清理。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 365, 1)
            .setValue(
              this.plugin.settings.intelligentSuggestionPrioritization
                .maxDaysToKeepHistory,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.intelligentSuggestionPrioritization.maxDaysToKeepHistory =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );

    addFilterableSetting(
      "最多保留历史记录数",
      "设为 0 时不按此条件清理。",
      (setting) => {
        setting.addSlider((sc) =>
          sc
            .setLimits(0, 10000, 1)
            .setValue(
              this.plugin.settings.intelligentSuggestionPrioritization
                .maxNumberOfHistoryToKeep,
            )
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.intelligentSuggestionPrioritization.maxNumberOfHistoryToKeep =
                value;
              await this.plugin.saveSettings();
            }),
        );
      },
      { visible: isEnabled },
    );
  }

  private addMobileSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("移动端").setHeading();

    new Setting(containerEl).setName("在移动端禁用插件").addToggle((tc) => {
      tc.setValue(this.plugin.settings.disableOnMobile).onChange(
        async (value) => {
          this.plugin.settings.disableOnMobile = value;
          await this.plugin.saveSettings();
        },
      );
    });
  }

  private addDebugSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("诊断").setHeading();

    new Setting(containerEl).setName("在控制台显示性能日志").addToggle((tc) => {
      tc.setValue(
        this.plugin.settings.showLogAboutPerformanceInConsole,
      ).onChange(async (value) => {
        this.plugin.settings.showLogAboutPerformanceInConsole = value;
        await this.plugin.saveSettings();
      });
    });
  }

  async toggleMatchStrategy() {
    switch (this.plugin.settings.matchStrategy) {
      case "prefix":
        this.plugin.settings.matchStrategy = "partial";
        break;
      case "partial":
        this.plugin.settings.matchStrategy = "prefix";
        break;
      default:
        // noinspection ObjectAllocationIgnored
        new Notice("匹配策略无效，请重新选择。");
    }
    await this.plugin.saveSettings();
  }

  async toggleComplementAutomatically() {
    this.plugin.settings.complementAutomatically =
      !this.plugin.settings.complementAutomatically;
    await this.plugin.saveSettings();
  }

  async ensureCustomDictionaryPath(
    path: string,
    state: "present" | "absent",
  ): Promise<boolean> {
    const paths = this.plugin.settings.customDictionaryPaths.split("\n");
    const exists = paths.some((x) => x === path);
    if ((exists && state === "present") || (!exists && state === "absent")) {
      return false;
    }

    const newPaths =
      state === "present" ? [...paths, path] : paths.filter((x) => x !== path);
    this.plugin.settings.customDictionaryPaths = newPaths.join("\n");
    await this.plugin.saveSettings({ customDictionary: true });

    return true;
  }

  getPluginSettingsAsJsonString(): string {
    return JSON.stringify(
      {
        version: this.plugin.manifest.version,
        mobile: (this.app as any).isMobile,
        settings: this.plugin.settings,
      },
      null,
      4,
    );
  }
}
