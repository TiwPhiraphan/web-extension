import fs from 'node:fs';
import path from 'node:path';
import type { PackageManager } from '../cli/args.js';

const LOCKFILES: ReadonlyArray<[string, PackageManager]> = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

/**
 * Work out which package manager started this process.
 * Order: `npm_config_user_agent` (set by npx, pnpm dlx, yarn dlx, bun x), then the nearest lockfile, then npm.
 */
export function detectPackageManager(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): PackageManager {
  const agent = env.npm_config_user_agent?.match(/^(npm|pnpm|yarn|bun)\//);
  if (agent) return agent[1] as PackageManager;

  let dir = path.resolve(cwd);
  for (;;) {
    for (const [file, pm] of LOCKFILES) {
      if (fs.existsSync(path.join(dir, file))) return pm;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'npm';
}

export const installCommand = (pm: PackageManager): string => `${pm} install`;

export const runCommand = (pm: PackageManager, script: string): string => `${pm} run ${script}`;
