import { describe, expect, it } from 'vitest';
import { adaptManifest, deepMerge, loadManifest, type Manifest } from '../src/core/manifest';
import { tempProject } from './helpers';

const base = (): Manifest => ({
  $schema: './x.json',
  manifest_version: 3,
  name: 'demo',
  version: '1.0.0',
  minimum_chrome_version: '111',
  permissions: ['sidePanel', 'storage'],
  background: { service_worker: 'src/background/index.ts' },
  side_panel: { default_path: 'src/side/index.html' },
  browser_specific_settings: { gecko: { id: 'demo@example.com' } },
});

describe('adaptManifest', () => {
  it('chrome: drops $schema and Firefox-only settings, keeps the service worker', () => {
    const { manifest, warnings } = adaptManifest(base(), 'chrome');
    expect(manifest.$schema).toBeUndefined();
    expect(manifest.browser_specific_settings).toBeUndefined();
    expect(manifest.background).toEqual({ service_worker: 'src/background/index.ts' });
    expect(manifest.side_panel).toBeDefined();
    expect(warnings).toEqual([]);
  });

  it('firefox: service_worker becomes scripts, side_panel becomes sidebar_action', () => {
    const { manifest } = adaptManifest(base(), 'firefox');
    expect(manifest.background).toEqual({ scripts: ['src/background/index.ts'] });
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.sidebar_action).toMatchObject({ default_panel: 'src/side/index.html', default_title: 'demo' });
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.minimum_chrome_version).toBeUndefined();
    expect(manifest.browser_specific_settings).toBeDefined();
  });

  it('firefox: warns when no gecko id is set', () => {
    const source = base();
    delete source.browser_specific_settings;
    expect(adaptManifest(source, 'firefox').warnings.join()).toMatch(/gecko\.id/);
  });

  it('safari: removes side_panel with a warning', () => {
    const { manifest, warnings } = adaptManifest(base(), 'safari');
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.permissions).toEqual(['storage']);
    expect(warnings.join()).toMatch(/side panel/i);
  });

  it('removes an empty permissions array and does not modify its input', () => {
    const source = { ...base(), permissions: ['sidePanel'] };
    const copy = structuredClone(source);
    expect(adaptManifest(source, 'safari').manifest.permissions).toBeUndefined();
    expect(source).toEqual(copy);
  });

  it('warns about manifest versions other than 3', () => {
    expect(adaptManifest({ ...base(), manifest_version: 2 }, 'chrome').warnings.join()).toMatch(/only version 3/);
  });
});

describe('deepMerge / loadManifest', () => {
  it('merges objects and replaces arrays', () => {
    expect(deepMerge({ a: { x: 1, y: 2 }, list: [1, 2] }, { a: { y: 3 }, list: [9] })).toEqual({
      a: { x: 1, y: 3 },
      list: [9],
    });
  });

  it('applies manifest.<browser>.json over manifest.json', () => {
    const dir = tempProject({
      'manifest.json': JSON.stringify({ manifest_version: 3, name: 'a', version: '1', description: 'base' }),
      'manifest.firefox.json': JSON.stringify({ description: 'firefox' }),
    });
    expect(loadManifest(dir, 'firefox').description).toBe('firefox');
    expect(loadManifest(dir, 'chrome').description).toBe('base');
  });

  it('explains a missing manifest', () => {
    expect(() => loadManifest(tempProject(), 'chrome')).toThrow(/manifest\.json not found/);
  });
});
