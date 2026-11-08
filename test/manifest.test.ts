import { describe, it, expect } from 'vitest';
import { buildManifest } from '../src/generate/manifest.js';
import { resolveTargets } from '../src/generate/targets.js';
import type { Context } from '../src/cli/context.js';

describe('buildManifest', () => {
  const baseCtx: Context = {
    projectName: 'test-ext',
    targetDir: '/tmp/test-ext',
    ifExists: 'cancel',
    language: 'ts',
    projectType: 'full',
    browsers: ['chrome', 'firefox', 'safari'],
    firefoxMv: 3,
    safariMv: 3,
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

  it('chrome-mv3 manifest contains expected MV3 keys and no firefox keys', () => {
    const target = resolveTargets(['chrome'])[0];
    const manifest = buildManifest(baseCtx, target);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('src/background/index.ts');
    expect(manifest.action.default_popup).toBe('src/popup/index.html');
    expect(manifest.side_panel.default_path).toBe('src/sidepanel/index.html');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
    expect(manifest.declarative_net_request).toBeDefined();

    expect(manifest.sidebar_action).toBeUndefined();
    expect(manifest.browser_specific_settings).toBeUndefined();
  });

  it('firefox-mv3 manifest uses background.scripts, sidebar_action, and gecko ID', () => {
    const target = resolveTargets(['firefox'], 3)[0];
    const manifest = buildManifest(baseCtx, target);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.scripts).toEqual(['src/background/index.ts']);
    expect(manifest.action.default_popup).toBe('src/popup/index.html');
    expect(manifest.sidebar_action.default_panel).toBe('src/sidepanel/index.html');
    expect(manifest.browser_specific_settings?.gecko?.id).toBe('test-ext@example.com');
    expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('109.0');

    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.permissions).not.toContain('sidePanel');
  });

  it('firefox-mv2 manifest adheres strictly to MV2 and excludes MV3 keys', () => {
    const target = resolveTargets(['firefox'], 2)[0];
    const manifest = buildManifest(baseCtx, target);

    expect(manifest.manifest_version).toBe(2);
    expect(manifest.background.scripts).toEqual(['src/background/index.ts']);
    expect(manifest.background.persistent).toBe(false);
    expect(manifest.browser_action.default_popup).toBe('src/popup/index.html');
    expect(manifest.sidebar_action.default_panel).toBe('src/sidepanel/index.html');
    expect(manifest.browser_specific_settings?.gecko?.id).toBe('test-ext@example.com');
    expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('58.0');

    expect(manifest.action).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.declarative_net_request).toBeUndefined();
    expect(manifest.content_scripts[0].world).toBeUndefined();
  });

  it('safari-mv3 manifest has service_worker and does not have side panel', () => {
    const target = resolveTargets(['safari'], 3)[0];
    const manifest = buildManifest(baseCtx, target);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('src/background/index.ts');
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.sidebar_action).toBeUndefined();
  });

  it('safari-mv2 manifest has persistent false background and no MV3 keys', () => {
    const target = resolveTargets(['safari'], 3, 2)[0];
    const manifest = buildManifest(baseCtx, target);

    expect(manifest.manifest_version).toBe(2);
    expect(manifest.background.scripts).toEqual(['src/background/index.ts']);
    expect(manifest.background.persistent).toBe(false);
    expect(manifest.action).toBeUndefined();
  });

  it('content-only mode contains only content_scripts and no background or permissions', () => {
    const contentCtx: Context = {
      ...baseCtx,
      projectType: 'content-only',
      features: [],
      extras: [],
      contentScript: {
        matches: ['https://example.com/*'],
        runAt: 'document_start',
        world: 'MAIN',
        css: true,
      },
    };

    const target = resolveTargets(['chrome'])[0];
    const manifest = buildManifest(contentCtx, target);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts[0].matches).toEqual(['https://example.com/*']);
    expect(manifest.content_scripts[0].run_at).toBe('document_start');
    expect(manifest.content_scripts[0].world).toBe('MAIN');
    expect(manifest.content_scripts[0].css).toEqual(['src/content/style.css']);

    expect(manifest.background).toBeUndefined();
    expect(manifest.action).toBeUndefined();
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.options_ui).toBeUndefined();
  });
});

