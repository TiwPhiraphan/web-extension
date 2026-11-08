import type { BrowserKey, ManifestVersion } from '../cli/context.js';

export interface TargetConfig {
  id: string;
  browser: BrowserKey;
  mv: ManifestVersion;
  outDir: string;
}

export interface BrowserCapability {
  supportsBackgroundServiceWorker: boolean;
  supportsBackgroundScripts: boolean;
  popupKey: 'action' | 'browser_action';
  supportsSidePanel: boolean;
  sidePanelType?: 'side_panel' | 'sidebar_action';
  supportsDnr: boolean;
  supportsDevtools: boolean;
  supportsNewtab: boolean;
  supportsWorldMain: boolean;
}

export const CAPABILITY_MATRIX: Record<string, BrowserCapability> = {
  'chrome-mv3': {
    supportsBackgroundServiceWorker: true,
    supportsBackgroundScripts: false,
    popupKey: 'action',
    supportsSidePanel: true,
    sidePanelType: 'side_panel',
    supportsDnr: true,
    supportsDevtools: true,
    supportsNewtab: true,
    supportsWorldMain: true,
  },
  'firefox-mv3': {
    supportsBackgroundServiceWorker: false,
    supportsBackgroundScripts: true,
    popupKey: 'action',
    supportsSidePanel: true,
    sidePanelType: 'sidebar_action',
    supportsDnr: true,
    supportsDevtools: true,
    supportsNewtab: true,
    supportsWorldMain: true,
  },
  'firefox-mv2': {
    supportsBackgroundServiceWorker: false,
    supportsBackgroundScripts: true,
    popupKey: 'browser_action',
    supportsSidePanel: true,
    sidePanelType: 'sidebar_action',
    supportsDnr: false,
    supportsDevtools: true,
    supportsNewtab: true,
    supportsWorldMain: false,
  },
  'safari-mv3': {
    supportsBackgroundServiceWorker: true,
    supportsBackgroundScripts: false,
    popupKey: 'action',
    supportsSidePanel: false,
    supportsDnr: true,
    supportsDevtools: false,
    supportsNewtab: false,
    supportsWorldMain: true,
  },
  'safari-mv2': {
    supportsBackgroundServiceWorker: false,
    supportsBackgroundScripts: true,
    popupKey: 'browser_action',
    supportsSidePanel: false,
    supportsDnr: false,
    supportsDevtools: false,
    supportsNewtab: false,
    supportsWorldMain: false,
  },
};

export function resolveTargets(
  browsers: BrowserKey[],
  firefoxMv: ManifestVersion = 3,
  safariMv: ManifestVersion = 3,
): TargetConfig[] {
  const targets: TargetConfig[] = [];

  for (const b of browsers) {
    if (b === 'chrome') {
      targets.push({
        id: 'chrome-mv3',
        browser: 'chrome',
        mv: 3,
        outDir: 'dist/chrome-mv3',
      });
    } else if (b === 'firefox') {
      const mv = firefoxMv || 3;
      targets.push({
        id: `firefox-mv${mv}`,
        browser: 'firefox',
        mv,
        outDir: `dist/firefox-mv${mv}`,
      });
    } else if (b === 'safari') {
      const mv = safariMv || 3;
      targets.push({
        id: `safari-mv${mv}`,
        browser: 'safari',
        mv,
        outDir: `dist/safari-mv${mv}`,
      });
    }
  }

  return targets;
}

