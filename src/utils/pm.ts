import fs from 'node:fs';
import path from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type PmSource =
  | 'flag'
  | 'user-agent'
  | 'package-json'
  | 'lockfile'
  | 'global-path'
  | 'runtime'
  | 'prompt'
  | 'default';

export interface PmResult {
  name: PackageManager;
  source: PmSource;
  confident: boolean;
}

export interface DetectPmInput {
  flag?: string;
  env?: Record<string, string | undefined>;
  argv1?: string;
  cwd?: string;
  targetDir?: string;
  versions?: Record<string, string | undefined>;
  fsModule?: {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string, encoding: 'utf-8') => string;
    realpathSync: (p: string) => string;
  };
}

export function detectPackageManager(input: DetectPmInput = {}): PmResult {
  const fsImpl = input.fsModule ?? {
    existsSync: fs.existsSync,
    readFileSync: (p: string) => fs.readFileSync(p, 'utf-8'),
    realpathSync: fs.realpathSync,
  };

  const env = input.env ?? process.env;
  const argv1 = input.argv1 ?? process.argv[1];
  const versions = input.versions ?? (process.versions as Record<string, string | undefined>);

  if (input.flag) {
    const f = input.flag.trim().toLowerCase();
    if (f === 'npm' || f === 'pnpm' || f === 'yarn' || f === 'bun') {
      return { name: f as PackageManager, source: 'flag', confident: true };
    }
  }

  const userAgent = env.npm_config_user_agent;
  if (userAgent) {
    const ua = userAgent.trim().toLowerCase();
    if (ua.startsWith('bun/')) {
      return { name: 'bun', source: 'user-agent', confident: true };
    }
    if (ua.startsWith('pnpm/')) {
      return { name: 'pnpm', source: 'user-agent', confident: true };
    }
    if (ua.startsWith('yarn/')) {
      return { name: 'yarn', source: 'user-agent', confident: true };
    }
    if (ua.startsWith('npm/')) {
      return { name: 'npm', source: 'user-agent', confident: true };
    }
  }

  const startDir = path.resolve(input.targetDir || input.cwd || process.cwd());

  let curDir = startDir;
  while (true) {
    const pkgPath = path.join(curDir, 'package.json');
    if (fsImpl.existsSync(pkgPath)) {
      try {
        const raw = fsImpl.readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.packageManager === 'string') {
          const pmField = parsed.packageManager.toLowerCase();
          if (pmField.startsWith('bun@') || pmField === 'bun') {
            return { name: 'bun', source: 'package-json', confident: true };
          }
          if (pmField.startsWith('pnpm@') || pmField === 'pnpm') {
            return { name: 'pnpm', source: 'package-json', confident: true };
          }
          if (pmField.startsWith('yarn@') || pmField === 'yarn') {
            return { name: 'yarn', source: 'package-json', confident: true };
          }
          if (pmField.startsWith('npm@') || pmField === 'npm') {
            return { name: 'npm', source: 'package-json', confident: true };
          }
        }
      } catch {
      }
    }
    const parent = path.dirname(curDir);
    if (parent === curDir) break;
    curDir = parent;
  }

  curDir = startDir;
  while (true) {
    const found: PackageManager[] = [];
    if (fsImpl.existsSync(path.join(curDir, 'bun.lock')) || fsImpl.existsSync(path.join(curDir, 'bun.lockb'))) {
      found.push('bun');
    }
    if (fsImpl.existsSync(path.join(curDir, 'pnpm-lock.yaml'))) {
      found.push('pnpm');
    }
    if (fsImpl.existsSync(path.join(curDir, 'yarn.lock'))) {
      found.push('yarn');
    }
    if (fsImpl.existsSync(path.join(curDir, 'package-lock.json')) || fsImpl.existsSync(path.join(curDir, 'npm-shrinkwrap.json'))) {
      found.push('npm');
    }

    if (found.length === 1) {
      return { name: found[0], source: 'lockfile', confident: true };
    }
    if (found.length > 1) {
      const priority: PackageManager[] = ['bun', 'pnpm', 'yarn', 'npm'];
      const chosen = priority.find((p) => found.includes(p))!;
      return { name: chosen, source: 'lockfile', confident: false };
    }

    if (fsImpl.existsSync(path.join(curDir, '.git'))) {
      break;
    }
    const parent = path.dirname(curDir);
    if (parent === curDir) break;
    curDir = parent;
  }

  if (argv1) {
    try {
      const real = fsImpl.existsSync(argv1) ? fsImpl.realpathSync(argv1) : argv1;
      const normalized = real.replace(/\\/g, '/').toLowerCase();

      if (normalized.includes('/.bun/') || normalized.includes('/bun/bin/')) {
        return { name: 'bun', source: 'global-path', confident: false };
      }
      if (normalized.includes('/pnpm/global/') || normalized.includes('/appdata/local/pnpm')) {
        return { name: 'pnpm', source: 'global-path', confident: false };
      }
      if (
        normalized.includes('/yarn/global/') ||
        normalized.includes('/.config/yarn/global/') ||
        normalized.includes('/appdata/local/yarn')
      ) {
        return { name: 'yarn', source: 'global-path', confident: false };
      }
    } catch {
    }
  }

  if (versions && versions.bun) {
    return { name: 'bun', source: 'runtime', confident: false };
  }

  return { name: 'npm', source: 'default', confident: false };
}

export function formatPmSource(source: PmSource): string {
  switch (source) {
    case 'flag':
      return 'command line flag';
    case 'user-agent':
      return 'user agent';
    case 'package-json':
      return 'package.json packageManager field';
    case 'lockfile':
      return 'lockfile';
    case 'global-path':
      return 'global installation directory';
    case 'runtime':
      return 'runtime environment';
    case 'prompt':
      return 'user selection';
    case 'default':
      return 'default fallback';
  }
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm install';
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun install';
  }
}

export function getRunCommand(pm: PackageManager, script: string): string {
  switch (pm) {
    case 'npm':
      return `npm run ${script}`;
    case 'pnpm':
      return `pnpm ${script}`;
    case 'yarn':
      return `yarn ${script}`;
    case 'bun':
      return `bun run ${script}`;
  }
}

