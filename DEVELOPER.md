# Developer Guide: web-extension

This guide provides instructions and architectural details for developers contributing to the `web-extension` CLI.

---

## 1. Architecture Overview

The codebase is organized into four main layers:

```text
src/
├── index.ts               CLI entry point and top-level error handler
├── cli/
│   ├── args.ts            CLI flag parsing, aliases, and combination validation
│   ├── context.ts         Shared TypeScript types, flags, and context interfaces
│   └── prompts.ts         Interactive prompts (@clack/prompts) and cancel handling
├── generate/
│   ├── copy.ts            Template file copier, placeholder injector, and file renamer
│   ├── index.ts           Main project generation coordinator
│   ├── manifest.ts        Manifest V3 and Manifest V2 generator per target browser
│   ├── pkgjson.ts         Dynamic package.json builder with target dependencies
│   ├── targets.ts         Browser capability matrix and target resolver
│   └── tsconfig.ts        TypeScript (tsconfig) and JavaScript (jsconfig) builder
└── utils/
    ├── exec.ts            Process execution, git detector, and command checks
    ├── pm.ts              Multi-stage package manager detection heuristics
    └── validate.ts        Validation for npm package names, URLs, and match patterns
templates/
├── base/                  Shared assets (icons, gitignore)
├── features/              Feature-specific templates (background, content, popup, etc.)
├── js/                    JavaScript library utilities
└── ts/                    TypeScript library utilities
test/                      Vitest unit test suites
```

---

## 2. Prerequisites & Toolchain

- **Node.js:** `>= 20.0.0`
- **Bun:** `>= 1.0.0` (Bun is the designated package manager and runtime for this repository)
- **Bundler:** `tsup` compiling `src/index.ts` to `dist/index.js` as an ES Module targeting `node20`.
- **Testing:** `vitest` for fast unit tests, and Node/Bun runner for end-to-end smoke tests.

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

### 3.3 Build Production Bundle
```bash
bun run build
```

### 3.4 Typecheck
```bash
bun run typecheck
```

### 3.5 Run Unit Tests
```bash
bun run test
```

### 3.6 Run Smoke Tests
The smoke test suite verifies real extension generation, dependency installation, typechecking, and multi-browser builds across five distinct configurations:
```bash
bun run test:smoke
```

---

## 4. Coding Conventions & Standards

- **TypeScript Strictness:** Strict mode is enforced in `tsconfig.json`. Do not disable strict checks or introduce untyped `any` without explicit justification.
- **Documentation:** Use JSDoc / TSDoc comments for exported functions, types, and interfaces. Avoid inline step comments or temporary notes in source files.
- **No Decorative Symbols:** Do not use emojis, stickers, or decorative symbols in source code, console messages, or documentation.
- **Binary Shebang:** The shebang `#!/usr/bin/env node` is declared at the top of `src/index.ts`. Do not duplicate it via bundler banners.
- **Cross-Platform Compatibility:** Always handle Windows path separators and PowerShell execution nuances. For example, test file operations using `node:path` methods rather than hard-coded `/` or `\`.

---

## 5. Adding New Features or Browser Targets

To extend the CLI with a new extension capability:

1. **Context & Types (`src/cli/context.ts`):**
   - Add new feature or extra keys to `FeatureKey` or `ExtraKey`.
2. **Capability Matrix (`src/generate/targets.ts`):**
   - Define whether the feature is supported by each browser target in `CAPABILITY_MATRIX`.
3. **Manifest Generator (`src/generate/manifest.ts`):**
   - Add the necessary manifest fields (permissions, keys, resources) for both MV3 and MV2.
4. **Template Files (`templates/features/<feature>/`):**
   - Provide template implementations for both TypeScript and JavaScript.
5. **CLI Options (`src/cli/args.ts` & `src/cli/prompts.ts`):**
   - Expose the corresponding CLI flags in `parseCliArgs` and help text.
   - Add the interactive prompt option with support for skipping when the flag is supplied.
6. **Tests (`test/`):**
   - Add unit tests verifying argument parsing and manifest generation.
   - Update `test-smoke.mjs` to validate end-to-end bundling.

---

## 6. Publishing Notes

- **Package Verification:** Before publishing to npm, verify package contents and permissions:
  ```bash
  npm publish --dry-run
  ```
- **Automated Publishing:** A GitHub Actions workflow is configured at `.github/workflows/publish.yml` to automatically build, test, and publish to npm with `--provenance --access=public` whenever a new GitHub Release is published (`on: release`). Ensure the repository secret `NPM_TOKEN` is set up with publish permissions on npmjs.org.
- **Unpublish History:** The package name `web-extension` has past unpublish records on the npm registry. Do not attempt live publishing without explicit clearance from the repository owner.

