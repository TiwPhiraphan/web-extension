import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateProject } from '../src/generate/index.js';
import type { Context } from '../src/cli/context.js';

describe('generateProject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'we-gen-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates full extension project with TS and all features', () => {
    const ctx: Context = {
      projectName: 'full-ts-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'ts',
      projectType: 'full',
      browsers: ['chrome', 'firefox'],
      firefoxMv: 3,
      features: ['background', 'content', 'popup', 'options', 'sidepanel', 'dnr', 'devtools', 'newtab'],
      extras: ['contextmenu', 'commands', 'omnibox', 'storage'],
      contentScript: {
        matches: ['https://*/*'],
        runAt: 'document_idle',
        world: 'ISOLATED',
        css: true,
      },
      pm: 'bun',
      install: false,
      git: false,
    };

    const res = generateProject(ctx);
    expect(res.targets.length).toBe(2);

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'vite.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'manifest.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'targets.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/lib/browser.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/lib/storage.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/background/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content/style.css'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/options/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/sidepanel/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/devtools/devtools.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/newtab/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'public/rules/rules.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'public/icons/16.png'))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('full-ts-ext');
    expect(pkg.devDependencies['@types/chrome']).toBeDefined();
    expect(pkg.devDependencies['@types/firefox-webext-browser']).toBeDefined();
    expect(pkg.devDependencies['web-ext']).toBeDefined();
  });

  it('generates content-only mode with only content scripts and no HTML or background', () => {
    const ctx: Context = {
      projectName: 'content-only-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'ts',
      projectType: 'content-only',
      browsers: ['chrome'],
      features: [],
      extras: [],
      contentScript: {
        matches: ['https://example.com/*'],
        runAt: 'document_start',
        world: 'MAIN',
        css: true,
      },
      pm: 'bun',
      install: false,
      git: false,
    };

    generateProject(ctx);

    expect(fs.existsSync(path.join(tmpDir, 'src/content/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content/style.css'))).toBe(true);

    expect(fs.existsSync(path.join(tmpDir, 'src/background'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'src/options'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'src/sidepanel'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'src/devtools'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'src/newtab'))).toBe(false);
  });

  it('generates build/mv2.ts when MV2 target is present', () => {
    const ctx: Context = {
      projectName: 'mv2-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'ts',
      projectType: 'full',
      browsers: ['firefox'],
      firefoxMv: 2,
      features: ['background', 'content', 'popup'],
      extras: [],
      pm: 'npm',
      install: false,
      git: false,
    };

    generateProject(ctx);
    expect(fs.existsSync(path.join(tmpDir, 'build/mv2.ts'))).toBe(true);
  });

  it('generates JavaScript project with jsconfig.json and .js files', () => {
    const ctx: Context = {
      projectName: 'js-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'js',
      projectType: 'full',
      browsers: ['chrome'],
      features: ['popup'],
      extras: [],
      pm: 'npm',
      install: false,
      git: false,
    };

    generateProject(ctx);
    expect(fs.existsSync(path.join(tmpDir, 'jsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'vite.config.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'manifest.config.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup/main.js'))).toBe(true);
  });

  it('generates vanilla project with --bundler none --lang js (Zero-Build)', () => {
    const ctx: Context = {
      projectName: 'vanilla-js-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'js',
      projectType: 'full',
      bundler: 'none',
      browsers: ['chrome'],
      features: ['background', 'content', 'popup'],
      extras: ['storage'],
      contentScript: {
        matches: ['https://*/*'],
        runAt: 'document_idle',
        world: 'ISOLATED',
        css: true,
      },
      pm: 'bun',
      install: false,
      git: false,
    };

    const res = generateProject(ctx);
    expect(res.targets.length).toBe(1);

    // Root files
    expect(fs.existsSync(path.join(tmpDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'icons/16.png'))).toBe(true);

    // No vite / config files
    expect(fs.existsSync(path.join(tmpDir, 'vite.config.js'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'manifest.config.js'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'targets.config.js'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'jsconfig.json'))).toBe(false);

    // Source files
    expect(fs.existsSync(path.join(tmpDir, 'src/background.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content.css'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup/popup.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/popup/popup.css'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/lib/storage.js'))).toBe(true);

    // Check package.json zero-dependency
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('vanilla-js-ext');
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.devDependencies).toBeUndefined();

    // Check manifest.json contents
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf-8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('src/background.js');
    expect(manifest.content_scripts[0].js).toContain('src/content.js');
    expect(manifest.content_scripts[0].css).toContain('src/content.css');
    expect(manifest.action.default_popup).toBe('src/popup/index.html');
    expect(manifest.permissions).toContain('storage');
  });

  it('generates vanilla project with --bundler none --lang ts', () => {
    const ctx: Context = {
      projectName: 'vanilla-ts-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'ts',
      projectType: 'full',
      bundler: 'none',
      browsers: ['chrome'],
      features: ['background', 'content'],
      extras: [],
      contentScript: {
        matches: ['https://*/*'],
        runAt: 'document_idle',
        world: 'ISOLATED',
        css: false,
      },
      pm: 'bun',
      install: false,
      git: false,
    };

    generateProject(ctx);

    expect(fs.existsSync(path.join(tmpDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'dist/manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/background.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/content.ts'))).toBe(true);

    expect(fs.existsSync(path.join(tmpDir, 'vite.config.ts'))).toBe(false);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.dev).toBe('tsc --watch');
    expect(pkg.devDependencies['typescript']).toBeDefined();
    expect(pkg.devDependencies['@types/chrome']).toBeDefined();
    expect(pkg.devDependencies['vite']).toBeUndefined();
  });

  it('generates vite project explicitly with --bundler vite', () => {
    const ctx: Context = {
      projectName: 'vite-explicit-ext',
      targetDir: tmpDir,
      ifExists: 'overwrite',
      language: 'ts',
      projectType: 'full',
      bundler: 'vite',
      browsers: ['chrome'],
      features: ['background'],
      extras: [],
      pm: 'bun',
      install: false,
      git: false,
    };

    generateProject(ctx);
    expect(fs.existsSync(path.join(tmpDir, 'vite.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'manifest.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'targets.config.ts'))).toBe(true);
  });
});

