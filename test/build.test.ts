import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOnce, outDirFor } from '../src/core/bundle';
import { read, readJson, tempProject } from './helpers';

const project = () =>
  tempProject({
    'manifest.json': JSON.stringify({
      $schema: './nope.json',
      manifest_version: 3,
      name: 'fixture',
      version: '1.0.0',
      browser_specific_settings: { gecko: { id: 'fixture@example.com' } },
      background: { service_worker: 'src/background/index.ts' },
      content_scripts: [
        { matches: ['https://*/*'], js: ['src/content/index.ts'] },
        { matches: ['https://*/*'], js: ['src/main/index.ts'], world: 'MAIN', css: ['src/main/extra.css'] },
      ],
      action: { default_popup: 'src/popup/index.html' },
    }),
    'src/lib/greet.ts': "export const greet = (name: string): string => `hello ${name}`;\n",
    'src/background/index.ts': "import { greet } from '../lib/greet';\nconsole.log(greet('bg'));\n",
    'src/content/index.ts': "import './style.css';\nimport { greet } from '../lib/greet';\nconsole.log(greet('content'));\n",
    'src/content/style.css': 'body { outline: 1px solid red; }\n',
    'src/main/index.ts': "console.log('main world');\n",
    'src/main/extra.css': 'html { color: blue; }\n',
    'src/popup/index.html':
      '<!doctype html><html><head><title>p</title></head><body><script type="module" src="./main.ts"></script></body></html>',
    'src/popup/main.ts': "import './style.css';\ndocument.body.textContent = 'popup';\n",
    'src/popup/style.css': 'body { margin: 0; }\n',
    'public/icons/icon.txt': 'static',
    'public/.gitkeep': '',
  });

const settings = (root: string, browser: 'chrome' | 'firefox' | 'safari') => ({
  root,
  outDir: outDirFor(root, browser),
  browser,
  mode: 'production' as const,
  minify: false,
  sourcemap: false,
});

describe('buildOnce', () => {
  it('bundles every entry, rewrites the manifest and pages, and copies public/', async () => {
    const root = project();
    const report = await buildOnce(settings(root, 'chrome'));
    expect(report.warnings).toEqual([]);

    const out = 'dist/chrome';
    const manifest = readJson<any>(root, `${out}/manifest.json`);
    expect(manifest.$schema).toBeUndefined();
    expect(manifest.browser_specific_settings).toBeUndefined();
    expect(manifest.background.service_worker).toBe('src/background/index.js');
    expect(manifest.content_scripts[0].js).toEqual(['src/content/index.js']);
    expect(manifest.content_scripts[0].css).toEqual(['src/content/index.css']);
    expect(manifest.content_scripts[1].css).toEqual(['src/main/extra.css']);

    expect(read(root, `${out}/src/background/index.js`)).toContain('hello ');
    expect(read(root, `${out}/src/background/index.js`)).not.toContain('import ');
    expect(fs.existsSync(path.join(root, out, 'src/content/index.css'))).toBe(true);
    expect(fs.existsSync(path.join(root, out, 'src/main/extra.css'))).toBe(true);

    const html = read(root, `${out}/src/popup/index.html`);
    expect(html).toContain('src="./main.js"');
    expect(html).toContain('<link rel="stylesheet" href="main.css">');

    expect(read(root, `${out}/icons/icon.txt`)).toBe('static');
    expect(fs.existsSync(path.join(root, out, '.gitkeep'))).toBe(false);
  });

  it('produces a Firefox manifest with background.scripts and the gecko id', async () => {
    const root = project();
    await buildOnce(settings(root, 'firefox'));
    const manifest = readJson<any>(root, 'dist/firefox/manifest.json');
    expect(manifest.background).toEqual({ scripts: ['src/background/index.js'] });
    expect(manifest.browser_specific_settings.gecko.id).toBe('fixture@example.com');
  });

  it('cleans the output folder before building', async () => {
    const root = project();
    fs.mkdirSync(path.join(root, 'dist/chrome'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/chrome/stale.js'), 'old');
    await buildOnce(settings(root, 'chrome'));
    expect(fs.existsSync(path.join(root, 'dist/chrome/stale.js'))).toBe(false);
  });

  it('reports syntax errors from esbuild', async () => {
    const root = project();
    fs.writeFileSync(path.join(root, 'src/background/index.ts'), 'const = ;');
    await expect(buildOnce(settings(root, 'chrome'))).rejects.toMatchObject({ errors: expect.any(Array) });
  });

  it('works for a manifest with no scripts at all', async () => {
    const root = tempProject({
      'manifest.json': JSON.stringify({ manifest_version: 3, name: 'empty', version: '1' }),
    });
    await buildOnce(settings(root, 'chrome'));
    expect(readJson<any>(root, 'dist/chrome/manifest.json').name).toBe('empty');
  });
});
