# web-extension

Modern, flexible CLI tool to scaffold cross-browser extensions for Chromium (Chrome, Edge, Brave, Opera), Firefox, and Safari using **Vite** and **CRXJS**.

## Features

- **Vite + CRXJS:** Ultra-fast bundling, live reloading, and HMR (Hot Module Replacement) where supported.
- **Cross-Browser:** Supports Chromium (MV3), Firefox (MV3 & MV2), and Safari (MV3 & MV2).
- **Modular Components:** Choose only what you need (Background service worker, Content scripts, Popup, Options page, Side panel, DevTools page, New Tab override, declarativeNetRequest rules).
- **Content-Script Only Mode:** Purpose-built mode for DOM scrapers and injectors without unnecessary UI files.
- **Automatic Type & Package Setup:** Installs browser-specific types (`@types/chrome`, `@types/firefox-webext-browser`) and auto-configures TypeScript (`tsconfig`) or JavaScript (`jsconfig`).
- **Smart Package Manager Detection:** Automatically detects whether you ran via `bun`, `pnpm`, `npm`, or `yarn`.

---

## Usage

```bash
# npm
npx web-extension@latest init

# pnpm
pnpm dlx web-extension@latest init

# yarn (Yarn 2+)
yarn dlx web-extension@latest init

# bun
bunx web-extension@latest init
bun x web-extension@latest init

# Or install globally
npm install -g web-extension
web-extension init
```

> **Windows + Bun:** On some Windows machines, the `bunx` command may not be available in PowerShell by default. Use `bun x web-extension@latest init` instead (`bunx` is an alias of `bun x`).
>
> **Yarn Note:** `yarn dlx` is supported in Yarn 2 (Berry) and newer. For Yarn 1 (Classic), use `npx web-extension@latest init`.

Calling `web-extension` without a subcommand runs `web-extension init` directly:
```bash
web-extension my-app --lang ts
# Same as:
web-extension init my-app --lang ts
```

---

## Interactive Prompts & Flags

Every interactive prompt has a corresponding CLI flag to enable non-interactive and scripted execution.

| # | Prompt | Flag | Options / Accepted Values | Default (`--yes`) |
|---|---|---|---|---|
| 1 | Project name | `[dir]`, `--name <string>` | Target directory and npm package name | `my-extension` |
| 1b | Directory not empty | `--if-exists <action>`, `--overwrite` | `cancel`, `overwrite`, `merge` | `cancel` (exit 1) |
| 2 | Language | `--lang <ts\|js>` | `ts` (TypeScript), `js` (JavaScript) | `ts` |
| 3 | Project type | `--type <full\|content-only>` | `full`, `content-only` | `full` |
| 4 | Target browsers | `--browser <browsers>` | `chrome`, `firefox`, `safari` (comma-separated or repeated) | `chrome` |
| 5 | Manifest version (Firefox) | `--firefox-mv <2\|3>` | `2`, `3` | `3` |
| 5b | Manifest version (Safari) | `--safari-mv <2\|3>` | `2`, `3` | `3` |
| 6 | Features (Full mode) | `--features <list>` | `background`, `content`, `popup`, `options`, `sidepanel`, `dnr`, `devtools`, `newtab` (or `none`) | `background,content` |
| 7 | Content script: matches | `--matches <patterns>` | Comma-separated match patterns (`https://*/*`, etc.) | `https://*/*` |
| 7 | Content script: run_at | `--run-at <timing>` | `document_start`, `document_end`, `document_idle` | `document_idle` |
| 7 | Content script: world | `--world <world>` | `ISOLATED`, `MAIN` (MV3 only) | `ISOLATED` |
| 7 | Content script: CSS | `--css` / `--no-css` | Generate CSS stylesheet for content script | `--css` |
| 8 | Extras | `--extras <list>` | `contextmenu`, `commands`, `omnibox`, `storage` (or `none`) | `none` |
| 9a | Package manager | `--pm <pm>` | `npm`, `pnpm`, `yarn`, `bun` | Auto-detected |
| 9 | Install dependencies | `--install` / `--no-install`| Automatically run install | `--install` |
| 10 | Git repository | `--git` / `--no-git` | Initialize git repo | `--git` |
| - | Accept defaults | `--yes`, `-y` | Use defaults for any omitted options | - |
| - | Help | `--help`, `-h` | Display help message and options | - |
| - | Version | `--version`, `-v` | Display version | - |

### Flag Validation Rules

- **Invalid Values:** An unlisted value (e.g. `--browser edge`) triggers an immediate error message listing valid options and exits with status 1.
- **Impossible Combinations (exit 1):**
  - `--type content-only` combined with `--features` or `--extras`.
  - `--features sidepanel` when targeting only `safari`.
  - `--features dnr` while any target is Manifest V2.
  - `--extras contextmenu,commands,omnibox` without `background` in features.
  - `--world MAIN` while any target is Manifest V2.
- **Warnings (non-fatal):**
  - Specifying `--firefox-mv` without `firefox` in target browsers.
  - Specifying `--safari-mv` without `safari` in target browsers.
  - Specifying content script options (`--matches`, etc.) when `content` feature is not selected.
  - Initializing git when already inside an existing git repository.

### Non-TTY Behavior (CI/CD)

- When running without a TTY (such as in CI or automated pipelines), any required unanswered prompt causes the CLI to exit with code 1 and display the missing flags.
- To run unattended in CI, supply `--yes` or pass all necessary flags explicitly.

---

## Non-Interactive Examples

### 1. Chromium TypeScript Extension with Full Features
```bash
web-extension my-chrome-ext --lang ts --browser chrome \
  --features background,content,popup,options,sidepanel,dnr \
  --extras storage,commands --yes
```

### 2. Firefox Manifest V2 JavaScript Extension
```bash
web-extension my-firefox-ext --lang js --browser firefox --firefox-mv 2 \
  --features background,content,popup,options --yes
```

### 3. Content-Script Only DOM Hacker
```bash
web-extension dom-injector --type content-only --browser chrome,firefox \
  --matches "https://*.github.com/*" --yes
```

---

## Package Manager Detection

`web-extension` automatically resolves the appropriate package manager using the following priority:

1. **Explicit Flag:** `--pm <npm|pnpm|yarn|bun>` overrides all signals.
2. **User Agent:** Reads `process.env.npm_config_user_agent` (set when running via `npx`, `pnpm dlx`, `yarn dlx`, `bunx`, or `bun x`).
3. **`packageManager` Field:** Searches for `packageManager` in parent `package.json` files.
4. **Lockfiles:** Searches up parent directories for `bun.lock`/`bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`.
5. **Global Binary Path:** Detects if running from global directories (`.bun`, `pnpm/global`, etc.). In interactive mode, prompts to confirm.
6. **Runtime Environment:** Checks for Bun runtime.
7. **Fallback:** Defaults to `npm`.

---

## Browser Capability Matrix

| Feature | Chromium (MV3) | Firefox (MV3) | Firefox (MV2) | Safari (MV3) | Safari (MV2) |
|---|---|---|---|---|---|
| Background | `service_worker` | `scripts` (event page) | `scripts` (persistent: false) | `service_worker` | `scripts` |
| Content Scripts | Yes (ES Module/IIFE) | Yes | Yes (IIFE standalone) | Yes | Yes (IIFE standalone) |
| Popup | `action` | `action` | `browser_action` | `action` | `browser_action` |
| Options | `options_ui` | `options_ui` | `options_ui` | `options_ui` | `options_ui` |
| Side Panel | `side_panel` | `sidebar_action` | `sidebar_action` | Not supported | Not supported |
| DeclarativeNetRequest | Yes | Yes | Not supported | Yes | Not supported |
| DevTools Page | Yes | Yes | Yes | Converted | Converted |
| New Tab Override | Yes | Yes | Yes | Converted | Converted |
| Content `world: MAIN` | Yes | Yes | Not supported | Yes | Not supported |

---

## Known Constraints & Notes

1. **Firefox Dev Mode:** HMR with CRXJS is designed for Chromium extension reload APIs; Firefox uses `vite build --watch` for development (`npm run dev:firefox`).
2. **Safari Conversion:** Safari extensions are generated with standards-compliant output and converted for Xcode using Apple's built-in converter:
   ```bash
   xcrun safari-web-extension-converter dist/safari-mv3
   ```
3. **Manifest V2 Pipeline:** Uses our dedicated `build/mv2` bundler to package content scripts and background scripts into self-contained IIFE bundles compatible with classic MV2 environments.

---

## Development

```bash
# Install dependencies
bun install

# Build CLI binary
bun run build

# Run unit tests
bun run test

# Run end-to-end smoke tests (Suites A - E)
bun run test:smoke

# Typecheck CLI source
bun run typecheck
```

## License

[MIT](LICENSE)

