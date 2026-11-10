import fs from 'node:fs';
import path from 'node:path';
import type { EntryKey, Language, PackageManager } from '../cli/args.js';
import type { Browser } from '../core/manifest.js';
import { runCommand } from '../utils/pm.js';
import * as t from './templates.js';

/** Everything needed to write a project. */
export interface ProjectContext {
  /** Absolute target directory. */
  dir: string;
  /** npm package name. */
  name: string;
  browsers: Browser[];
  entries: EntryKey[];
  lang: Language;
  matches: string[];
  pm: PackageManager;
}

/**
 * Versions of the libraries generated projects depend on, checked with `npm view` on 2026-11-09.
 * `WEB_EXTENSION_SPEC` overrides how the generated project references this CLI (used by tests to point at a tarball).
 */
export const DEPENDENCY_VERSIONS = {
  polyfill: '^0.12.0',
  polyfillTypes: '^0.12.6',
  typescript: '^5.9.3',
} as const;

const PAGE_ENTRIES = ['popup', 'options', 'sidepanel', 'newtab'] as const;

const PAGE_TITLES: Record<(typeof PAGE_ENTRIES)[number], string> = {
  popup: 'Popup',
  options: 'Options',
  sidepanel: 'Side panel',
  newtab: 'New tab',
};

export const hasEntry = (ctx: Pick<ProjectContext, 'entries'>, key: EntryKey): boolean => ctx.entries.includes(key);

const slugOf = (name: string): string => name.replace(/^@[^/]+\//, '');

/** Build the single shared manifest.json for a new project. */
export function buildProjectManifest(ctx: ProjectContext): Record<string, unknown> {
  const ext = ctx.lang;
  const mainWorld = hasEntry(ctx, 'main-world');
  const schemaBrowser = ctx.browsers.includes('chrome') ? 'chrome' : (ctx.browsers[0] ?? 'chrome');

  const manifest: Record<string, unknown> = {
    $schema: `./node_modules/web-extension/schemas/${schemaBrowser}-manifest.schema.json`,
    manifest_version: 3,
    name: ctx.name,
    version: '0.0.1',
    description: `${ctx.name} browser extension`,
  };

  if (mainWorld) manifest.minimum_chrome_version = '111';

  if (ctx.browsers.includes('firefox')) {
    manifest.browser_specific_settings = {
      gecko: {
        id: `${slugOf(ctx.name)}@example.com`,
        strict_min_version: mainWorld ? '128.0' : '109.0',
      },
    };
  }

  if (hasEntry(ctx, 'sidepanel')) manifest.permissions = ['sidePanel'];

  if (hasEntry(ctx, 'background')) {
    manifest.background = { service_worker: `src/background/index.${ext}` };
  }

  const contentScripts: Record<string, unknown>[] = [];
  if (hasEntry(ctx, 'content')) {
    contentScripts.push({
      matches: ctx.matches,
      js: [`src/content/index.${ext}`],
      run_at: 'document_idle',
    });
  }
  if (mainWorld) {
    contentScripts.push({
      matches: ctx.matches,
      js: [`src/main-world/index.${ext}`],
      run_at: 'document_start',
      world: 'MAIN',
    });
  }
  if (contentScripts.length > 0) manifest.content_scripts = contentScripts;

  if (hasEntry(ctx, 'popup')) manifest.action = { default_popup: 'src/popup/index.html' };
  if (hasEntry(ctx, 'options')) manifest.options_ui = { page: 'src/options/index.html', open_in_tab: true };
  if (hasEntry(ctx, 'sidepanel')) manifest.side_panel = { default_path: 'src/sidepanel/index.html' };
  if (hasEntry(ctx, 'newtab')) manifest.chrome_url_overrides = { newtab: 'src/newtab/index.html' };

  return manifest;
}

/** Build the generated project's package.json. */
export function buildProjectPackageJson(ctx: ProjectContext): Record<string, unknown> {
  const first = ctx.browsers[0];
  const scripts: Record<string, string> = {
    dev: `web-extension dev --browser ${first}`,
    build: `web-extension build --browser ${ctx.browsers.join(',')}`,
  };
  for (const browser of ctx.browsers) {
    scripts[`dev:${browser}`] = `web-extension dev --browser ${browser}`;
    scripts[`build:${browser}`] = `web-extension build --browser ${browser}`;
  }
  if (ctx.lang === 'ts') scripts.typecheck = 'tsc --noEmit';

  const devDependencies: Record<string, string> = {
    '@types/webextension-polyfill': DEPENDENCY_VERSIONS.polyfillTypes,
    'web-extension': process.env.WEB_EXTENSION_SPEC || '^3.0.0',
  };
  if (ctx.lang === 'ts') devDependencies.typescript = DEPENDENCY_VERSIONS.typescript;

  return {
    name: ctx.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts,
    dependencies: { 'webextension-polyfill': DEPENDENCY_VERSIONS.polyfill },
    devDependencies: Object.fromEntries(Object.entries(devDependencies).sort(([a], [b]) => a.localeCompare(b))),
  };
}

/** Collect every file of the project as `relative path -> content`. */
export function projectFiles(ctx: ProjectContext): Map<string, string> {
  const files = new Map<string, string>();
  const ext = ctx.lang;
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

  files.set('manifest.json', json(buildProjectManifest(ctx)));
  files.set('package.json', json(buildProjectPackageJson(ctx)));
  files.set('.gitignore', t.GITIGNORE);
  files.set(ctx.lang === 'ts' ? 'tsconfig.json' : 'jsconfig.json', ctx.lang === 'ts' ? t.TSCONFIG : t.JSCONFIG);
  files.set('README.md', readme(ctx));
  files.set('public/.gitkeep', '');

  const needsPolyfill = hasEntry(ctx, 'background') || hasEntry(ctx, 'content');
  if (needsPolyfill) files.set(`src/lib/browser.${ext}`, t.BROWSER_MODULE);

  if (hasEntry(ctx, 'background')) files.set(`src/background/index.${ext}`, t.background(ctx.lang === 'ts'));
  if (hasEntry(ctx, 'content')) {
    files.set(`src/content/index.${ext}`, t.content(hasEntry(ctx, 'main-world')));
  }
  if (hasEntry(ctx, 'main-world')) files.set(`src/main-world/index.${ext}`, t.MAIN_WORLD);

  for (const key of PAGE_ENTRIES) {
    if (!hasEntry(ctx, key)) continue;
    const title = PAGE_TITLES[key];
    files.set(`src/${key}/index.html`, t.page(title, ext));
    files.set(`src/${key}/main.${ext}`, t.pageMain(title));
    files.set(`src/${key}/style.css`, t.PAGE_STYLE);
  }

  return files;
}

/**
 * Write the project to `ctx.dir`.
 *
 * @throws when the directory exists and is not empty
 */
export function generateProject(ctx: ProjectContext): string[] {
  if (fs.existsSync(ctx.dir) && fs.readdirSync(ctx.dir).length > 0) {
    throw new Error(`Directory is not empty: ${ctx.dir}`);
  }
  const files = projectFiles(ctx);
  for (const [relative, content] of files) {
    const target = path.join(ctx.dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return [...files.keys()];
}

function readme(ctx: ProjectContext): string {
  const run = (script: string): string => runCommand(ctx.pm, script);
  const first = ctx.browsers[0];
  const lines: string[] = [
    `# ${ctx.name}`,
    '',
    'Browser extension built with [web-extension](https://github.com/TiwPhiraphan/web-extension).',
    '',
    '## Develop',
    '',
    '```bash',
    run('dev'),
    '```',
    '',
    `This builds into \`dist/${first}\`, rebuilds on every change and reloads the extension.`,
    'Other browsers: ' + ctx.browsers.map((b) => `\`${run(`dev:${b}`)}\``).join(', ') + '.',
    '',
    '### Load the extension',
    '',
  ];

  if (ctx.browsers.includes('chrome')) {
    lines.push('- **Chrome, Edge, Brave:** open `chrome://extensions`, enable Developer mode, choose Load unpacked, select `dist/chrome`.');
  }
  if (ctx.browsers.includes('firefox')) {
    lines.push('- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, select `dist/firefox/manifest.json`.');
  }
  if (ctx.browsers.includes('safari')) {
    lines.push('- **Safari:** run `xcrun safari-web-extension-converter dist/safari`, then build the generated Xcode project. Support for individual APIs differs from Chrome, so test it.');
  }

  lines.push(
    '',
    'Pages that already had the content script injected keep the old version until you refresh them.',
    '',
    '## Build',
    '',
    '```bash',
    run('build'),
    '```',
    '',
    'Output goes to `dist/<browser>`. Zip that folder to publish.',
    '',
    '## How it works',
    '',
    '`manifest.json` is the only configuration. Every script, stylesheet and HTML page it points at is bundled with esbuild. ' +
      'Scripts can be referenced by their source path (for example `src/background/index.' + ctx.lang + '`) and the build rewrites the path.',
    '',
    '- `public/` is copied to the output unchanged. Put icons there and add an `icons` entry to `manifest.json`.',
    '- `manifest.<browser>.json` (for example `manifest.firefox.json`) is merged over `manifest.json` for that browser only.',
    '- For Firefox the build converts `background.service_worker` to `background.scripts` and `side_panel` to `sidebar_action`.',
  );

  if (hasEntry(ctx, 'main-world')) {
    lines.push(
      '',
      '## MAIN-world script',
      '',
      '`src/main-world` runs inside the page itself. It can patch page globals such as `XMLHttpRequest`, but it has no extension APIs and must not import `webextension-polyfill`. ' +
        'Pass data to the isolated content script with `window.postMessage`.',
    );
  }

  lines.push('', '## Icons', '', 'No icons are included. Add your own to `public/` and reference them from `manifest.json`.', '');
  return lines.join('\n');
}
