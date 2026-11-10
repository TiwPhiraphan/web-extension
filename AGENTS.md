# AGENTS.md

Guidance for AI coding agents working on `web-extension` v3, a CLI that scaffolds and builds cross-browser extensions with esbuild. The README describes behavior; this file covers how to work on the code.

## Commands

Bun is the package manager. Node >= 20.

```bash
bun install
bun run typecheck      # tsc --noEmit
bun run test           # vitest; builds dist/ first (test/cli.test.ts runs the real CLI)
bun run test:e2e       # e2e check in real Chromium via Playwright
bun run build          # esbuild -> dist/index.js
```

Run `typecheck` and `test` before finishing a change. `bun run test:e2e` runs the browser check in headless Chromium (also runnable manually with `node test/e2e/chromium.cjs <project>`).

## Layout

```text
src/index.ts          command router (init | dev | build), exit codes
src/cli/args.ts       flag parsing (node:util parseArgs), validation, help text, UsageError
src/commands/         init.ts (prompts + flow), dev.ts (watch + reload), build.ts
src/core/             manifest.ts (load, merge, per-browser adapt), entries.ts (find entries, rewrite HTML),
                      bundle.ts (esbuild options, finalize, dev wrapper), devserver.ts (long-poll reload server)
src/scaffold/         generate.ts (manifest, package.json, file list), templates.ts (file contents)
src/utils/pm.ts       package manager detection
schemas/              per-browser manifest JSON Schemas, shipped in the package
test/                 vitest tests; test/e2e/chromium.cjs is the optional browser check
```

## Rules

- `manifest.json` is the single source of truth for entries. Do not add config files to generated projects.
- Manifests are objects that are serialized, never string templates (`generate.ts`, `manifest.ts`).
- Every prompt has a matching flag. A flag skips only its own prompt. Without a terminal and without `--yes`, list the missing flags and exit 1. Never block on input.
- `init` never writes into a non-empty directory.
- Generated TypeScript and JavaScript projects share the same template text; only the extension and a few annotations differ (`templates.ts`). Keep snippets valid in both.
- A MAIN-world script template must not import `webextension-polyfill` or touch `chrome.*` / `browser.*`.
- Do not use names starting with `_` for files or directories in extension output: Chrome rejects them (this broke dev reload once; the dev files live in `web-extension-dev/`).
- Dependency versions written into generated projects live in `DEPENDENCY_VERSIONS` in `generate.ts`. Look them up with `npm view <pkg> version`; do not write them from memory.
- Use `node:path` for filesystem paths, posix separators in manifest and HTML paths. Windows must work.
- TypeScript strict stays on. JSDoc on exported functions. No emojis in code, output or docs.
- When flags, defaults or generated structure change, update `README.md`, the help text in `args.ts` and the tests in the same change.

## Testing notes

- Unit tests cover args, manifest adaptation, entry collection, generation, building a fixture project, the reload server, and the dev reload client run in a `vm` with a fake `chrome.runtime`.
- When testing a packed tarball inside a generated project, remove `node_modules` and `package-lock.json` before reinstalling; npm reuses the cached tarball otherwise and you test a stale build.
- Do not signal `npx` to stop a dev server in tests; it leaves the real process running. Spawn `node <bin>` directly.
- In a headless Chromium started with `--load-extension`, a real `chrome.runtime.reload()` leaves the extension disabled. The e2e script therefore replaces `reload` with a beacon to observe the call.

## Not supported (decide with the maintainer before adding)

Manifest V2 output, Vite or other framework integrations, HMR, `devtools_page` / declarativeNetRequest rule resources as entries, zip packaging, running `xcrun` for Safari, publishing to stores.

## Publishing

Do not run `npm publish`. The `web-extension` name was unpublished from npm on 2026-03-08, so publishing needs the owner. Use `npm pack --dry-run` to inspect the package.
