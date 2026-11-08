# web-extension

Modern, flexible CLI tool to scaffold cross-browser extensions for Chromium (Chrome, Edge, Brave, Opera), Firefox, and Safari using **Vite + CRXJS** or **Zero-Build Vanilla mode**.

---

## Documentation

- [Developer Guide](DEVELOPER.md) — Architecture, local development, testing, and contribution instructions.
- [AI & Agent Specification](AI.md) — Complete behavioral contracts, machine-readable specifications, and capability matrices for AI agents and LLMs.

---

## Features

- **Dual Engine / Optional Bundler:** Choose between modern **Vite + CRXJS** (HMR, TypeScript, bundling) or lightweight **Zero-Build Vanilla mode** (direct "Load unpacked" without build steps).
- **Cross-Browser:** Supports Chromium (MV3), Firefox (MV3 & MV2), and Safari (MV3 & MV2).
- **Modular Components:** Choose only what you need (Background service worker, Content scripts, Popup, Options page, Side panel, DevTools page, New Tab override, declarativeNetRequest rules).
- **Content-Script Only Mode:** Purpose-built mode for DOM scrapers and injectors without unnecessary UI files.
- **Automatic Type & Package Setup:** Installs browser-specific types (`@types/chrome`, `@types/firefox-webext-browser`) and auto-configures TypeScript (`tsconfig`) or JavaScript (`jsconfig`).
- **Zero-Dependency Guarantee:** Vanilla JS mode generates clean, zero-dependency projects that run immediately.
- **Smart Package Manager Detection:** Automatically detects whether you ran via `bun`, `pnpm`, `npm`, or `yarn`.

---

## Quick Start

Run the interactive generator using your preferred package manager:

```bash
# npm
npx web-extension@latest init

# pnpm
pnpm dlx web-extension@latest init

# bun
bun x web-extension@latest init
# or bunx
bunx web-extension@latest init

# yarn (Yarn 2+)
yarn dlx web-extension@latest init

# Or install globally
npm install -g web-extension
web-extension init
```

> **Windows + Bun:** On some Windows systems, `bunx` may not be registered in PowerShell by default. Use `bun x web-extension@latest init` instead.
>
> **Shortcut:** Invoking `web-extension` without a subcommand automatically routes to `init`. For example, `web-extension my-app` is equivalent to `web-extension init my-app`.

---

## Interactive Prompts & Flags

Every interactive prompt has a corresponding CLI flag to enable scripted and non-interactive execution.

| # | Prompt | Flag | Options / Accepted Values | Default (`--yes`) |
|---|---|---|---|---|
| 1 | Project name | `[dir]`, `--name <string>` | Target directory and npm package name | `my-extension` |
| 1b | Directory not empty | `--if-exists <action>`, `--overwrite` | `cancel`, `overwrite`, `merge` | `cancel` |
| 2 | Language | `--lang <ts\|js>` | `ts` (TypeScript), `js` (JavaScript) | `ts` |
| 2b | Build tool / Bundler | `--bundler <vite\|none>`, `--vanilla`, `--no-bundler` | `vite`, `none` | `vite` |
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
| 9 | Install dependencies | `--install` / `--no-install` | Automatically run install | `--install` |
| 10 | Git repository | `--git` / `--no-git` | Initialize git repo | `--git` |
| - | Accept defaults | `--yes`, `-y` | Use defaults for any omitted options | - |
| - | Help | `--help`, `-h` | Display help message and options | - |
| - | Version | `--version`, `-v` | Display version | - |

---

## Common Recipes

### 1. Full Chromium TypeScript Extension
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

### 3. Headless Content-Script DOM Hacker
```bash
web-extension dom-injector --type content-only --browser chrome,firefox \
  --matches "https://*.github.com/*" --yes
```

### 4. Cross-Browser Extension (Chrome, Firefox, Safari)
```bash
web-extension multi-browser-ext --lang ts --browser chrome,firefox,safari \
  --firefox-mv 3 --safari-mv 2 --features background,content,popup --yes
```

### 5. Zero-Build Vanilla JavaScript Extension
```bash
web-extension my-vanilla-ext --bundler none --lang js --yes
```
Load the `my-vanilla-ext/` folder directly in `chrome://extensions` via **Load unpacked** — zero dependencies, zero build step!

---

## Loading Your Extension into Browsers

After creating your project, enter the directory and start the dev server:

```bash
cd my-extension
npm run dev:chrome
```

### Chromium (Chrome, Edge, Brave, Opera)
1. Navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `dist/chrome-mv3` folder inside your project.

### Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside `dist/firefox-mv3` (or `dist/firefox-mv2`).

### Safari
Convert the compiled web extension output into an Xcode project using Apple's built-in converter:
```bash
xcrun safari-web-extension-converter dist/safari-mv3
```

---

## License

[MIT](LICENSE)
