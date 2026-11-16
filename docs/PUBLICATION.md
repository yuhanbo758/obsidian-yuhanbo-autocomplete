# 发布准备

- 版本 1.0.9，插件 ID autocomplete，最低 Obsidian 1.11.4；市场介绍遵循平台英文要求，插件设置与命令仍默认中文。
- 派生项目遵守 MIT 许可证；原作者 tadashi-aikawa 已[公开书面授权提交并上架社区目录](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/issues/388#issuecomment-6891400600)。授权不等于社区审核通过或客户端已收录，提交后分别验证这些状态。
- 个人设置、历史、诊断报告、库内文件列表和固定本机路径的部署/验收脚本不进入公开仓库。
- GitHub Actions 负责后续构建和 Release，不在插件中实现自更新。
- 社区审核修复包括英文 README、明确全库索引与主动复制设置的剪贴板行为，以及更新路径匹配依赖以消除生产依赖审计中的已知漏洞；补全与输入法逻辑保持原实现。
- 1.0.9 的生产依赖审计无已知漏洞；完整审计仍有开发工具链告警。Svelte 浏览器运行时已单独检查：本插件未使用相关通告要求的 SSR 或用户可控表单属性展开，因此未发现对应可利用路径。上述结果不等于全部依赖审计清零。
- 首次提交需登录 Obsidian Community 并由用户亲自完成账户及 OAuth 授权。

## 社区发布状态（2026-11-16）

- 已完成 Submit 和 Publish，公开条目：https://community.obsidian.md/plugins/autocomplete 。条目显示当前版本 1.0.9，并保留 yuhanbo 与原作者 tadashi-aikawa 的贡献署名。
- 1.0.9 自动扫描状态为 Completed，未发现 Error；仍有类型、代码风格、依赖等非阻断告警，公开评分为 Health Excellent / Review Caution。这不代表人工审核完成或全部告警清零。
- Release 附件与远端源码构建逐字节一致，三个附件的构建证明验证通过：https://github.com/yuhanbo758/obsidian-yuhanbo-autocomplete/actions/runs/43835595776 。
- 北京时间 17:05 的安装索引核验中，网站源 JSON 和客户端 GitHub 镜像尚未出现该插件。源 JSON 使用一小时共享缓存，官方镜像按小时调度且可能延迟；公开条目和客户端可搜索安装状态须分别核验。
