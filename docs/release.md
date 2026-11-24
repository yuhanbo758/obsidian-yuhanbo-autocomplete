# Release workflow

Push plugin code to main, or manually run the Auto release Obsidian plugin workflow. It installs the locked dependencies, synchronizes versions, runs tests and builds, commits version files and main.js, publishes an exact-version Release, and creates artifact attestations.

If the manifest version already exists as a tag or release, the patch version increases automatically. An unused explicit version is preserved. Documentation-only changes do not trigger releases. The plugin never updates itself; after community admission, users use the normal Obsidian update UI.

The original author granted [public permission](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/issues/388#issuecomment-6891400600). The plugin is [listed in the Obsidian Community directory](https://community.obsidian.md/plugins/autocomplete). After each release, verify that the directory has scanned the intended version.
