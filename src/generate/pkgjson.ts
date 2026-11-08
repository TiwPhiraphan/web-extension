import type { Context } from '../cli/context.js';
import type { TargetConfig } from './targets.js';

export function buildPackageJson(ctx: Context, targets: TargetConfig[]): Record<string, any> {
  const scripts: Record<string, string> = {};

  // Build scripts per target
  for (const t of targets) {
    if (t.mv === 2 || t.browser === 'firefox') {
      scripts[`dev:${t.browser}`] = `vite build --watch --mode ${t.id}`;
    } else {
      scripts[`dev:${t.browser}`] = `vite --mode ${t.id}`;
    }
    scripts[`build:${t.browser}`] = `vite build --mode ${t.id}`;

    if (t.browser === 'firefox') {
      scripts['run:firefox'] = `web-ext run --source-dir dist/${t.id}`;
    }
  }

  // dev and build aliases to first target
  const first = targets[0];
  scripts['dev'] = `npm run dev:${first.browser}`;
  scripts['build'] = `npm run build:${first.browser}`;

  if (targets.length > 1) {
    scripts['build:all'] = targets.map((t) => `npm run build:${t.browser}`).join(' && ');
  }

  scripts['typecheck'] = ctx.language === 'ts' ? 'tsc -b' : 'tsc -p jsconfig.json --noEmit';

  const devDependencies: Record<string, string> = {
    vite: '^8.3.6',
    typescript: '^5.8.2',
  };

  const hasMv3 = targets.some((t) => t.mv === 3);
  if (hasMv3) {
    devDependencies['@crxjs/vite-plugin'] = '^3.0.0';
  }

  const hasChrome = targets.some((t) => t.browser === 'chrome');
  const hasFirefox = targets.some((t) => t.browser === 'firefox');
  const hasSafari = targets.some((t) => t.browser === 'safari');

  if (hasChrome || (hasSafari && !hasFirefox)) {
    devDependencies['@types/chrome'] = '^0.3.7';
  }
  if (hasFirefox) {
    devDependencies['@types/firefox-webext-browser'] = '^143.0.1';
    devDependencies['web-ext'] = '^10.8.0';
  }

  return {
    name: ctx.projectName,
    version: '0.0.1',
    description: `${ctx.projectName} browser extension`,
    type: 'module',
    scripts,
    devDependencies,
  };
}

