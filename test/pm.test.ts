import { describe, it, expect } from 'vitest';
import { detectPackageManager, formatPmSource, getInstallCommand, getRunCommand } from '../src/utils/pm.js';

describe('detectPackageManager', () => {
  it('--pm flag wins over all signals', () => {
    const res = detectPackageManager({
      flag: 'pnpm',
      env: { npm_config_user_agent: 'bun/1.4.4' },
    });
    expect(res).toEqual({
      name: 'pnpm',
      source: 'flag',
      confident: true,
    });
  });

  it('detects user agent for npm, pnpm, yarn, bun with confident: true', () => {
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      const res = detectPackageManager({
        env: { npm_config_user_agent: `${pm}/1.2.3 other info` },
      });
      expect(res).toEqual({
        name: pm,
        source: 'user-agent',
        confident: true,
      });
    }
  });

  it('user agent wins over parent lockfile and packageManager field', () => {
    const fsMock = {
      existsSync: (p: string) => p.includes('pnpm-lock.yaml') || p.includes('package.json'),
      readFileSync: (p: string) => JSON.stringify({ packageManager: 'yarn@4.0.0' }),
      realpathSync: (p: string) => p,
    };

    const res = detectPackageManager({
      env: { npm_config_user_agent: 'bun/1.4.4' },
      fsModule: fsMock,
    });
    expect(res).toEqual({
      name: 'bun',
      source: 'user-agent',
      confident: true,
    });
  });

  it('detects packageManager field when user agent is absent', () => {
    const fsMock = {
      existsSync: (p: string) => p.endsWith('package.json'),
      readFileSync: () => JSON.stringify({ packageManager: 'pnpm@8.15.0' }),
      realpathSync: (p: string) => p,
    };

    const res = detectPackageManager({
      env: {},
      fsModule: fsMock,
    });
    expect(res).toEqual({
      name: 'pnpm',
      source: 'package-json',
      confident: true,
    });
  });

  it('detects single lockfile when user agent and packageManager are absent', () => {
    const fsMock = {
      existsSync: (p: string) => p.endsWith('bun.lockb'),
      readFileSync: () => '',
      realpathSync: (p: string) => p,
    };

    const res = detectPackageManager({
      env: {},
      fsModule: fsMock,
    });
    expect(res).toEqual({
      name: 'bun',
      source: 'lockfile',
      confident: true,
    });
  });

  it('returns confident: false when multiple lockfiles are present', () => {
    const fsMock = {
      existsSync: (p: string) => p.endsWith('yarn.lock') || p.endsWith('package-lock.json'),
      readFileSync: () => '',
      realpathSync: (p: string) => p,
    };

    const res = detectPackageManager({
      env: {},
      fsModule: fsMock,
    });
    expect(res.name).toBe('yarn');
    expect(res.source).toBe('lockfile');
    expect(res.confident).toBe(false);
  });

  it('detects global path for bun/pnpm/yarn with confident: false', () => {
    const argvBun = '/home/user/.bun/bin/web-extension';
    const res1 = detectPackageManager({
      env: {},
      argv1: argvBun,
      fsModule: {
        existsSync: (p: string) => p === argvBun,
        readFileSync: () => '',
        realpathSync: (p: string) => p,
      },
    });
    expect(res1).toEqual({
      name: 'bun',
      source: 'global-path',
      confident: false,
    });

    const argvPnpm = 'C:\\Users\\User\\AppData\\Local\\pnpm\\web-extension.cmd';
    const res2 = detectPackageManager({
      env: {},
      argv1: argvPnpm,
      fsModule: {
        existsSync: (p: string) => p === argvPnpm,
        readFileSync: () => '',
        realpathSync: (p: string) => p,
      },
    });
    expect(res2).toEqual({
      name: 'pnpm',
      source: 'global-path',
      confident: false,
    });
  });

  it('falls back to default npm with confident: false when no signal exists', () => {
    const res = detectPackageManager({
      env: {},
      argv1: '/unknown/path/binary',
      fsModule: {
        existsSync: () => false,
        readFileSync: () => '',
        realpathSync: (p: string) => p,
      },
    });
    expect(res).toEqual({
      name: 'npm',
      source: 'default',
      confident: false,
    });
  });

  it('handles empty or malformed user-agent without throwing', () => {
    expect(() =>
      detectPackageManager({
        env: { npm_config_user_agent: '' },
      }),
    ).not.toThrow();

    expect(() =>
      detectPackageManager({
        env: { npm_config_user_agent: 'unknown-agent/0.0.0' },
      }),
    ).not.toThrow();
  });
});

describe('PM command helpers', () => {
  it('formats install and run commands properly', () => {
    expect(getInstallCommand('npm')).toBe('npm install');
    expect(getInstallCommand('yarn')).toBe('yarn');
    expect(getInstallCommand('bun')).toBe('bun install');

    expect(getRunCommand('npm', 'dev')).toBe('npm run dev');
    expect(getRunCommand('pnpm', 'dev')).toBe('pnpm dev');
    expect(getRunCommand('yarn', 'build')).toBe('yarn build');
    expect(getRunCommand('bun', 'dev')).toBe('bun run dev');
  });
});

