import type { Context } from '../cli/context.js';
import type { TargetConfig } from './targets.js';

export function buildConfigs(
  ctx: Context,
  targets: TargetConfig[],
): Record<string, string> {
  const files: Record<string, string> = {};

  const types: string[] = [];
  const hasChrome = targets.some((t) => t.browser === 'chrome');
  const hasFirefox = targets.some((t) => t.browser === 'firefox');
  const hasSafari = targets.some((t) => t.browser === 'safari');

  if (hasChrome || (hasSafari && !hasFirefox)) {
    types.push('chrome');
  }
  if (hasFirefox) {
    types.push('firefox-webext-browser');
  }

  const hasBackground =
    ctx.projectType === 'full' && ctx.features.includes('background');

  if (ctx.language === 'ts') {
    // 1. tsconfig.json (root reference)
    const references = [{ path: './tsconfig.app.json' }];
    if (hasBackground) {
      references.push({ path: './tsconfig.background.json' });
    }
    references.push({ path: './tsconfig.node.json' });

    files['tsconfig.json'] = JSON.stringify(
      {
        files: [],
        references,
      },
      null,
      2,
    );

    // 2. tsconfig.app.json
    const appConfig: Record<string, any> = {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        isolatedModules: true,
        skipLibCheck: true,
        types,
      },
      include: ['src/**/*'],
    };

    if (hasBackground) {
      appConfig.exclude = ['src/background/**/*'];
    }

    files['tsconfig.app.json'] = JSON.stringify(appConfig, null, 2);

    // 3. tsconfig.background.json (if background exists)
    if (hasBackground) {
      const bgLib = ['ES2022', 'WebWorker'];
      if (hasFirefox) {
        bgLib.push('DOM');
      }

      files['tsconfig.background.json'] = JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: bgLib,
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            isolatedModules: true,
            skipLibCheck: true,
            types,
          },
          include: ['src/background/**/*', 'src/lib/**/*'],
        },
        null,
        2,
      );
    }

    // 4. tsconfig.node.json
    files['tsconfig.node.json'] = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
        include: [
          'vite.config.ts',
          'manifest.config.ts',
          'targets.config.ts',
          'build/**/*',
        ],
      },
      null,
      2,
    );
  } else {
    // JavaScript - jsconfig.json
    files['jsconfig.json'] = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          checkJs: true,
          noEmit: true,
          types,
        },
        include: [
          'src/**/*',
          'vite.config.js',
          'manifest.config.js',
          'targets.config.js',
          'build/**/*',
        ],
      },
      null,
      2,
    );
  }

  // env.d.ts
  const hasMv3 = targets.some((t) => t.mv === 3);
  const envDtsLines = ['/// <reference types="vite/client" />'];
  if (hasMv3) {
    envDtsLines.push('/// <reference types="@crxjs/vite-plugin/client" />');
  }
  files['src/env.d.ts'] = envDtsLines.join('\n') + '\n';

  return files;
}

