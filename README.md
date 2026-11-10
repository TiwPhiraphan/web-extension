# web-extension

Scaffold and build cross-browser extensions (Chromium, Firefox, Safari) with esbuild.
One `manifest.json` is the only configuration. There is no bundler config to maintain.

Version 3 is a rewrite. It is not compatible with 2.x projects (see [Migrating](#migrating-from-2x)).

## Create a project

Run the CLI with your package manager's runner:

| Package manager | Command |
|---|---|
| npm | `npm x web-extension@latest` (or `npx web-extension@latest`) |
| pnpm | `pnpm dlx web-extension@latest` |
| yarn (Berry, 2+) | `yarn dlx web-extension@latest` |
| bun | `bun x web-extension@latest` |

`pnpm x` does not work (pnpm treats it as a script name) and Yarn 1 has no `dlx`.

The CLI asks for: project directory, target browsers, what the extension contains, content script match patterns (when needed), language, and whether to install dependencies and run `git init`.
It refuses to write into a directory that is not empty.

Every question has a flag, so it also runs without a terminal:

```bash
npx web-extension@latest my-ext \
  --browser chrome,firefox \
  --entries background,content,main-world,popup \
  --matches 'https://example.com/*' \
  --lang ts --pm npm --install --git
```

| Flag | Meaning |
|---|---|
| `--name <name>` | package name (default: directory name) |
| `--browser <list>` | `chrome`, `firefox`, `safari` (`chromium` = `chrome`) |
| `--entries <list>` | `background`, `content`, `main-world`, `popup`, `options`, `sidepanel`, `newtab`, `none` |
| `--lang <ts\|js>` | language |
| `--matches <patterns>` | content script match patterns |
| `--pm <npm\|pnpm\|yarn\|bun>` | package manager (default: detected from how the CLI was started, then lockfiles) |
| `--install` / `--no-install` | install dependencies |
| `--git` / `--no-git` | `git init` (skipped inside an existing repository) |
| `-y, --yes` | use defaults for anything not given: chrome, background + content, TypeScript, install, git |
| `-h, --help` | show help |
| `-v, --version` | show version |

Without a terminal and without `--yes`, missing answers are listed and the command exits with code 1.

## What you get

```text
my-ext/
├─ src/
│  ├─ background/index.ts     only the entries you picked
│  ├─ content/index.ts
│  ├─ main-world/index.ts     content script in the page's own context
│  ├─ popup/ options/ sidepanel/ newtab/   index.html + main.ts + style.css
│  └─ lib/browser.ts          webextension-polyfill
├─ public/                    copied to the output as is (put icons here)
├─ manifest.json              the only config
├─ package.json  tsconfig.json  README.md  .gitignore
```

The scripts are `dev`, `build`, `dev:<browser>`, `build:<browser>` and, for TypeScript, `typecheck`.

## Commands in a project

```bash
web-extension dev   [--browser chrome|firefox|safari] [--port <n>]
web-extension build [--browser chrome,firefox,safari] [--no-minify] [--sourcemap]
```

Output goes to `dist/<browser>`.

- **dev** builds, watches `src/`, `manifest*.json`, HTML pages and `public/`, and reloads the extension after each build.
  Load `dist/<browser>` once as an unpacked extension.
  Pages that already had a content script keep the old one until you refresh them.
- **build** cleans the output folder and writes a production build.

## How the build works

- Scripts, stylesheets and HTML pages are found from `manifest.json` and from the `<script src>` and `<link rel="stylesheet">` tags of the pages it references. You can reference TypeScript files directly; the output manifest points at the bundled `.js`.
- Each script is bundled to a single file (IIFE) by esbuild. CSS imported from a script is emitted next to it and wired into the manifest (content scripts) or the page (HTML).
- `manifest.<browser>.json` is merged over `manifest.json` for that browser (objects merge, arrays replace).
- Per browser:
  - **Chrome**: removes `$schema` and `browser_specific_settings`.
  - **Firefox**: `background.service_worker` becomes `background.scripts`, `side_panel` becomes `sidebar_action`, `sidePanel` permission is removed; warns when `browser_specific_settings.gecko.id` is missing.
  - **Safari**: removes `side_panel` with a warning. Convert the output with `xcrun safari-web-extension-converter dist/safari`.
- Only Manifest V3 is supported.

### MAIN-world scripts

A content script with `"world": "MAIN"` runs in the page's JavaScript context, so it can patch page globals such as `XMLHttpRequest`. It has no extension APIs and must not import `webextension-polyfill`. Send data to an isolated content script with `window.postMessage`; the generated templates show the pattern.

### Editor support

`manifest.json` gets a `$schema` that points into `node_modules/web-extension/schemas/` (Chrome, Firefox and Safari schemas). The schemas are permissive: unknown keys and unknown permission names are not errors.

## Migrating from 2.x

Version 3 drops Vite, CRXJS, Manifest V2 output, the `targets.config` and `manifest.config` files and most of the 2.x flags. To move a project, create a new one with `web-extension@latest`, copy your `src/` over, and put your manifest fields into `manifest.json`.

## Development of this tool

```bash
bun install
bun run typecheck
bun run test
bun run build
```

`node test/e2e/chromium.cjs <project>` is an optional check in a real Chromium; see the header of that file.

MIT
