# 发布前隐私检查

检查日期：2026-11-01。使用 security skill 的 Python 扫描器，并补充检查个人路径、配置、历史和测试材料。

原运行目录包含个人设置、补全历史、笔记路径、诊断结果及本机部署脚本。它们已保留在本地备份，未进入公开 Git 仓库。公开副本排除了 data.json、histories.json、reports/、本机验收/部署脚本、依赖目录及旧发行包；README 已替换为不含个人库数据的公开说明。

复扫：无 HIGH、MEDIUM 凭据发现，无本机私有路径命中。低危赋值匹配人工复核为代码变量或扫描规则文本，未识别为真实凭据。扫描器自身的规则文本曾发生自匹配，已通过等价字符串拼接修正，未关闭对应规则。扫描不是对所有潜在漏洞或未来提交的保证。

仓库使用 GitHub noreply 提交身份。原始 Git 元数据没有复制；原项目来源、基线提交和 MIT 许可证保留。暂存区提交前扫描和 GitHub Actions 构建前扫描均已配置。

## 社区市场状态

本项目是 Various Complements 的派生版本。首次发布检查时尚无原作者书面授权；截至 2026-11-16，已核验原作者 tadashi-aikawa 的[公开授权回复](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/issues/388#issuecomment-6891400600)，明确同意提交并上架 Obsidian 社区目录。GitHub 开源、作者授权、社区审核和客户端收录是不同状态。政策依据：https://docs.obsidian.md/community-directory/developer-policies 。
