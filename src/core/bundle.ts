import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { collectEntries, resolveRef, rewriteHtml, toOutputPath, type EntryPlan } from './entries.js';
import { adaptManifest, loadManifest, type Browser, type Manifest } from './manifest.js';

export type Mode = 'development' | 'production';

export interface BuildSettings {
  root: string;
  outDir: string;
  browser: Browser;
  mode: Mode;
  minify: boolean;
  sourcemap: boolean;
}

/** Manifest and entries resolved for one browser. Recreate it when manifest.json or any HTML page changes. */
export interface Prepared {
  manifest: Manifest;
  plan: EntryPlan;
  warnings: string[];
}

export interface DevInfo {
  port: number;
}

export const outDirFor = (root: string, browser: Browser): string => path.join(root, 'dist', browser);

export function prepare(root: string, browser: Browser): Prepared {
  const source = loadManifest(root, browser);
  const { manifest, warnings } = adaptManifest(source, browser);
  const plan = collectEntries(root, manifest);
  return { manifest, plan, warnings };
}

export function esbuildOptions(settings: BuildSettings, plan: EntryPlan): esbuild.BuildOptions {
  return {
    absWorkingDir: settings.root,
    entryPoints: [...plan.scripts, ...plan.styles],
    outdir: settings.outDir,
    outbase: settings.root,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: settings.sourcemap,
    minify: settings.minify,
    metafile: true,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify(settings.mode) },
  };
}

const toPosix = (file: string): string => file.replace(/\\/g, '/');

const writeFile = (file: string, content: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

/** Script the dev manifest loads first. It long-polls the dev server and reloads the extension on change. */
export const devReloadScript = (port: number): string => `(() => {
  const url = 'http://127.0.0.1:${port}/__reload';
  const api = globalThis.browser ?? globalThis.chrome;
  let version = '';
  const loop = async () => {
    for (;;) {
      try {
        const res = await fetch(url + '?v=' + encodeURIComponent(version));
        const next = await res.text();
        if (version !== '' && next !== version) {
          api.runtime.reload();
          return;
        }
        version = next;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };
  loop();
})();
`;

function applyDev(manifest: Manifest, browser: Browser, outDir: string, dev: DevInfo): void {
  writeFile(path.join(outDir, 'web-extension-dev', 'reload.js'), devReloadScript(dev.port));
  const original = manifest.background;

  if (browser === 'firefox') {
    manifest.background = { scripts: ['web-extension-dev/reload.js', ...(original?.scripts ?? [])] };
    return;
  }

  const imports = ['"/web-extension-dev/reload.js"'];
  if (original?.service_worker) imports.push(JSON.stringify(`/${original.service_worker}`));
  writeFile(path.join(outDir, 'web-extension-dev', 'sw.js'), `importScripts(${imports.join(', ')});\n`);
  manifest.background = { service_worker: 'web-extension-dev/sw.js' };
}

/**
 * Write the manifest, rewritten HTML pages and static files next to the bundled scripts.
 */
export function finalize(
  settings: BuildSettings,
  prepared: Prepared,
  metafile: esbuild.Metafile,
  dev?: DevInfo,
): void {
  const { root, outDir, browser } = settings;
  const manifest = structuredClone(prepared.manifest);

  const cssByEntry = new Map<string, string>();
  for (const output of Object.values(metafile.outputs)) {
    if (output.entryPoint && output.cssBundle) {
      const cssFile = path.relative(outDir, path.join(root, output.cssBundle));
      cssByEntry.set(toPosix(output.entryPoint), toPosix(cssFile));
    }
  }

  const outScript = (script: string): string => toOutputPath(resolveRef(script, '.'));

  if (manifest.background?.service_worker) {
    manifest.background.service_worker = outScript(manifest.background.service_worker);
  }
  if (manifest.background?.scripts) {
    manifest.background.scripts = manifest.background.scripts.map(outScript);
  }

  for (const cs of manifest.content_scripts ?? []) {
    const sources = (cs.js ?? []).map((script) => resolveRef(script, '.'));
    const css = [
      ...(cs.css ?? []).map((file) => resolveRef(file, '.')),
      ...sources.flatMap((script) => cssByEntry.get(script) ?? []),
    ];
    if (cs.js) cs.js = cs.js.map(outScript);
    if (css.length > 0) cs.css = [...new Set(css)];
  }

  for (const page of prepared.plan.html) {
    const pageDir = path.posix.dirname(page);
    const source = fs.readFileSync(path.join(root, page), 'utf-8');
    writeFile(
      path.join(outDir, page),
      rewriteHtml(source, pageDir, (script) => cssByEntry.get(script)),
    );
  }

  if (dev) applyDev(manifest, browser, outDir, dev);

  const publicDir = path.join(root, 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outDir, { recursive: true, filter: (source) => path.basename(source) !== '.gitkeep' });
  }

  writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

export interface BuildReport {
  warnings: string[];
  ms: number;
}

/** Clean the output folder, bundle every entry and write the final extension. */
export async function buildOnce(settings: BuildSettings): Promise<BuildReport> {
  const started = performance.now();
  const prepared = prepare(settings.root, settings.browser);

  fs.rmSync(settings.outDir, { recursive: true, force: true });
  fs.mkdirSync(settings.outDir, { recursive: true });

  let metafile: esbuild.Metafile = { inputs: {}, outputs: {} };
  if (prepared.plan.scripts.length + prepared.plan.styles.length > 0) {
    const result = await esbuild.build(esbuildOptions(settings, prepared.plan));
    metafile = result.metafile as esbuild.Metafile;
  }

  finalize(settings, prepared, metafile);
  return { warnings: prepared.warnings, ms: Math.round(performance.now() - started) };
}

/** Format an esbuild failure for the terminal. */
export async function formatBuildError(err: unknown): Promise<string> {
  const failure = err as { errors?: esbuild.Message[] };
  if (Array.isArray(failure?.errors) && failure.errors.length > 0) {
    const lines = await esbuild.formatMessages(failure.errors, { kind: 'error', color: false });
    return lines.join('\n').trimEnd();
  }
  return err instanceof Error ? err.message : String(err);
}
