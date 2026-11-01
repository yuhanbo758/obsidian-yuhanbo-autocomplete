# Repository Guidelines

## 中文优先分支约束
- 插件 ID 固定为 `autocomplete`，显示名为 `yuhanbo-autocomplete`；用户明确指定安装目录为 `obsidian-yuhanbo-autocomplete`。文件存储路径以 `manifest.dir` 为准，不用 ID 推导目录。
- 可按实际体验改进界面与实现，不要求沿袭上游布局；修改源码后构建，禁止直接修改生成的 `main.js`。
- 默认使用离线中文分词和随包词库；不能在默认设置中恢复外部词库下载。中文词条为主，英文技术词为辅。
- 设置、命令和提示默认使用中文；关键算法和业务约束使用简洁中文注释。
- 仅在独立测试库验证，不能使用主库做实验。验收时临时调整的其他插件启用列表必须恢复。
- `data.json`、补全历史、运行时报告和含库内文件名的输出不得进入发布包。
- 设置页使用作用域样式与自适应尺寸；多行输入项采用上下布局，不能用固定宽度挤压说明文字。
- 持续覆盖中文长行、中文候选去重、连续输入取消、索引缓存失效和卸载清理。
- 输入法判断必须覆盖 `compositionStarted`；延迟查询执行前再次校验组词状态。编辑期间的后台索引等待空闲，整库合并与索引循环必须分批让出主线程。
- 异步补全展示前校验请求版本及编辑器、文件、查询与范围；取消请求的空结果不能触发核心关闭。核心可能重建等价 context，不可仅比较其对象引用。
- 后台索引的让出使用独立消息任务，不能依赖隐藏窗口会被限速的链式定时器；大文件分词和词项构造须在文件内部提供暂停点。CEDICT 优化必须与原实现逐词对照，保留词项、繁简与最长匹配行为。
- 必须覆盖整词上屏后尾随输入事件、逐字/整词等价性、连续词组和跨窗口事件；结束的组词会话不能被尾随 isComposing 事件重开。配置切换要使旧异步索引失效，历史写入成功后才标记已持久化。

## Project Structure & Module Organization
- `src/`: TypeScript source.
  - `src/main.ts`: Obsidian plugin entry.
  - `src/ui/`: Svelte UI components.
  - `src/provider/`, `src/tokenizer/`, `src/util/`, `src/setting/`: core logic and helpers.
- Root artifacts: `manifest.json`, `styles.css`, bundled `main.js`.
- Tests: colocated `*.test.ts` next to sources (e.g., `src/util/strings.test.ts`).

## Build, Test, and Development Commands
- `pnpm dev`: Start esbuild in watch mode. Copies `main.js`, `manifest.json`, `styles.css` to your Obsidian vault if `VAULT_DIR` in `esbuild.config.mjs` is set.
- `pnpm build`: Type-check then production bundle to `main.js`.
- `pnpm typecheck`: Run TypeScript in strict mode without emit.
- `pnpm test` | `pnpm test:watch`: Run Jest tests (with coverage by default).
- `pnpm format`: Prettier check for `*.ts` files.
- `pnpm verify`: Install, Build, Check for CI.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). UI in Svelte where applicable.
- Formatting: Prettier with `prettier-plugin-organize-imports` (run `pnpm format`).
- Indentation: Prettier defaults (2 spaces). Avoid inline `any` and prefer explicit types.
- Names: `PascalCase` for types/classes, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants.
- File names: `kebab-case.ts`; tests as `name.test.ts` colocated with the unit under test.

## Testing Guidelines
- Framework: Jest via `esbuild-jest` transform.
- Location: colocated `*.test.ts` near sources.
- Coverage: `pnpm test` generates coverage; keep or improve existing coverage.
- Test style: small, focused cases; prefer deterministic inputs; mock Obsidian APIs as needed.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `build:`, `style:`). Releases are automated via semantic‑release.
- PR policy: This project generally does not accept PRs except obvious bug fixes, typos/docs, or items explicitly requested in issues/discussions (see `pull_request_template.md`). Open an issue/discussion first.
- PR content: clear description, linked issue, reproduction or before/after notes; attach screenshots only for UI-facing changes.

## Security & Configuration Tips
- Local dev vault: set `VAULT_DIR` in `esbuild.config.mjs` to your Obsidian vault to enable hot-copying during `pnpm dev`.
- External modules: Obsidian and Node builtins are marked external in bundling; avoid relying on unavailable runtime modules.
