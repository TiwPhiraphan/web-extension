# Project Notes: web-extension

## 1. Initial Repository Inspection (8 Nov 2026)

- **Repository state**: Clean git repository with 2 commits on `main`.
- **Existing files**: `.agent/GEMINI.md` and `LICENSE` (MIT).
- **Notes on Section 0.1**: The initial description in section 0.1 referenced potential pre-existing files (`bin/`, `src/`, `test/`, `package.json`, `README.md`, `bun.lock`), but inspection confirmed none existed in git or the filesystem. The workspace is a greenfield implementation.
- **Toolchain**: Bun is installed (`bun 1.4.4`). Per project rules and Section 0.1, Bun is used as the primary package manager and runtime (`bun run`, `bun x`). Node is `v26.12.1`, npm is `11.20.0`, pnpm is `12.16.1`. Yarn is not present on this system.

---

## 2. Package Registry and Dependency Verification (`npm view`)

Verified on 8 Nov 2026:

| Package | Version | Peer Dependencies / Details |
|---|---|---|
| `@crxjs/vite-plugin` | `3.0.0` | `vite: ^3.0.0 \|\| ^4.0.0 \|\| ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0` |
| `vite` | `8.3.6` | Within `@crxjs/vite-plugin` supported peer range |
| `@clack/prompts` | `1.8.1` | Interactive terminal UI prompts |
| `@types/chrome` | `0.3.7` | Types for `chrome.*` namespace |
| `@types/firefox-webext-browser` | `143.0.1` | Types for `browser.*` namespace (Gecko) |
| `web-ext` | `10.8.0` | Firefox add-on runner CLI |
| `tsup` | `9.0.0` | CLI bundler for TypeScript |
| `vitest` | `5.1.0` | Test runner |
| `picocolors` | `1.1.1` | Terminal text formatting |
| `typescript` | `5.8.2` (or >=5.0) | TypeScript compiler |

### npm Registry Status of `web-extension`
- `npm view web-extension`: `404 Unpublished on 2026-03-08T13:16:18.833Z`.
- `npm view create-web-extension`: `404 Not Found` (unregistered).
- `npm publish --dry-run` with package name `web-extension` packages successfully locally.

---

## 3. Browser Extension & Bundler Verification (SPEC Section 3 & 4)

1. **crxjs Firefox support**:
   - `@crxjs/vite-plugin@3.0.0` accepts `browser?: 'chrome' | 'firefox'`.
   - Manifest types in crxjs:
     - `ChromeManifestBackground`: `{ service_worker: string, type?: 'module' }`
     - `FirefoxManifestBackground`: `{ scripts: string[], persistent?: false }`
   - In Firefox MV3, event pages use `background.scripts`. Our manifest generator emits `{ scripts: ['src/background/index.ts'] }` for Firefox targets.
2. **Firefox dev mode**:
   - Firefox MV3 / MV2 in dev mode does not support Chrome runtime reload HMR in the same way as Chromium. As specified, `dev:firefox` uses `vite build --watch --mode <target id>`.
3. **Safari support**:
   - crxjs does not have a dedicated `'safari'` browser mode.
   - For Safari MV3: built using crxjs with Chromium/MV3 compatible output, then converted by developer using `xcrun safari-web-extension-converter dist/safari-mv3`.
   - For Safari MV2: built via `build/mv2.ts`.
4. **DeclarativeNetRequest (DNR)**:
   - DNR was introduced in Firefox 113+ for MV3. Firefox MV2 uses `webRequest`.
   - In accordance with the spec: DNR is strictly MV3-only and excluded for any MV2 target. If `--features dnr` is combined with an MV2 target, CLI exits with error.
5. **Vite peer dependency**:
   - `@crxjs/vite-plugin@3.0.0` peer range is `^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`.
   - In generated templates, we pin `vite: "^8.3.6"` or `"^6.0.0 || ^7.0.0 || ^8.0.0"` to stay within the verified peer range.

---

## 4. Package Manager Detection Results (SPEC Section 12)

Results tested on Windows 11:

| Method | `npm_config_user_agent` | `argv[1]` / `realpath` | Notes |
|---|---|---|---|
| `bun run script.mjs` | `bun/1.4.4 npm/? node/v26.3.0 win32 x64` | `.../script.mjs` | Detected as `bun` (user-agent) |
| `bun x node script.mjs` | `bun/1.4.4 npm/? node/v26.3.0 win32 x64` | `.../script.mjs` | Detected as `bun` (user-agent) |
| `bunx` | Not installed | - | Windows does not have `bunx` alias by default; `bun x` is used. |
| `npx` | Starts with `npm/...` | `...` | Detected as `npm` (user-agent) |
| `pnpm dlx` | Starts with `pnpm/...` | `...` | Detected as `pnpm` (user-agent) |
| Global install paths | - | Windows: `AppData/Roaming/npm` (npm), `AppData/Local/pnpm` (pnpm), `.bun/bin` or `.bun/install/global` (bun) | Detected via path matching, with `confident: false` |

---

## 5. Scope Boundaries

- Follow all boundaries in Section 17 (Vanilla UI only for new projects, no CSS frameworks / Tailwind, no extra linter/formatter abstractions).
- All prompt flags and validation rules implemented strictly per Sections 5 and 6.

