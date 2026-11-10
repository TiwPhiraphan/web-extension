import { describe, expect, it } from 'vitest';
import { detectPackageManager } from '../src/utils/pm';
import { tempProject } from './helpers';

describe('detectPackageManager', () => {
  it.each([
    ['pnpm/10.28.0 npm/? node/v22', 'pnpm'],
    ['yarn/4.1.0 npm/? node/v22', 'yarn'],
    ['bun/1.4.4 npm/? node/v22', 'bun'],
    ['npm/10.9.0 node/v22 linux x64', 'npm'],
  ])('reads the user agent %s', (agent, expected) => {
    expect(detectPackageManager({ npm_config_user_agent: agent }, tempProject())).toBe(expected);
  });

  it('falls back to a lockfile, then npm', () => {
    expect(detectPackageManager({}, tempProject({ 'pnpm-lock.yaml': '' }))).toBe('pnpm');
    expect(detectPackageManager({}, tempProject({ 'bun.lock': '' }))).toBe('bun');
    expect(detectPackageManager({}, tempProject())).toBe('npm');
  });
});
