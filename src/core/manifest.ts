import fs from 'node:fs';
import path from 'node:path';

/** Browsers a project can be built for. Chromium-based browsers use `chrome`. */
export type Browser = 'chrome' | 'firefox' | 'safari';

export const BROWSERS: readonly Browser[] = ['chrome', 'firefox', 'safari'];

export interface ContentScript {
  matches?: string[];
  js?: string[];
  css?: string[];
  run_at?: string;
  world?: string;
  [key: string]: unknown;
}

/** The subset of manifest fields this tool reads or rewrites. Other fields pass through untouched. */
export interface Manifest {
  $schema?: string;
  manifest_version?: number;
  name?: string;
  version?: string;
  background?: { service_worker?: string; scripts?: string[]; type?: string; [key: string]: unknown };
  content_scripts?: ContentScript[];
  action?: { default_popup?: string; [key: string]: unknown };
  options_ui?: { page?: string; [key: string]: unknown };
  options_page?: string;
  side_panel?: { default_path?: string };
  sidebar_action?: { default_panel?: string; [key: string]: unknown };
  chrome_url_overrides?: Record<string, string>;
  devtools_page?: string;
  permissions?: string[];
  browser_specific_settings?: Record<string, unknown>;
  minimum_chrome_version?: string;
  [key: string]: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Merge `override` into `base`. Objects merge recursively, arrays and scalars are replaced. */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result as T;
}

const readJson = (file: string): Record<string, unknown> => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Cannot read ${file}: ${(err as Error).message}`);
  }
};

/**
 * Load `manifest.json` from the project root and merge `manifest.<browser>.json` over it when present.
 */
export function loadManifest(root: string, browser: Browser): Manifest {
  const basePath = path.join(root, 'manifest.json');
  if (!fs.existsSync(basePath)) {
    throw new Error(`manifest.json not found in ${root}`);
  }
  let manifest = readJson(basePath);
  const overridePath = path.join(root, `manifest.${browser}.json`);
  if (fs.existsSync(overridePath)) {
    manifest = deepMerge(manifest, readJson(overridePath));
  }
  return manifest as Manifest;
}

export interface AdaptResult {
  manifest: Manifest;
  warnings: string[];
}

/**
 * Turn the shared manifest into the manifest for one browser.
 * The input is not modified.
 */
export function adaptManifest(source: Manifest, browser: Browser): AdaptResult {
  const manifest = structuredClone(source);
  const warnings: string[] = [];

  delete manifest.$schema;

  if (manifest.manifest_version !== 3) {
    warnings.push(`manifest_version is ${String(manifest.manifest_version)}; only version 3 is supported.`);
  }

  if (browser !== 'firefox') {
    delete manifest.browser_specific_settings;
  }

  if (browser === 'firefox') {
    delete manifest.minimum_chrome_version;

    if (manifest.background?.service_worker) {
      manifest.background = { scripts: [manifest.background.service_worker] };
    }

    if (manifest.side_panel?.default_path) {
      manifest.sidebar_action = {
        default_title: manifest.name,
        default_panel: manifest.side_panel.default_path,
        ...manifest.sidebar_action,
      };
      delete manifest.side_panel;
    }
    removePermission(manifest, 'sidePanel');

    const gecko = manifest.browser_specific_settings?.gecko as { id?: string } | undefined;
    if (!gecko?.id) {
      warnings.push('Firefox needs browser_specific_settings.gecko.id for storage and signing; none is set.');
    }
  }

  if (browser === 'safari') {
    delete manifest.minimum_chrome_version;
    if (manifest.side_panel) {
      delete manifest.side_panel;
      warnings.push('Safari does not support side panels; side_panel was removed.');
    }
    removePermission(manifest, 'sidePanel');
  }

  if (manifest.permissions && manifest.permissions.length === 0) {
    delete manifest.permissions;
  }

  return { manifest, warnings };
}

function removePermission(manifest: Manifest, permission: string): void {
  if (manifest.permissions) {
    manifest.permissions = manifest.permissions.filter((p) => p !== permission);
  }
}
