# Contributing

Use Node.js 24 and pnpm 10.4.0. Install dependencies with the frozen lockfile and run the repository checks before submitting a change.

```sh
pnpm install --frozen-lockfile
pnpm verify
```

Use a separate test vault. For input and indexing changes, exercise whole-phrase IME commits, incremental typing, popout windows, and input during background indexing. Include the operating system, Obsidian version, and minimal reproduction in bug reports. Use sample notes that can be shared publicly.

Keep personal settings, completion history, and diagnostic reports outside contributed patches. Edit sources under `src/` and let the build generate `main.js`. See [the release workflow](docs/release.md) for packaging and update verification.
