# @tofrankie/clean

[![npm version](https://img.shields.io/npm/v/@tofrankie/clean.svg)](https://www.npmjs.com/package/@tofrankie/clean) [![node version](https://img.shields.io/node/v/@tofrankie/clean.svg)](https://nodejs.org) [![npm package license](https://img.shields.io/npm/l/@tofrankie/clean.svg)](https://github.com/tofrankie/clean/blob/main/LICENSE) [![npm last update](https://img.shields.io/npm/last-update/@tofrankie/clean.svg)](https://www.npmjs.com/package/@tofrankie/clean)

Clean `node_modules`, `dist` and tool cache files (e.g. eslint/stylelint/prettier/turbo/tsbuildinfo). Support for pnpm monorepos.

## Installation

> Requires **Node.js >= 18**

Global install is recommended:

```bash
$ pnpm add @tofrankie/clean -g
```

## Commands

- `clean modules`: remove dependency directories `node_modules`
- `clean dist`: remove build output directories `dist`
- `clean cache`: remove cache files

```bash
# Clean node_modules, dist, and caches
$ clean --all

# Preview paths that would be deleted (no deletion)
$ clean --all --dry-run

# Only clean node_modules
$ clean modules

# Only clean dist
$ clean dist

# Only clean caches
$ clean cache
```

Shortcut binaries:

- `clean-modules` → `clean modules`
- `clean-dist` → `clean dist`
- `clean-cache` → `clean cache`
- `clean-all` → `clean --all`

Notes:

- Usually you run cleanup next to `package.json`. You can also run it from a subdirectory; the tool walks up to the nearest `package.json` and cleans from there.
- For pnpm monorepos, add `-r` or `--recursive` to recurse into workspace packages.

## Options

- `--cwd <path>`: set the project directory (**not recommended—risk of deleting the wrong files**)
- `--root`: walk up to the workspace root, then run (for monorepos)
- `--all`: run modules + dist + cache (when no subcommand is given)
- `--dry-run`: print matched paths and counts (deletable/skipped) only; no deletion
- `--print-forbidden-dirs`: print directories that must not be deleted (including the current user’s home) and exit
- `--recursive` / `-r`: recurse (per subcommand above); with **`clean --all`**, applies to **modules** and **dist** target collection
- `--no-modules`: do not remove `node_modules` directories
- `--no-dist`: do not remove `dist` directories
- `--no-cache`: do not remove caches
- `--no-eslint`: do not remove eslint caches
- `--no-stylelint`: do not remove stylelint caches
- `--no-prettier`: do not remove prettier caches
- `--no-turbo`: do not remove turbo caches
- `--no-ts-build-info`: do not remove tsbuildinfo-related caches
- `--module-target <target>`: append extra `node_modules` delete targets (repeatable; comma-separated in one value, e.g. `a,b`)
- `--dist-target <target>`: append extra `dist` delete targets (repeatable; comma-separated in one value, e.g. `build,dist`)
- `--cache-target <target>`: append extra cache delete targets (repeatable; comma-separated in one value)

## License

MIT
