import { chmodSync, rmSync } from 'node:fs';
import { build, context } from 'esbuild';

rmSync('dist', { recursive: true, force: true });

const options = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
  try {
    chmodSync('dist/index.js', 0o755);
  } catch {}
}
