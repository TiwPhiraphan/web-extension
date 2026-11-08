## Overview

`web-extension` v2.1.0 introduces **Dual-Engine Architecture** with **Optional Bundler Support**: choose between modern **Vite + CRXJS** or **Zero-Build Vanilla mode**.

---

## What's New in v2.1.0

### 1. Optional Bundler Support (`--bundler <vite|none>`)
- **`vite` (Default):** Retains the full Vite + CRXJS, HMR, TypeScript, and multi-browser build workflow from v2.0.0 (100% backward compatible).
- **`none` (Zero-Build Vanilla):** Lightweight architecture without bundlers or heavy dependencies. Load the folder directly into `chrome://extensions` via **Load unpacked** immediately!

### 2. Convenient Flags & Shorthands
- `--bundler <tool>`: Choose build tool (`vite` or `none`).
- `--vanilla`: Shorthand for `--bundler none`.
- `--no-bundler`: Alias for `--bundler none`.

### 3. Zero-Dependency Guarantee
- Generating a Vanilla JavaScript project (`--bundler none --lang js`) creates a clean project with **zero runtime and zero build dependencies** in `package.json`. No `npm install` or build step required.

### 4. Direct Load Unpacked Experience
- In Vanilla mode, `manifest.json` and `icons/` are placed directly at the project root for immediate consumption by Chrome/Chromium browsers.
- Content scripts use native Web Extension DOM APIs without static ES module import constraints.

### 5. Automated Verification & Smoke Testing
- Added **Smoke Suite F** for end-to-end automated verification of Vanilla extension generation, manifest compliance, and unpacked-readiness.

---

## Quick Start

```bash
# Create a Zero-Build Vanilla extension (Direct Load Unpacked)
bun x web-extension@latest my-vanilla-ext --bundler none --lang js --yes

# Create a modern Vite + CRXJS extension (Default)
bun x web-extension@latest my-vite-ext --yes
```

---

## Documentation

- [README.md](https://github.com/TiwPhiraphan/web-extension#readme) — Getting started guide and full CLI flags reference.
- [DEVELOPER.md](https://github.com/TiwPhiraphan/web-extension/blob/main/DEVELOPER.md) — Dual-Engine generator architecture and development workflow.
- [AI.md](https://github.com/TiwPhiraphan/web-extension/blob/main/AI.md) — Machine-readable parameter matrix, invariants, and pipeline contracts.

