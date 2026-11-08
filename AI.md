# web-extension: AI & Agent System Specification

This document provides a deterministic, complete, and unambiguous specification of the `web-extension` CLI. It is structured specifically for AI models, automated agents, and code generators to reason about and execute without guesswork.

---

## 1. System Overview & Invariants

- **Package Name:** `web-extension`
- **Binary Name:** `web-extension`
- **Runtime Target:** Node.js >= 20, Bun >= 1.0.0
- **CLI Architecture:** TypeScript source compiled via `tsup` to a single ESM bundle at `dist/index.js` with shebang `#!/usr/bin/env node`.
- **Primary Subcommand:** `init`
- **Default Subcommand Alias:** When invoked without a subcommand (or when the first argument is not recognized as a registered subcommand), the CLI implicitly routes to `init`. For example, `web-extension my-app --lang ts` is identical to `web-extension init my-app --lang ts`.
- **Top-Level Flags:** `--help` / `-h` and `--version` / `-v` are processed immediately and do not enter the `init` pipeline.

---

## 2. CLI Execution Modes & Contracts

### 2.1 Non-TTY (Scripted / CI) Contract
- If stdin or stdout is not a TTY (`!process.stdin.isTTY || !process.stdout.isTTY`), interactive prompts cannot be shown.
- Every required decision that lacks an explicit CLI flag or `--yes` default causes an immediate error with exit code `1`.
- When `--yes` (or `-y`) is provided, all omitted options fall back to their documented default values.

### 2.2 Interactive Contract
- Uses `@clack/prompts`.
- Any user cancellation (`Ctrl+C` or escape) invokes `p.cancel('Cancelled.')` and immediately terminates process with exit code `0`.
- If an option was supplied via CLI flag, its corresponding interactive prompt is skipped.

---

## 3. Flag Parsing & Parameter Matrix

All flags can be provided in kebab-case.

| Flag | Type | Allowed Values | Default Value (`--yes`) | Notes |
|---|---|---|---|---|
| `[dir]` | string (positional) | Any valid path or slug | `my-extension` | First positional argument after subcommand. |
| `--name` | string | Valid npm package name | Basename of `[dir]` or `my-extension` | Must be lowercase, no spaces, valid regex. |
| `--if-exists` | string | `cancel`, `overwrite`, `merge` | `cancel` | Action when target directory is not empty. |
| `--overwrite` | boolean | `true`, `false` | `false` | Convenience alias for `--if-exists overwrite`. |
| `--lang` | string | `ts`, `js` | `ts` | TypeScript or JavaScript. |
| `--bundler` | string | `vite`, `none` | `vite` | Build tool: Vite + CRXJS or Zero-Build Vanilla. |
| `--vanilla` | boolean | `true`, `false` | `false` | Shorthand for `--bundler none`. |
| `--no-bundler` | boolean | `true`, `false` | `false` | Alias for `--bundler none`. |
| `--type` | string | `full`, `content-only` | `full` | Full extension or headless content-script only. |
| `--browser` | string (repeatable/comma) | `chrome`, `firefox`, `safari` | `chrome` | Target browsers. `chromium` maps to `chrome`. |
| `--firefox-mv` | number / string | `2`, `3` | `3` | Firefox manifest version. |
| `--safari-mv` | number / string | `2`, `3` | `3` | Safari manifest version. |
| `--features` | string (comma) | `background`, `content`, `popup`, `options`, `sidepanel`, `dnr`, `devtools`, `newtab`, `none` | `background,content` | Available only in `full` mode. |
| `--matches` | string (comma) | WebExtension match patterns | `https://*/*` | Required pattern(s) when `content` is enabled. |
| `--run-at` | string | `document_start`, `document_end`, `document_idle` | `document_idle` | Content script execution timing. |
| `--world` | string | `ISOLATED`, `MAIN` | `ISOLATED` | MV3 only. Not permitted with MV2 targets. |
| `--css` / `--no-css` | boolean | `true`, `false` | `true` | Generate CSS stylesheet for content script. |
| `--extras` | string (comma) | `contextmenu`, `commands`, `omnibox`, `storage`, `none` | `none` | Additional helpers and boilerplate. |
| `--pm` | string | `npm`, `pnpm`, `yarn`, `bun` | Auto-detected | Force package manager selection. |
| `--install` / `--no-install` | boolean | `true`, `false` | `true` | Whether to automatically install dependencies. |
| `--git` / `--no-git` | boolean | `true`, `false` | `true` | Initialize a Git repository. |
| `--yes`, `-y` | boolean | `true`, `false` | `false` | Bypass prompts using default values. |
| `--help`, `-h` | boolean | `true`, `false` | `false` | Display help output and exit `0`. |
| `--version`, `-v` | boolean | `true`, `false` | `false` | Display package version and exit `0`. |

---

## 4. Validation Rules & Exit Behavior

The CLI enforces strict validation with exit code `1` upon invalid inputs or incompatible combinations:

### 4.1 Fatal Errors (Exit Code 1)
1. **Unrecognized Flag Value:** Any value outside the allowed set (e.g. `--browser edge` or `--lang ruby`) aborts with an error listing accepted values.
2. **Content-Only with Features/Extras:** Supplying `--type content-only` with `--features` or `--extras` is invalid. Content-only extensions contain only content scripts.
3. **Safari-Only Side Panel:** Specifying `--features sidepanel` when `--browser safari` is the only target is fatal because Safari does not support side panels.
4. **DNR with Manifest V2:** Specifying `--features dnr` while any target is MV2 is fatal.
5. **Extras without Background:** Specifying `--extras contextmenu`, `commands`, or `omnibox` without `background` in `--features` is fatal.
6. **Main World with Manifest V2:** Specifying `--world MAIN` while any target is MV2 is fatal.
7. **Directory Conflict:** Target directory exists and contains files, but `--if-exists` is `cancel` or unhandled.
8. **Invalid Package Name:** Package name does not conform to npm package naming rules (`/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/`).
9. **Invalid Match Pattern:** Pattern does not start with `http://`, `https://`, `*://`, `file://`, or `<all_urls>`.

### 4.2 Non-Fatal Warnings
The CLI prints warnings to stderr but continues execution when:
- `--firefox-mv` is passed without `firefox` in `--browser`.
- `--safari-mv` is passed without `safari` in `--browser`.
- `--bundler none` is passed with `safari` in `--browser` (warning about Xcode converter).
- Content script flags (`--matches`, `--run-at`, `--world`, `--css`) are passed when `content` feature is absent.
- `--git` is requested but the target directory is already inside an existing Git repository.

---

## 5. Browser Capabilities & Target Resolution

For each selected browser, the generator maps targets:
- `chrome` -> `chrome-mv3` (outDir: `dist/chrome-mv3`)
- `firefox` (MV3) -> `firefox-mv3` (outDir: `dist/firefox-mv3`)
- `firefox` (MV2) -> `firefox-mv2` (outDir: `dist/firefox-mv2`)
- `safari` (MV3) -> `safari-mv3` (outDir: `dist/safari-mv3`)
- `safari` (MV2) -> `safari-mv2` (outDir: `dist/safari-mv2`)

### 5.1 Capability Matrix

```text
Target         MV  Worker  Scripts  Popup           SidePanel       DNR    WorldMain
------------------------------------------------------------------------------------
chrome-mv3     3   Yes     No       action          side_panel      Yes    Yes
firefox-mv3    3   No      Yes      action          sidebar_action  Yes    Yes
firefox-mv2    2   No      Yes      browser_action  sidebar_action  No     No
safari-mv3     3   Yes     No       action          None            Yes    Yes
safari-mv2     2   No      Yes      browser_action  None            No     No
```

### 5.2 Manifest Structure Invariants
- **Chromium MV3:**
  - `background.service_worker = "src/background/index.(ts|js)"`
  - `action.default_popup = "src/popup/index.html"`
  - `side_panel.default_path = "src/sidepanel/index.html"`
  - `permissions` includes `"sidePanel"` when sidepanel feature is enabled.
- **Firefox MV3:**
  - `background.scripts = ["src/background/index.(ts|js)"]`
  - `action.default_popup = "src/popup/index.html"`
  - `sidebar_action.default_panel = "src/sidepanel/index.html"`
  - `browser_specific_settings.gecko.id = "<name>@example.com"`
  - `browser_specific_settings.gecko.strict_min_version = "109.0"`
  - Does NOT include `"sidePanel"` in `permissions`.
- **Firefox MV2:**
  - `manifest_version = 2`
  - `background.scripts = ["src/background/index.(ts|js)"]`, `background.persistent = false`
  - `browser_action.default_popup = "src/popup/index.html"`
  - `sidebar_action.default_panel = "src/sidepanel/index.html"`
  - `browser_specific_settings.gecko.id = "<name>@example.com"`
  - `browser_specific_settings.gecko.strict_min_version = "58.0"`
  - No `action`, `host_permissions`, or `declarative_net_request` keys.
- **Content-Only Mode:**
  - `manifest.content_scripts` is populated.
  - Manifest contains no `background`, `action`, `browser_action`, `options_ui`, or UI entries.
  - Contains no `permissions` array unless explicitly demanded.

---

## 6. Build Pipelines: MV3 vs MV2

Generated projects employ dual-mode packaging:

### 6.1 MV3 Pipeline (CRXJS)
- Handled by `@crxjs/vite-plugin` (`crx({ manifest: manifestConfig, browser })`).
- Full support for Vite HMR in popup, options, sidepanel, and content scripts on Chromium.
- Dev command: `vite` (or `vite build --watch` for Firefox/Safari).

### 6.2 MV2 Pipeline (Custom Standalone Bundler)
- `@crxjs/vite-plugin` is designed strictly for Manifest V3. When an MV2 target is active, the project does NOT pass MV2 manifests to CRXJS.
- Instead, the generator writes `build/mv2.(ts|js)` and registers `buildMv2Plugin` in `vite.config`.
- Build behavior:
  1. Compiles HTML entry points (`popup.html`, `options.html`, `devtools.html`, etc.) via Rollup inputs.
  2. Compiles content scripts and background scripts as standalone IIFE bundles (`formats: ['iife']`) so they can execute in classic MV2 runtimes without ES module loading limitations.
  3. Emits `dist/<target>/manifest.json` dynamically from `manifest.config`.

### 6.3 Zero-Build Vanilla Pipeline (`--bundler none`)
- Completely eliminates Vite, CRXJS, and build tools.
- **JavaScript Mode (`--lang js`):**
  - Zero-Dependency Guarantee: No dependencies or devDependencies in `package.json`.
  - Places `manifest.json`, `icons/`, and `src/` directly at the project root.
  - The project directory can be loaded unpacked into `chrome://extensions` immediately without any build command or dependency installation.
- **TypeScript Mode (`--lang ts`):**
  - Generates lightweight `tsconfig.json` utilizing pure `tsc` (`build: tsc`, `dev: tsc --watch`) compiling `src/` to `dist/`.
  - Static assets (`manifest.json`, `icons/`, HTML, CSS) are mirrored to `dist/`.
  - Chrome loads `dist/` directly after running `tsc`.

---

## 7. Package Manager Resolution Priority

When `--pm` is not explicitly supplied, package manager detection follows this deterministic order:

1. `process.env.npm_config_user_agent`:
   - Matches regex `/(npm|pnpm|yarn|bun)\/([^\s]+)/`.
   - Confident: `true`.
2. `packageManager` field:
   - Recursively scans parent directories for `package.json` with a valid `packageManager` entry (e.g. `pnpm@8.15.0`).
   - Confident: `true`.
3. Single Lockfile:
   - Recursively scans parent directories for lockfiles in priority: `bun.lock`/`bun.lockb` -> `pnpm-lock.yaml` -> `yarn.lock` -> `package-lock.json`.
   - If exactly one type is found: Confident: `true`.
   - If multiple competing lockfiles exist: picks highest priority with Confident: `false`.
4. Global Binary Path:
   - Inspects `process.argv[1]` for known global tool paths (`.bun`, `pnpm/global`, `Roaming/npm`, etc.).
   - Confident: `false`.
5. Bun Runtime Environment:
   - `typeof (globalThis as any).Bun !== 'undefined'`.
   - Confident: `false`.
6. Fallback:
   - Default: `npm`.
   - Confident: `false`.

When Confident is `false` in an interactive TTY session without `--pm`, the user is prompted to select their package manager with the detected value as the default.

---

## 8. Generated Project Structure

### Full Mode (TypeScript)
```text
my-extension/
├── public/
│   ├── icons/ (16.png, 48.png, 128.png)
│   └── rules/rules.json (if DNR enabled)
├── src/
│   ├── background/index.ts (if background enabled)
│   ├── content/
│   │   ├── index.ts (if content enabled)
│   │   └── style.css (if css enabled)
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   ├── options/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   ├── devtools/
│   │   ├── devtools.html
│   │   ├── devtools.ts
│   │   └── panel.html
│   ├── newtab/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   └── lib/
│       ├── browser.ts (Universal API accessor)
│       └── storage.ts (if storage extra enabled)
├── build/
│   └── mv2.ts (present if any target is MV2)
├── env.d.ts
├── manifest.config.ts
├── targets.config.ts
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.background.json (isolated worker types)
├── tsconfig.node.json
├── package.json
├── .gitignore
└── README.md
```

### Content-Only Mode (TypeScript)
```text
my-extension/
├── public/
│   └── icons/ (16.png, 48.png, 128.png)
├── src/
│   ├── content/
│   │   ├── index.ts (DOM Hack / MutationObserver)
│   │   └── style.css (if css enabled)
│   └── lib/
│       └── browser.ts
├── env.d.ts
├── manifest.config.ts
├── targets.config.ts
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── package.json
├── .gitignore
└── README.md
```

---

## 9. Verification & Invariant Testing

Automated testing must verify:
1. `bun run typecheck`: Strict compilation across all sources without errors.
2. `bun run test`: Vitest unit tests verifying arg parsing, validation, targets, manifests, and package manager heuristics.
3. `bun run test:smoke`: End-to-end smoke test suite executing five suites:
   - Suite A: Chromium MV3 (Full features, TS, DNR, extras).
   - Suite B: Firefox MV2 (JS, background scripts, `build/mv2`).
   - Suite C: Multi-browser (Chrome MV3, Firefox MV3, Safari MV2).
   - Suite D: Content-only TS (Chrome, Firefox).
   - Suite E: Content-only JS (Firefox MV2).

