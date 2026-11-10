## Overview

`web-extension` v3.0.0 is a complete rewrite designed for cross-browser extensions (Chromium, Firefox, Safari) using `esbuild`. It eliminates complex bundler configurations, adopting a single source of truth: `manifest.json`.

---

## What's New in v3.0.0

### 1. Single Source of Truth (`manifest.json`)
- No bundler configuration files (`vite.config.*`, `manifest.config.*`, or `targets.config.*`).
- Point directly at source files (e.g. `src/background/index.ts` or `src/popup/index.html`) inside `manifest.json`; the compiler bundles entries and rewrites them to `.js` automatically.

### 2. Multi-Browser Compilation & Manifest Adaptation
- **Chrome / Chromium:** Manifest V3 with service worker and side panel support.
- **Firefox:** Automatic transformation of `background.service_worker` to `background.scripts`, `side_panel` to `sidebar_action`, and permission cleanup.
- **Safari:** Strips unsupported APIs with actionable warnings.
- **Browser Overlays:** Easily override settings per browser using `manifest.<browser>.json` (e.g., `manifest.firefox.json`).

### 3. Built-In Live Reload Dev Server
- `web-extension dev --browser <browser>` starts an internal HTTP long-polling reload server on an open port.
- Automatically rebuilds on changes in `src/`, `public/`, and `manifest*.json`, triggering instant extension reloads via a lightweight dev client wrapper.

### 4. MAIN-World Script Support
- First-class support for page-world scripts (`world: "MAIN"`) running inside the page context without extension permissions.
- Scaffolds safe communication between isolated content scripts and page context using `window.postMessage`.

### 5. Editor Schema Integration
- Ships official JSON Schemas for Chrome, Firefox, and Safari in `node_modules/web-extension/schemas/`.
- Provides IDE autocomplete and validation in `manifest.json` via `$schema`, stripped automatically from production builds.

### 6. Robust Test Suite & Playwright E2E Verification
- Complete test suite: 65 Vitest unit tests across flag parsing, manifest adaptation, and scaffolding.
- Full E2E browser testing in real Chromium via Playwright (`bun run test:e2e`).

---

## Quick Start

```bash
# Create a new cross-browser extension
bun x web-extension@latest my-extension --browser chrome,firefox --entries background,content,popup --lang ts

# Start development with live reload
cd my-extension
bun run dev

# Build for all target browsers
bun run build
```

---

## Documentation

- [README.md](https://github.com/TiwPhiraphan/web-extension#readme) — Getting started guide and CLI flags reference.
- [DEVELOPER.md](https://github.com/TiwPhiraphan/web-extension/blob/main/DEVELOPER.md) — Architecture guide, bundler pipeline, and dev server design.
- [AI.md](https://github.com/TiwPhiraphan/web-extension/blob/main/AI.md) — Deterministic parameter matrix, invariants, and agent contracts.

