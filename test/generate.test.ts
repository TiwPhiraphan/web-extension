import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateProject, projectFiles, type ProjectContext } from '../src/scaffold/generate';
import { readJson, tempProject } from './helpers';

const ctx = (overrides: Partial<ProjectContext> = {}): ProjectContext => ({
  dir: path.join(tempProject(), 'app'),
  name: 'demo-ext',
  browsers: ['chrome'],
  entries: ['background', 'content'],
  lang: 'ts',
  matches: ['https://*/*'],
  pm: 'npm',
  ...overrides,
});

const ALL = ['background', 'content', 'main-world', 'popup', 'options', 'sidepanel', 'newtab'] as const;

describe('projectFiles', () => {
  it('writes only what was asked for', () => {
    const files = [...projectFiles(ctx({ entries: ['popup'] })).keys()];
    expect(files).toContain('src/popup/index.html');
    expect(files).toContain('src/popup/main.ts');
    expect(files).not.toContain('src/background/index.ts');
    expect(files).not.toContain('src/lib/browser.ts');
  });

  it('uses .js and jsconfig for JavaScript projects, with no TypeScript left over', () => {
    const files = projectFiles(ctx({ lang: 'js', entries: [...ALL] }));
    const names = [...files.keys()];
    expect(names).toContain('jsconfig.json');
    expect(names).not.toContain('tsconfig.json');
    expect(names.some((n) => n.endsWith('.ts'))).toBe(false);
    expect(files.get('src/popup/index.html')).toContain('./main.js');
    expect(files.get('src/background/index.js')).not.toContain(': unknown');
  });

  it('keeps the MAIN-world script free of extension APIs', () => {
    const source = projectFiles(ctx({ entries: ['main-world'] })).get('src/main-world/index.ts')!;
    expect(source).not.toMatch(/^import\s/m);
    expect(source).not.toMatch(/\b(?:browser|chrome)\.runtime/);
  });

  it('the isolated content script listens for the MAIN-world script only when both exist', () => {
    const both = projectFiles(ctx({ entries: ['content', 'main-world'] })).get('src/content/index.ts')!;
    const alone = projectFiles(ctx({ entries: ['content'] })).get('src/content/index.ts')!;
    expect(both).toContain("'main-world'");
    expect(alone).not.toContain("'main-world'");
  });
});

describe('generated manifest', () => {
  const manifestOf = (c: ProjectContext) => JSON.parse(projectFiles(c).get('manifest.json')!) as Record<string, any>;

  it('points at source files and carries the right content script settings', () => {
    const m = manifestOf(ctx({ entries: [...ALL], matches: ['https://a.com/*'] }));
    expect(m.manifest_version).toBe(3);
    expect(m.background.service_worker).toBe('src/background/index.ts');
    expect(m.content_scripts).toEqual([
      { matches: ['https://a.com/*'], js: ['src/content/index.ts'], run_at: 'document_idle' },
      { matches: ['https://a.com/*'], js: ['src/main-world/index.ts'], run_at: 'document_start', world: 'MAIN' },
    ]);
    expect(m.action.default_popup).toBe('src/popup/index.html');
    expect(m.options_ui.page).toBe('src/options/index.html');
    expect(m.side_panel.default_path).toBe('src/sidepanel/index.html');
    expect(m.chrome_url_overrides.newtab).toBe('src/newtab/index.html');
    expect(m.permissions).toEqual(['sidePanel']);
    expect(m.minimum_chrome_version).toBe('111');
  });

  it('adds gecko settings only when Firefox is a target, requiring 128 for MAIN-world scripts', () => {
    expect(manifestOf(ctx()).browser_specific_settings).toBeUndefined();
    expect(manifestOf(ctx({ browsers: ['chrome', 'firefox'] })).browser_specific_settings.gecko).toEqual({
      id: 'demo-ext@example.com',
      strict_min_version: '109.0',
    });
    expect(
      manifestOf(ctx({ browsers: ['firefox'], entries: ['main-world'] })).browser_specific_settings.gecko.strict_min_version,
    ).toBe('128.0');
  });

  it('points $schema at the first browser, preferring chrome', () => {
    expect(manifestOf(ctx({ browsers: ['firefox', 'chrome'] })).$schema).toContain('chrome-manifest.schema.json');
    expect(manifestOf(ctx({ browsers: ['firefox'] })).$schema).toContain('firefox-manifest.schema.json');
  });
});

describe('generated package.json', () => {
  it('has per-browser scripts and a typecheck script only for TypeScript', () => {
    const pkg = JSON.parse(projectFiles(ctx({ browsers: ['chrome', 'firefox'] })).get('package.json')!);
    expect(pkg.scripts).toMatchObject({
      dev: 'web-extension dev --browser chrome',
      build: 'web-extension build --browser chrome,firefox',
      'dev:firefox': 'web-extension dev --browser firefox',
      'build:chrome': 'web-extension build --browser chrome',
      typecheck: 'tsc --noEmit',
    });
    expect(pkg.dependencies['webextension-polyfill']).toBeDefined();
    expect(pkg.devDependencies.typescript).toBeDefined();

    const js = JSON.parse(projectFiles(ctx({ lang: 'js' })).get('package.json')!);
    expect(js.scripts.typecheck).toBeUndefined();
    expect(js.devDependencies.typescript).toBeUndefined();
  });
});

describe('generateProject', () => {
  it('writes files to disk', () => {
    const c = ctx();
    generateProject(c);
    expect(readJson(c.dir, 'manifest.json').name).toBe('demo-ext');
    expect(fs.existsSync(path.join(c.dir, 'src/background/index.ts'))).toBe(true);
  });

  it('refuses a directory that is not empty and leaves it untouched', () => {
    const dir = tempProject({ 'keep.txt': 'mine' });
    expect(() => generateProject(ctx({ dir }))).toThrow(/not empty/);
    expect(fs.readdirSync(dir)).toEqual(['keep.txt']);
  });
});
