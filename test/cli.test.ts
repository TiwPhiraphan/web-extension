import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { readJson, tempProject } from './helpers';

const root = path.resolve(__dirname, '..');
const bin = path.join(root, 'dist/index.js');

const run = (args: string[], cwd: string) =>
  spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf-8', env: { ...process.env, npm_config_user_agent: '' } });

beforeAll(() => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'ignore' });
}, 60_000);

describe('web-extension CLI', () => {
  it('prints version and help', () => {
    expect(run(['--version'], root).stdout).toMatch(/^web-extension v3\.0\.0/);
    expect(run(['-v'], root).stdout).toMatch(/^web-extension v3\.0\.0/);
    expect(run(['init', '--version'], root).stdout).toMatch(/^web-extension v3\.0\.0/);
    expect(run(['init', '-v'], root).stdout).toMatch(/^web-extension v3\.0\.0/);
    expect(run(['--help'], root).stdout).toContain('web-extension dev');
    expect(run(['init', '--help'], root).stdout).toContain('--entries');
  });

  it('creates a project from flags only', () => {
    const cwd = tempProject();
    const result = run(
      ['app', '--browser', 'chrome,firefox', '--entries', 'background,popup', '--lang', 'ts', '--no-install', '--no-git', '--pm', 'pnpm'],
      cwd,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('pnpm run dev');
    const dir = path.join(cwd, 'app');
    expect(readJson<any>(dir, 'manifest.json').action.default_popup).toBe('src/popup/index.html');
    expect(fs.existsSync(path.join(dir, 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
  });

  it('--yes fills in defaults', () => {
    const cwd = tempProject();
    const result = run(['app', '--yes', '--no-install', '--no-git'], cwd);
    expect(result.status, result.stderr).toBe(0);
    const manifest = readJson<any>(path.join(cwd, 'app'), 'manifest.json');
    expect(manifest.background.service_worker).toBe('src/background/index.ts');
    expect(manifest.content_scripts).toHaveLength(1);
  });

  it('refuses a directory that is not empty and does not touch it', () => {
    const cwd = tempProject({ 'app/keep.txt': 'mine' });
    const result = run(['app', '--yes', '--no-install', '--no-git'], cwd);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not empty/);
    expect(fs.readdirSync(path.join(cwd, 'app'))).toEqual(['keep.txt']);
  });

  it('lists the missing flags when it cannot prompt', () => {
    const result = run(['app'], tempProject());
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--browser/);
    expect(result.stderr).toMatch(/--entries/);
    expect(result.stderr).toMatch(/--yes/);
  });

  it.each([
    [['app', '--yes', '--browser', 'safari', '--entries', 'sidepanel'], /not supported in Safari/],
    [['Bad Name', '--yes'], /Invalid name/],
    [['app', '--yes', '--entries', 'content', '--matches', 'nonsense'], /Invalid match pattern/],
    [['app', '--yes', '--lang', 'rust'], /Invalid language/],
  ])('rejects bad input %j', (args, message) => {
    const result = run(args, tempProject());
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
  });

  it('build fails with a readable message outside a project', () => {
    const result = run(['build'], tempProject());
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/manifest\.json not found/);
  });
});
