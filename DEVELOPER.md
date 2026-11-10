# Developer Guide: web-extension v3

This guide provides architectural details, development workflows, and coding conventions for developers contributing to the `web-extension` CLI.

---

## 1. Architecture Overview

`web-extension` v3 is a cross-browser extension CLI powered directly by `esbuild`. It replaces multi-config bundlers with a single source of truth: `manifest.json`.

```text
src/
├── index.ts               Command router (init | dev | build), top-level error handling, exit codes
├── cli/
│   └── args.ts            CLI flag parsing (node:util parseArgs), validation, UsageError, help text
├── commands/
│   ├── init.ts            Interactive prompts (@clack/prompts) and non-interactive project scaffolding
│   ├── dev.ts             Dev mode: watch mode, file change debounce, live reload server
│   └── build.ts           Production builds across target browsers
├── core/
│   ├── manifest.ts        Manifest loading, deep-merge (manifest.<browser>.json), per-browser adaptation
│   ├── entries.ts         Manifest entry scanner, script/style collection, HTML script/link rewriting
│   ├── bundle.ts          esbuild bundling pipeline (IIFE), CSS bundling, dev client injection
│   └── devserver.ts       Lightweight HTTP long-polling reload server
├── scaffold/
│   ├── generate.ts        Project file tree generation, dynamic manifest.json and package.json builders
│   └── templates.ts       Shared source templates for TypeScript and JavaScript projects
└── utils/
    └── pm.ts              Package manager detection (bun, pnpm, yarn, npm) and runner commands
schemas/                   Official JSON Schemas for Chrome, Firefox, and Safari manifests
scripts/
    └── build.mjs          Build script compiling src/index.ts to dist/index.js with esbuild
test/
├── args.test.ts           Unit tests for CLI flag parsing and validation
├── build.test.ts          Integration tests for extension bundling and CSS extraction
├── cli.test.ts            CLI process execution tests (help, version, validation, errors)
├── devserver.test.ts      Tests for reload server and client behavior in a VM
├── entries.test.ts        Tests for entry point detection and HTML rewriting
├── generate.test.ts       Tests for project scaffolding, templates, and manifest generation
├── manifest.test.ts       Tests for cross-browser manifest transformations
├── pm.test.ts             Tests for package manager detection heuristics
├── helpers.ts             Shared test utilities and temporary directory creators
└── e2e/
    ├── chromium.cjs       Browser-level E2E tests in real Chromium via Playwright
    └── run.mjs            Automated E2E test runner that scaffolds, builds, and tests in Chromium
```

---

## 2. Prerequisites & Toolchain

- **Node.js:** `>= 20.0.0`
- **Bun:** `>= 1.0.0` (Bun is the designated package manager and runtime)
- **Playwright:** Installed in `devDependencies` for headless Chromium E2E verification
- **Bundler:** Internal `esbuild` for compiling user extensions and building `dist/index.js`

---

## 3. Development Workflow

### 3.1 Install Dependencies
```bash
bun install
```

### 3.2 Watch Mode (Active Development)
```bash
bun run dev
```

### 3.3 Build Production CLI
```bash
bun run build
```
This builds `src/index.ts` into `dist/index.js` with shebang `#!/usr/bin/env node` and executable permissions.

### 3.4 Typecheck
```bash
bun run typecheck
```

### 3.5 Run Unit & Integration Tests
```bash
bun run test
```
Runs the full Vitest suite (8 test files, 65 tests). Vitest automatically invokes `scripts/build.mjs` before running CLI tests.

### 3.6 Run Browser End-to-End Tests
```bash
bun run test:e2e
```
Runs the automated E2E test runner in real headless Chromium via Playwright. It scaffolds a full extension project in an isolated environment, verifies service worker registration, content script injection, MAIN-world message passing, popup rendering, hot rebuilds, and live extension reloads.

### 3.7 Verify Package Contents
```bash
npm pack --dry-run
```
Triggers the `prepack` script automatically to compile `dist/index.js` and outputs the exact tarball contents (7 files: LICENSE, README.md, dist/index.js, package.json, and the 3 browser schemas).

---

## 4. Core Concepts & Implementation Details

### 4.1 Manifest as the Single Source of Truth
Generated projects do not use bundler configuration files (`vite.config`, `webpack.config`, etc.). Every script, stylesheet, and HTML page referenced in `manifest.json` is discovered and bundled automatically:
- HTML pages (`action.default_popup`, `options_ui.page`, `side_panel.default_path`, `newtab`, etc.) are scanned for `<script src="...">` and `<link rel="stylesheet">`.
- TypeScript and JavaScript paths are resolved relative to the project root and rewritten to `.js` in the output manifest and HTML.

### 4.2 Entry Collection & Bundling
- Scripts are bundled into self-contained `iife` bundles targeting `es2022`.
- CSS imported inside scripts (e.g., `import './style.css'`) is extracted by esbuild and automatically wired into `content_scripts.css` or injected as a `<link>` in the corresponding HTML `<head>`.
- Static assets placed in `public/` are copied to `dist/<browser>/` untouched.

### 4.3 Multi-Browser Manifest Adaptation
Source manifests can be overridden per browser using `manifest.<browser>.json` (e.g. `manifest.firefox.json`):
- **Deep Merge:** Objects merge recursively; arrays and primitives are replaced.
- **Chrome:** Strips `$schema` and `browser_specific_settings`.
- **Firefox:** Converts `background.service_worker` to `background.scripts`, converts `side_panel` to `sidebar_action`, removes `sidePanel` permission, and warns if `gecko.id` is missing.
- **Safari:** Strips `side_panel` and `sidePanel` permission with a warning.
- Only Manifest V3 is supported.

### 4.4 Dev Server & Live Extension Reload
- When running `web-extension dev --browser <browser>`, an HTTP long-polling server is started on a free port (`/__reload`).
- In dev mode, a reload client script (`web-extension-dev/reload.js`) is injected into the extension background context (`web-extension-dev/sw.js` for Chromium/Safari, or appended to `background.scripts` for Firefox).
- The client polls the reload server. When file changes trigger a rebuild, the reload server increments its version counter, releasing waiting clients to invoke `chrome.runtime.reload()`.

---

## 5. Coding Standards & Conventions

- **TypeScript Strictness:** Strict mode is enforced in `tsconfig.json`. Do not introduce untyped `any` or disable strict null checks.
- **Documentation:** Provide JSDoc comments for all exported functions, types, and interfaces.
- **No Decorative Symbols:** Do not use emojis in source code, console output, or documentation.
- **Cross-Platform Compatibility:** Always use POSIX path separators (`/`) for paths inside manifests and HTML files. When processing filesystem paths on Windows, use `path.posix` or normalize with `.replace(/\\/g, '/')`.
- **Non-Interactive Contract:** Every interactive prompt must have an equivalent CLI flag. In non-TTY environments without `--yes`, missing flags must produce an error listing the missing flags and exit with code `1`.
- **Directory Protection:** `init` must never write into a non-empty directory.
- **MAIN-World Isolation:** MAIN-world scripts run in the page context and must never import `webextension-polyfill` or reference extension APIs (`chrome.*` or `browser.*`).

---

## 6. Publishing & Release Process

- **Automated Publishing Workflow:** Located at `.github/workflows/publish.yml`. Triggered automatically when a GitHub Release is published (`on: release`). It executes tests, builds the distribution bundle, and publishes to npm with `--provenance --access=public`.
- **Automated CI Workflow:** Located at `.github/workflows/ci.yml`. Runs on all pull requests and pushes to `main`.
- **Lifecycle Prepack:** `package.json` includes `"prepack": "node scripts/build.mjs"`, guaranteeing that `dist/index.js` is freshly built before `npm pack` or `npm publish`.
- **Registry Permissions:** The package name `web-extension` on npm has previous unpublish records; live publishing requires ownership authorization on npmjs.org.
