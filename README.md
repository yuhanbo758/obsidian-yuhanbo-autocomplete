# yuhanbo-autocomplete

中文优先的 Obsidian 自动补全插件，支持当前笔记、全库词项、笔记链接、属性、自定义词库与补全历史。设置页面默认中文，随包提供 1,143 条中文词语和 215 条英文技术词。

本项目基于 [Various Complements](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin) 11.4.2（提交 ed7c6793ed6d2cd82ab5d746ab7cbd6c2c402918）修改，保留原作者 tadashi-aikawa 的 MIT 许可和署名。这是独立维护的派生版本，不是 Obsidian 官方产品。尚未获得社区目录针对派生项目的上架授权，不宣称已在社区市场发布。

## 使用

要求 Obsidian 1.11.4 或更新版本。输入“提示”可选择“提示词”，输入 autoc 可选择 autocomplete。支持一次提交词组、连续逐字输入及自定义短语。输入法组词期间默认暂停候选，提交后按配置的触发延迟恢复。

默认使用离线系统中文分词，不需要下载大词典。可选的 CC-CEDICT 路径相对于笔记库根目录。自定义词库路径每行一个，可使用本地文本或 JSON 词库；自定义同名词覆盖内置词。

手动安装时，从 GitHub Release 下载 main.js、manifest.json、styles.css，放入笔记库配置目录的 plugins/autocomplete 文件夹并启用。已有自定义安装目录的用户可保留原目录，存储路径读取 manifest.dir。不要同时启用其他同功能补全插件。

## 隐私、数据与网络

默认全部补全在本地完成，无遥测、无 AI API、无账户或付费要求，不上传笔记，不访问库外文件。设置和历史保存在当前库插件目录中；仓库不附带个人设置、补全历史或用户词库。

只有用户明确配置并启用远程词库 URL 时才通过 Obsidian requestUrl 下载，所配置的服务器会收到该下载请求；请求设置超时。可选 CEDICT 文件只从当前笔记库读取。

## 开发与发布

```powershell
pnpm install --frozen-lockfile
pnpm verify
python scripts/security-scan.py . --severity high --no-color
```

使用 Node.js 24 与 pnpm 10.4.0，保留上游锁文件。main.js 为可审查的生产构建；源码、测试与许可证一同公开。移动端使用浏览器兼容 API，但未完成所有 Android/iOS 真机和原生中文输入法组合验收。

自动发布工作流会在 main 上有插件代码变更时构建、测试并生成 GitHub Release；纯文档修改不发布。若当前版本已有标签则递增补丁版本；未使用的显式版本保持不变。Release 提供 main.js、manifest.json、styles.css 及构建证明。

后续更新：修改 src/ 后提交并推送 main。指定版本时先修改 manifest.json，再运行 pnpm release:prepare。社区目录尚未收录时，GitHub 发布不等同于 Obsidian 市场可安装；社区收录后更新由 Obsidian 的正常检查更新流程处理，插件不会自行下载或安装代码。

## 许可证与来源

[MIT](LICENSE)。原作者 tadashi-aikawa；定制维护 Yuhanbo Yu。中文分词行为与原 chinese-tokenizer 对照，代码修改包括中文界面、整词提交恢复、异步结果取消、可暂停索引和历史持久化修复。详见 [发布准备说明](docs/PUBLICATION.md)。
