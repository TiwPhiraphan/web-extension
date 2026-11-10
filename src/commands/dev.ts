import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { HELP, parseDevArgs } from '../cli/args.js';
import {
  esbuildOptions,
  finalize,
  formatBuildError,
  outDirFor,
  prepare,
  type BuildSettings,
} from '../core/bundle.js';
import { startReloadServer } from '../core/devserver.js';

const WATCH_DEBOUNCE_MS = 150;
const RELOAD_DEBOUNCE_MS = 300;

/** `web-extension dev`: build, watch and live-reload one browser until interrupted. */
export async function runDev(argv: string[], root = process.cwd()): Promise<number> {
  const args = parseDevArgs(argv);
  if (args.help) {
    console.log(HELP.dev);
    return 0;
  }

  const { browser } = args;
  const outDir = outDirFor(root, browser);
  const settings: BuildSettings = { root, outDir, browser, mode: 'development', minify: false, sourcemap: true };
  const server = await startReloadServer(args.port);
  const tag = `[${browser}]`;

  let current: esbuild.BuildContext | undefined;
  let queue: Promise<void> = Promise.resolve();

  // One editor save often triggers several rebuilds. Reload the extension once, after they settle.
  let reloadTimer: NodeJS.Timeout | undefined;
  const requestReload = (): void => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => server.bump(), RELOAD_DEBOUNCE_MS);
  };

  const stopCurrent = async (): Promise<void> => {
    const ctx = current;
    current = undefined;
    await ctx?.dispose();
  };

  const start = async (): Promise<void> => {
    await stopCurrent();

    let prepared;
    try {
      prepared = prepare(root, browser);
    } catch (err) {
      console.error(`${tag} ${(err as Error).message}\n${tag} waiting for changes...`);
      return;
    }
    for (const warning of prepared.warnings) console.warn(`${tag} warning: ${warning}`);

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    if (prepared.plan.scripts.length + prepared.plan.styles.length === 0) {
      finalize(settings, prepared, { inputs: {}, outputs: {} }, { port: server.port });
      requestReload();
      console.log(`${tag} ready (no scripts to bundle)`);
      return;
    }

    let started = performance.now();
    const options = esbuildOptions(settings, prepared.plan);
    const ctx = await esbuild.context({
      ...options,
      plugins: [
        {
          name: 'web-extension-finalize',
          setup(build) {
            build.onStart(() => {
              started = performance.now();
            });
            build.onEnd(async (result) => {
              if (result.errors.length > 0) {
                const text = await esbuild.formatMessages(result.errors, { kind: 'error', color: false });
                console.error(`${tag} build failed\n${text.join('\n').trimEnd()}`);
                return;
              }
              try {
                finalize(settings, prepared, result.metafile!, { port: server.port });
              } catch (err) {
                console.error(`${tag} ${(err as Error).message}`);
                return;
              }
              requestReload();
              console.log(`${tag} built in ${Math.round(performance.now() - started)}ms`);
            });
          },
        },
      ],
    });
    current = ctx;
    await ctx.rebuild().catch(() => undefined);
    await ctx.watch();
  };

  const restart = (): void => {
    queue = queue.then(start).catch(async (err) => {
      console.error(`${tag} ${await formatBuildError(err)}`);
    });
  };

  const watchers: fs.FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(restart, WATCH_DEBOUNCE_MS);
  };

  watchers.push(
    fs.watch(root, (_event, filename) => {
      if (filename && /^manifest(?:\.[a-z]+)?\.json$/.test(String(filename))) schedule();
    }),
  );
  const srcDir = path.join(root, 'src');
  if (fs.existsSync(srcDir)) {
    watchers.push(
      fs.watch(srcDir, { recursive: true }, (_event, filename) => {
        if (filename && String(filename).endsWith('.html')) schedule();
      }),
    );
  }
  const publicDir = path.join(root, 'public');
  if (fs.existsSync(publicDir)) {
    watchers.push(fs.watch(publicDir, { recursive: true }, schedule));
  }

  restart();
  await queue;
  console.log(`${tag} load "${path.relative(root, outDir) || '.'}" as an unpacked extension. Reload server on port ${server.port}.`);

  await new Promise<void>((resolve) => {
    const stop = (): void => resolve();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });

  clearTimeout(timer);
  clearTimeout(reloadTimer);
  for (const watcher of watchers) watcher.close();
  await queue;
  await stopCurrent();
  await server.close();
  return 0;
}
