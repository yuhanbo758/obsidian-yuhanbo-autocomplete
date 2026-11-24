# yuhanbo-autocomplete

## English overview

Chinese-first, offline autocomplete for Obsidian 1.11.4 or later. Suggestions come from the current note, a vault-wide word index, note links, properties, custom dictionaries, and completion history. The bundled vocabulary contains 1,143 Chinese entries and 215 English technical terms. Settings and commands are in Chinese by default.

Type a prefix and select a suggestion: for example, `提示` can suggest `提示词`, and `autoc` can suggest `autocomplete`. Chinese IME composition pauses suggestions until text is committed, including whole-phrase commits. Background indexing yields while you type.

For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub Release, place them in your vault's `.obsidian/plugins/autocomplete` directory, then enable the plugin. Existing custom installation directories are also supported. Enable only one autocomplete plugin at a time.

**Privacy and network use:** Completion runs locally by default, with no telemetry, AI service, account, payment, or note uploads. The vault index enumerates file paths and reads eligible notes through the Obsidian API. Settings and completion history stay in the vault's plugin directory; personal dictionaries and history are not included in this repository. Optional CEDICT dictionaries are read from within the vault. A remote dictionary is downloaded through Obsidian's `requestUrl` only when the user configures and enables its URL; that server receives the download request. The explicit **Copy plugin settings** command writes settings to the system clipboard; the plugin does not read clipboard contents.

**License and attribution:** This is an independently maintained derivative of [Various Complements](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin) 11.4.2 by tadashi-aikawa. The original MIT license and attribution are retained. The original author has [publicly approved submission and listing of this derivative in the Obsidian Community directory](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/issues/388#issuecomment-6891400600). Publication and automated review are separate from this permission. Mobile APIs are supported, but a full Android/iOS device and IME test matrix has not been completed.

## 中文说明

中文优先的 Obsidian 自动补全插件，支持当前笔记、全库词项、笔记链接、属性、自定义词库与补全历史。设置页面默认中文，随包提供 1,143 条中文词语和 215 条英文技术词。

本项目基于 [Various Complements](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin) 11.4.2（提交 ed7c6793ed6d2cd82ab5d746ab7cbd6c2c402918）修改，保留原作者 tadashi-aikawa 的 MIT 许可和署名。这是独立维护的派生版本，不是 Obsidian 官方产品。原作者已[公开书面同意本派生插件提交并上架 Obsidian 社区目录](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/issues/388#issuecomment-6891400600)；授权与社区审核、实际收录为不同状态。

## 使用

要求 Obsidian 1.11.4 或更新版本。输入“提示”可选择“提示词”，输入 autoc 可选择 autocomplete。支持一次提交词组、连续逐字输入及自定义短语。输入法组词期间默认暂停候选，提交后按配置的触发延迟恢复。

默认使用离线系统中文分词，不需要下载大词典。可选的 CC-CEDICT 路径相对于笔记库根目录。自定义词库路径每行一个，可使用本地文本或 JSON 词库；自定义同名词覆盖内置词。

手动安装时，从 GitHub Release 下载 main.js、manifest.json、styles.css，放入笔记库配置目录的 plugins/autocomplete 文件夹并启用。已有自定义安装目录的用户可保留原目录，存储路径读取 manifest.dir。不要同时启用其他同功能补全插件。

## 隐私、数据与网络

默认全部补全在本地完成，无遥测、无 AI API、无账户或付费要求，不上传笔记，不访问库外文件。设置和历史保存在当前库插件目录中；仓库不附带个人设置、补全历史或用户词库。

只有用户明确配置并启用远程词库 URL 时才通过 Obsidian requestUrl 下载，所配置的服务器会收到该下载请求；请求设置超时。可选 CEDICT 文件只从当前笔记库读取。

全库补全会通过 Obsidian API 枚举库内文件路径、读取符合配置的笔记以建立本地索引。仅在用户主动执行“复制插件设置”命令时，将插件设置写入系统剪贴板；插件不读取剪贴板内容。

## 开发与发布

```powershell
pnpm install --frozen-lockfile
pnpm verify
python scripts/security-scan.py . --severity high --no-color
```

使用 Node.js 24 与 pnpm 10.4.0，保留上游锁文件。main.js 为可审查的生产构建；源码、测试与许可证一同公开。移动端使用浏览器兼容 API，但未完成所有 Android/iOS 真机和原生中文输入法组合验收。

自动发布工作流会在 main 上有插件代码变更时构建、测试并生成 GitHub Release；纯文档修改不发布。若当前版本已有标签则递增补丁版本；未使用的显式版本保持不变。Release 提供 main.js、manifest.json、styles.css 及构建证明。

后续更新：修改 src/ 后提交并推送 main。指定版本时先修改 manifest.json，再运行 pnpm release:prepare。插件已收录于 [Obsidian 社区目录](https://community.obsidian.md/plugins/autocomplete)。更新由 Obsidian 的检查更新流程处理。发版后可在社区页面核对版本和自动扫描结果。

## 许可证与来源

[MIT](LICENSE)。原作者 tadashi-aikawa；定制维护 Yuhanbo Yu。中文分词行为与原 chinese-tokenizer 对照，代码修改包括中文界面、整词提交恢复、异步结果取消、可暂停索引和历史持久化修复。详见 [发布准备说明](docs/PUBLICATION.md)。

## 👨‍💻 作者信息

**余汉波** - 编程爱好者-量化交易和效率工具开发

- **GitHub**: [@yuhanbo758](https://github.com/yuhanbo758)

- **Email**: yuhanbo@sanrenjz.com

- **Website**: [三人聚智](https://www.sanrenjz.com)

## 🌐 相关链接

- 🏠 [项目主页](https://www.sanrenjz.com)

- 📚 [在线文档](https://docs.sanrenjz.com)（财经、代码和库文档等）

- 🛒 [插件商店](https://shop.sanrenjz.com)（所有程序，包括开源和不开源）


## 联系我们

[联系我们 - 三人聚智-余汉波](https://www.sanrenjz.com/contact_us/)

证券开户（+V：yuhanbo758）：[证券开户免5万0.854，无门槛开量化QMT，送框架策略，支持VIP快速通道，也可开Ptrade | 余汉波 文档](https://docs.sanrenjz.com/article/%E8%AF%81%E5%88%B8%E5%BC%80%E6%88%B7%E5%85%8D5%20%E4%B8%870.854%EF%BC%8C%E6%97%A0%E9%97%A8%E6%A7%9B%E5%BC%80%E9%87%8F%E5%8C%96QMT%EF%BC%8C%E9%80%81%E6%A1%86%E6%9E%B6%E7%AD%96%E7%95%A5%EF%BC%8C%E6%94%AF%E6%8C%81VIP%E5%BF%AB%E9%80%9F%E9%80%9A%E9%81%93%EF%BC%8C%E4%B9%9F%E5%8F%AF%E5%BC%80Ptrade)

三人聚智下载：[sanrenjz - 三人聚智](https://www.sanrenjz.com/sanrenjz/)

codebot 下载：[sanrenjz-codebot - 三人聚智-余汉波](https://www.sanrenjz.com/sanrenjz-codebot/)

![三码合一](https://gdsx.sanrenjz.com/image/sanrenjz_yuhanbolh_yuhanbo758.png?imageSlim&t=1ab9b82c-e220-8022-beff-e265a194292a)

![余汉波打赏码](https://gdsx.sanrenjz.com/image/%E6%89%93%E8%B5%8F%E7%A0%81%E5%90%88%E4%B8%80.png?imageSlim)

## 🙏 致谢

感谢所有为本项目贡献代码和想法的开发者们！

---
**⭐ 如果这个项目对您有帮助，请给它一个 Star！**
