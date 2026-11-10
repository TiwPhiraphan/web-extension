import { describe, expect, it } from 'vitest';
import { collectEntries, resolveRef, rewriteHtml, toOutputPath } from '../src/core/entries';
import { tempProject } from './helpers';

describe('path helpers', () => {
  it('maps script extensions to .js and leaves others alone', () => {
    expect(toOutputPath('src/a.ts')).toBe('src/a.js');
    expect(toOutputPath('src/a.tsx')).toBe('src/a.js');
    expect(toOutputPath('src/a.mjs')).toBe('src/a.js');
    expect(toOutputPath('src/a.css')).toBe('src/a.css');
  });
  it('resolves relative and root-absolute references', () => {
    expect(resolveRef('./main.ts', 'src/popup')).toBe('src/popup/main.ts');
    expect(resolveRef('../lib/x.ts?v=1', 'src/popup')).toBe('src/lib/x.ts');
    expect(resolveRef('/src/a.ts', 'src/popup')).toBe('src/a.ts');
  });
});

describe('collectEntries', () => {
  const files = {
    'src/bg.ts': '',
    'src/content.ts': '',
    'src/content.css': '',
    'src/popup/index.html':
      '<link rel="stylesheet" href="./style.css"><script type="module" src="./main.ts"></script>' +
      '<script src="https://cdn.example.com/x.js"></script>',
    'src/popup/main.ts': '',
    'src/popup/style.css': '',
  };

  it('finds scripts, stylesheets and pages from the manifest and from HTML', () => {
    const root = tempProject(files);
    const plan = collectEntries(root, {
      background: { service_worker: 'src/bg.ts' },
      content_scripts: [{ matches: ['<all_urls>'], js: ['src/content.ts'], css: ['src/content.css'] }],
      action: { default_popup: 'src/popup/index.html' },
    });
    expect(plan.scripts.sort()).toEqual(['src/bg.ts', 'src/content.ts', 'src/popup/main.ts']);
    expect(plan.styles.sort()).toEqual(['src/content.css', 'src/popup/style.css']);
    expect(plan.html).toEqual(['src/popup/index.html']);
  });

  it('fails clearly for a missing file or a path outside the project', () => {
    const root = tempProject(files);
    expect(() => collectEntries(root, { background: { service_worker: 'src/missing.ts' } })).toThrow(/file not found/);
    expect(() => collectEntries(root, { background: { service_worker: '../evil.ts' } })).toThrow(/outside the project/);
  });
});

describe('rewriteHtml', () => {
  it('points scripts at the bundled .js and injects extracted CSS once', () => {
    const html = '<html><head><title>x</title></head><body><script type="module" src="./main.ts"></script></body></html>';
    const out = rewriteHtml(html, 'src/popup', (script) => (script === 'src/popup/main.ts' ? 'src/popup/main.css' : undefined));
    expect(out).toContain('src="./main.js"');
    expect(out).toContain('<link rel="stylesheet" href="main.css">');
    expect(out.match(/main\.css/g)).toHaveLength(1);
  });

  it('does not add a link that the page already has', () => {
    const html = '<head><link rel="stylesheet" href="./main.css"></head><script src="./main.ts"></script>';
    const out = rewriteHtml(html, 'src/popup', () => 'src/popup/main.css');
    expect(out.match(/main\.css/g)).toHaveLength(1);
  });

  it('leaves external scripts untouched', () => {
    const html = '<script src="https://cdn.example.com/x.ts"></script>';
    expect(rewriteHtml(html, 'src', () => undefined)).toBe(html);
  });
});
