# web-extension: AI & Automated Agent System Specification

This document provides a deterministic, complete, and unambiguous specification of the `web-extension` CLI (version 3.x). It is structured specifically for AI models, automated coding agents, and code generators.

---

## 1. System Overview & Invariants

- **Package Name:** `web-extension`
- **Binary Name:** `web-extension`
- **Target Runtime:** Node.js >= 20.0.0, Bun >= 1.0.0
- **Internal Bundler:** `esbuild` compiling entries directly to IIFE formats. No bundler config files are generated in user projects.
- **Manifest Architecture:** Only Manifest V3 is supported. `manifest.json` is the sole source of truth for entries and extension configuration.
- **Commands:**
  1. `init` (default): Scaffolds a new extension project.
  2. `dev`: Watches files, builds `dist/<browser>`, runs a long-poll reload server, and live-reloads the extension.
  3. `build`: Produces production bundles in `dist/<browser>`.
- **Top-Level Flags:**
  - `-h`, `--help`: Prints command help and exits `0`.
  - `-v`, `--version`: Prints package version and exits `0`.

---

## 2. CLI Execution Modes & Contracts

### 2.1 Non-Interactive (CI / Scripted) Contract
- If stdin or stdout is not a TTY (`!process.stdin.isTTY || !process.stdout.isTTY`), the CLI operates in non-interactive mode.
- If `--yes` (or `-y`) is NOT provided, any missing configuration produces an error listing the missing flags and exits with code `1`.
- When `--yes` is provided, all omitted options fall back to their documented default values:
  - `--browser`: `chrome`
  - `--entries`: `background,content`
  - `--lang`: `ts`
  - `--install`: `true`
  - `--git`: `true`
  - Target directory: `my-extension` (if neither directory nor name is specified)

### 2.2 Interactive Contract
- Uses `@clack/prompts`.
- Any user cancellation terminates the process immediately with message `Cancelled.` and exit code `0`.
- Supplying a CLI flag skips only its corresponding interactive prompt.

---

## 3. Subcommand Specifications & Parameter Matrix

### 3.1 `init` (Project Scaffolding)

Usage:
```bash
web-extension [init] [dir] [options]
```

When invoked without a known command (e.g. `web-extension my-app`), it routes directly to `init`.

| Flag | Type | Allowed Values | Default Value | Notes |
|---|---|---|---|---|
| `[dir]` | string (positional) | Valid path | `my-extension` | Target directory. Must not exist or must be empty. |
| `--name` | string | Valid npm package name | Directory basename | Lowercase letters, digits, and `- . _ ~` only. Scoped names (`@scope/pkg`) supported. |
| `--browser` | string (repeatable/comma) | `chrome`, `firefox`, `safari` | `chrome` | Target browsers. `chromium` is an alias for `chrome`. Duplicates dropped. |
| `--entries` | string (repeatable/comma) | `background`, `content`, `main-world`, `popup`, `options`, `sidepanel`, `newtab`, `none` | `background,content` | Extension components. `none` clears all entries. |
| `--lang` | string | `ts`, `js` | `ts` | Programming language (`typescript` maps to `ts`, `javascript` maps to `js`). |
| `--matches` | string (repeatable/comma) | Match patterns | `https://*/*` | Required pattern(s) when `content` or `main-world` is selected. |
| `--pm` | string | `npm`, `pnpm`, `yarn`, `bun` | Detected | Package manager. Detected from `npm_config_user_agent`, then lockfiles, defaults to `npm`. |
| `--install` / `--no-install` | boolean | `true`, `false` | `true` | Install dependencies after scaffolding. Mutually exclusive. |
| `--git` / `--no-git` | boolean | `true`, `false` | `true` | Initialize git repository. Skipped inside an existing repo. Mutually exclusive. |
| `-y`, `--yes` | boolean | `true`, `false` | `false` | Use defaults for any unspecified option. |
| `-h`, `--help` | boolean | `true`, `false` | `false` | Print help and exit `0`. |
| `-v`, `--version` | boolean | `true`, `false` | `false` | Print version and exit `0`. |

### 3.2 `dev` (Watch & Live Reload)

Usage:
```bash
web-extension dev [options]
```

Watches `src/`, `public/`, and `manifest*.json`, rebuilds to `dist/<browser>`, and triggers browser reload.

| Flag | Type | Allowed Values | Default Value | Notes |
|---|---|---|---|---|
| `--browser` | string | `chrome`, `firefox`, `safari` | `chrome` | Watches exactly one browser at a time. Multiple browsers throw `UsageError`. |
| `--port` | number / string | `0` to `65535` | `0` (any free port) | Port for HTTP long-polling reload server. |
| `-h`, `--help` | boolean | `true`, `false` | `false` | Print help and exit `0`. |

### 3.3 `build` (Production Build)

Usage:
```bash
web-extension build [options]
```

Cleans and compiles production output to `dist/<browser>`.

| Flag | Type | Allowed Values | Default Value | Notes |
|---|---|---|---|---|
| `--browser` | string (repeatable/comma) | `chrome`, `firefox`, `safari` | `chrome` | One or more target browsers. |
| `--no-minify` | boolean | `true`, `false` | `false` (minify on) | Disables minification for readable output. |
| `--sourcemap` | boolean | `true`, `false` | `false` | Generates `.js.map` sourcemaps. |
| `-h`, `--help` | boolean | `true`, `false` | `false` | Print help and exit `0`. |

---

## 4. Validation Rules & Exit Codes

### 4.1 Exit Code `0`
- Normal successful completion of `init` or `build`.
- User cancellation (`Ctrl+C` in interactive prompt).
- `--help` or `--version` requested.

### 4.2 Exit Code `1` (`UsageError` or Runtime Failure)
- **Directory Not Empty:** Target directory exists and contains at least one entry.
- **Invalid Package Name:** Fails `/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/`.
- **Invalid Browser Name:** Any value other than `chrome`, `chromium`, `firefox`, `safari`.
- **Invalid Entry Name:** Any value other than the defined entry keys or `none`.
- **Safari Side Panel:** Supplying `sidepanel` when `safari` is the only target browser.
- **Invalid Match Pattern:** Pattern does not match `/^(?:<all_urls>|(?:\*|https?|wss?|ftp|file):\/\/[^/]*\/.*)$/`.
- **Conflicting Flags:** Passing both `--install` and `--no-install`, or both `--git` and `--no-git`.
- **Non-Interactive Missing Flags:** Running without a TTY and without `--yes` while required flags are missing.
- **Manifest Missing:** Running `dev` or `build` outside a directory containing `manifest.json`.
- **Build Failure:** Compilation errors from esbuild.

---

## 5. Multi-Browser Manifest Adaptation Protocol

During `dev` and `build`, the CLI loads `manifest.json` from the project root and executes the following deterministic transformations:

1. **Manifest Overlay:** If `manifest.<browser>.json` exists, it is merged over `manifest.json` using `deepMerge` (objects merge recursively, arrays and scalars replace).
2. **Schema Removal:** `$schema` is removed from output manifests.
3. **Manifest Version Check:** Warns if `manifest_version !== 3`.
4. **Chrome:**
   - Deletes `browser_specific_settings`.
   - Keeps `background.service_worker`.
5. **Firefox:**
   - Deletes `minimum_chrome_version`.
   - Converts `background.service_worker` to `background.scripts: [service_worker]`.
   - Converts `side_panel.default_path` to `sidebar_action: { default_title, default_panel }`.
   - Removes `sidePanel` permission from `permissions`.
   - Warns if `browser_specific_settings.gecko.id` is not defined.
6. **Safari:**
   - Deletes `minimum_chrome_version`.
   - Deletes `side_panel` and warns that side panels are unsupported in Safari.
   - Removes `sidePanel` permission from `permissions`.
7. **Empty Permissions Cleanup:** If `permissions` is an empty array, the key is deleted.

---

## 6. Generated Project File Tree Specifications

When scaffolding a project with all entries (`ctx.lang === 'ts'`), the output structure is:

```text
<dir>/
├── manifest.json
├── package.json
├── .gitignore
├── tsconfig.json (or jsconfig.json)
├── README.md
├── public/
│   └── .gitkeep
└── src/
    ├── lib/
    │   └── browser.ts (or browser.js)
    ├── background/
    │   └── index.ts
    ├── content/
    │   └── index.ts
    ├── main-world/
    │   └── index.ts
    ├── popup/
    │   ├── index.html
    │   ├── main.ts
    │   └── style.css
    ├── options/
    │   ├── index.html
    │   ├── main.ts
    │   └── style.css
    ├── sidepanel/
    │   ├── index.html
    │   ├── main.ts
    │   └── style.css
    └── newtab/
        ├── index.html
        ├── main.ts
        └── style.css
```

### 6.1 Rules for Generated Files
- **MAIN-World Scripts:** Must execute in page context (`world: "MAIN"`). Must **never** import `webextension-polyfill` or call `chrome.*` / `browser.*`. Communicates with isolated content scripts exclusively via `window.postMessage`.
- **TypeScript and JavaScript Parity:** Generated code templates share identical logic; only type annotations and file extensions differ (`.ts` vs `.js`).
- **No Leading Underscores:** Output folders must not start with `_` (reserved by Chromium). Development files live under `web-extension-dev/`.
