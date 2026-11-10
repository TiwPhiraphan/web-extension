import fs from 'node:fs';
import path from 'node:path';
import type { Manifest } from './manifest.js';

/** Everything the manifest points at that must be bundled or rewritten. Paths are root-relative, posix style. */
export interface EntryPlan {
  scripts: string[];
  styles: string[];
  html: string[];
}

const SCRIPT_EXT = /\.(?:[mc]?[jt]sx?)$/;
const TS_TO_JS = /\.(?:[mc]?[jt]sx?)$/;

const SCRIPT_TAG = /<script\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*>/gi;
const STYLE_LINK = /<link\b(?=[^>]*\brel=(["'])stylesheet\1)[^>]*?\bhref=(["'])(.*?)\2[^>]*>/gi;

const isExternal = (ref: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);

/** Convert a source script path to the path the bundler writes. Other extensions are kept. */
export const toOutputPath = (file: string): string => file.replace(TS_TO_JS, '.js');

const toPosix = (file: string): string => file.replace(/\\/g, '/');

/** Resolve a reference found in the manifest or an HTML file to a root-relative posix path. */
export function resolveRef(ref: string, fromDir: string): string {
  const clean = toPosix(ref.split(/[?#]/)[0]);
  const joined = clean.startsWith('/') ? clean.slice(1) : path.posix.join(fromDir, clean);
  return path.posix.normalize(joined);
}

function manifestHtml(manifest: Manifest): string[] {
  const pages = [
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    manifest.options_page,
    manifest.side_panel?.default_path,
    manifest.sidebar_action?.default_panel,
    manifest.devtools_page,
    ...Object.values(manifest.chrome_url_overrides ?? {}),
  ];
  return pages.filter((page): page is string => typeof page === 'string' && !isExternal(page));
}

function manifestScripts(manifest: Manifest): string[] {
  const scripts = [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    ...(manifest.content_scripts ?? []).flatMap((cs) => cs.js ?? []),
  ];
  return scripts.filter((s): s is string => typeof s === 'string' && SCRIPT_EXT.test(s));
}

/**
 * Read the manifest and the HTML pages it references, and list every script, stylesheet and page involved.
 */
export function collectEntries(root: string, manifest: Manifest): EntryPlan {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const html = new Set<string>();

  const check = (file: string, origin: string): string => {
    if (file.startsWith('..') || path.isAbsolute(file)) {
      throw new Error(`${origin}: "${file}" is outside the project root`);
    }
    if (!fs.existsSync(path.join(root, file))) {
      throw new Error(`${origin}: file not found: ${file}`);
    }
    return file;
  };

  for (const script of manifestScripts(manifest)) {
    scripts.add(check(resolveRef(script, '.'), 'manifest.json'));
  }
  for (const cs of manifest.content_scripts ?? []) {
    for (const css of cs.css ?? []) {
      styles.add(check(resolveRef(css, '.'), 'manifest.json'));
    }
  }

  for (const page of manifestHtml(manifest)) {
    const pagePath = check(resolveRef(page, '.'), 'manifest.json');
    html.add(pagePath);
    const pageDir = path.posix.dirname(pagePath);
    const source = fs.readFileSync(path.join(root, pagePath), 'utf-8');

    for (const match of source.matchAll(SCRIPT_TAG)) {
      if (isExternal(match[2])) continue;
      const ref = resolveRef(match[2], pageDir);
      if (SCRIPT_EXT.test(ref)) scripts.add(check(ref, pagePath));
    }
    for (const match of source.matchAll(STYLE_LINK)) {
      if (isExternal(match[3])) continue;
      const ref = resolveRef(match[3], pageDir);
      if (/\.css$/.test(ref)) styles.add(check(ref, pagePath));
    }
  }

  return {
    scripts: [...scripts].map(toPosix),
    styles: [...styles].map(toPosix),
    html: [...html].map(toPosix),
  };
}

/**
 * Rewrite script sources in an HTML page to the bundled file names and link extracted CSS.
 *
 * @param source     original HTML
 * @param pageDir    root-relative directory of the page
 * @param cssFor     returns the root-relative CSS bundle produced for a source script, if any
 */
export function rewriteHtml(source: string, pageDir: string, cssFor: (script: string) => string | undefined): string {
  const extraCss: string[] = [];
  const linked = new Set<string>();

  for (const match of source.matchAll(STYLE_LINK)) {
    if (!isExternal(match[3])) linked.add(resolveRef(match[3], pageDir));
  }

  const rewritten = source.replace(SCRIPT_TAG, (tag, _quote: string, ref: string) => {
    if (isExternal(ref) || !SCRIPT_EXT.test(ref.split(/[?#]/)[0])) return tag;
    const script = resolveRef(ref, pageDir);
    const css = cssFor(script);
    if (css && !linked.has(css) && !extraCss.includes(css)) extraCss.push(css);
    return tag.replace(ref, toOutputPath(ref.split(/[?#]/)[0]));
  });

  if (extraCss.length === 0) return rewritten;

  const links = extraCss
    .map((css) => `<link rel="stylesheet" href="${path.posix.relative(pageDir, css)}">`)
    .join('\n    ');
  return /<\/head>/i.test(rewritten)
    ? rewritten.replace(/<\/head>/i, `    ${links}\n  </head>`)
    : `${links}\n${rewritten}`;
}
