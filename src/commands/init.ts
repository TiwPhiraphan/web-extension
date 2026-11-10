import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import pkg from '../../package.json';
import {
  HELP,
  PACKAGE_MANAGERS,
  UsageError,
  parseInitArgs,
  type EntryKey,
  type Language,
} from '../cli/args.js';
import type { Browser } from '../core/manifest.js';
import { generateProject, type ProjectContext } from '../scaffold/generate.js';
import { detectPackageManager, installCommand, runCommand } from '../utils/pm.js';

const DEFAULT_DIR = 'my-extension';
const DEFAULT_MATCHES = ['https://*/*'];
const NAME_PATTERN = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const MATCH_PATTERN = /^(?:<all_urls>|(?:\*|https?|wss?|ftp|file):\/\/[^/]*\/.*)$/;

/** Return an error message for an invalid package name, or undefined when it is valid. */
export function validateName(name: string): string | undefined {
  if (!name) return 'Name cannot be empty.';
  if (!NAME_PATTERN.test(name)) return 'Use lowercase letters, digits and - . _ ~ only (no spaces).';
  return undefined;
}

/** Return an error message for an invalid list of match patterns, or undefined when all are valid. */
export function validateMatches(patterns: string[]): string | undefined {
  if (patterns.length === 0) return 'Enter at least one match pattern.';
  const bad = patterns.find((pattern) => !MATCH_PATTERN.test(pattern));
  return bad ? `Invalid match pattern: ${bad}` : undefined;
}

/** True when the directory does not exist or has no entries. */
export function isEmptyDir(dir: string): boolean {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;
}

function cancelled<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

function exec(command: string, args: string[], cwd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32' });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += String(chunk)));
    child.stderr?.on('data', (chunk) => (output += String(chunk)));
    child.on('error', (err) => resolve({ ok: false, output: err.message }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

/** `web-extension [init]`: returns the process exit code. */
export async function runInit(argv: string[], cwd = process.cwd()): Promise<number> {
  const args = parseInitArgs(argv);
  if (args.help) {
    console.log(HELP.init);
    return 0;
  }
  if (args.version) {
    console.log(`web-extension v${pkg.version}`);
    return 0;
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!interactive && !args.yes) {
    const missing = [
      args.dir === undefined && args.name === undefined ? '[dir]' : undefined,
      args.browsers === undefined ? '--browser' : undefined,
      args.entries === undefined ? '--entries' : undefined,
      args.lang === undefined ? '--lang' : undefined,
      args.install === undefined ? '--install or --no-install' : undefined,
      args.git === undefined ? '--git or --no-git' : undefined,
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new UsageError(`Not an interactive terminal. Missing: ${missing.join(', ')} (or pass --yes to use defaults).`);
    }
  }

  p.intro('web-extension');

  let dirInput = args.dir ?? (args.name && !args.name.startsWith('@') ? args.name : undefined);
  if (dirInput === undefined) {
    if (args.yes) {
      dirInput = DEFAULT_DIR;
    } else {
      dirInput = cancelled(
        await p.text({
          message: 'Project directory',
          placeholder: DEFAULT_DIR,
          defaultValue: DEFAULT_DIR,
          validate(value) {
            const target = path.resolve(cwd, value || DEFAULT_DIR);
            const nameError = validateName(args.name ?? path.basename(target));
            if (nameError) return nameError;
            if (!isEmptyDir(target)) return 'That directory is not empty.';
            return undefined;
          },
        }),
      );
    }
  }
  const dir = path.resolve(cwd, dirInput);
  const name = args.name ?? path.basename(dir);

  const nameError = validateName(name);
  if (nameError) throw new UsageError(`Invalid name "${name}": ${nameError}`);
  if (!isEmptyDir(dir)) {
    throw new UsageError(`Directory is not empty: ${dir}\nChoose a new or empty directory.`);
  }

  let browsers: Browser[];
  if (args.browsers && args.browsers.length > 0) {
    browsers = args.browsers;
  } else if (args.yes) {
    browsers = ['chrome'];
  } else {
    browsers = cancelled(
      await p.multiselect<Browser>({
        message: 'Target browsers',
        options: [
          { value: 'chrome', label: 'Chromium', hint: 'Chrome, Edge, Brave, Opera' },
          { value: 'firefox', label: 'Firefox' },
          { value: 'safari', label: 'Safari', hint: 'needs Xcode to package' },
        ] satisfies { value: Browser; label: string; hint?: string }[],
        initialValues: ['chrome'],
        required: true,
      }),
    );
  }

  let entries: EntryKey[];
  if (args.entries) {
    entries = args.entries;
  } else if (args.yes) {
    entries = ['background', 'content'];
  } else {
    entries = cancelled(
      await p.multiselect<EntryKey>({
        message: 'What does the extension contain?',
        options: [
          { value: 'background', label: 'Background', hint: 'service worker / event page' },
          { value: 'content', label: 'Content script', hint: 'runs on matching pages' },
          { value: 'main-world', label: 'MAIN-world content script', hint: 'runs in the page itself, no extension APIs' },
          { value: 'popup', label: 'Popup' },
          { value: 'options', label: 'Options page' },
          { value: 'sidepanel', label: 'Side panel', hint: 'not available in Safari' },
          { value: 'newtab', label: 'New tab page' },
        ] satisfies { value: EntryKey; label: string; hint?: string }[],
        initialValues: ['background', 'content'],
        required: false,
      }),
    );
  }

  if (entries.includes('sidepanel') && browsers.every((b) => b === 'safari')) {
    throw new UsageError('Side panel is not supported in Safari. Add another browser or remove "sidepanel".');
  }

  const needsMatches = entries.includes('content') || entries.includes('main-world');
  let matches = args.matches ?? DEFAULT_MATCHES;
  if (needsMatches && !args.matches && !args.yes && interactive) {
    const answer = cancelled(
      await p.text({
        message: 'Match patterns for content scripts (comma separated)',
        placeholder: DEFAULT_MATCHES.join(','),
        defaultValue: DEFAULT_MATCHES.join(','),
        validate(value) {
          const list = (value || DEFAULT_MATCHES.join(',')).split(',').map((v) => v.trim()).filter(Boolean);
          return validateMatches(list);
        },
      }),
    );
    matches = answer.split(',').map((v) => v.trim()).filter(Boolean);
  }
  if (needsMatches) {
    const matchError = validateMatches(matches);
    if (matchError) throw new UsageError(matchError);
  }

  let lang: Language;
  if (args.lang) {
    lang = args.lang;
  } else if (args.yes) {
    lang = 'ts';
  } else {
    lang = cancelled(
      await p.select<Language>({
        message: 'Language',
        options: [
          { value: 'ts', label: 'TypeScript' },
          { value: 'js', label: 'JavaScript' },
        ],
        initialValue: 'ts',
      }),
    );
  }

  const install =
    args.install ??
    (args.yes
      ? true
      : cancelled(await p.confirm({ message: 'Install dependencies?', initialValue: true })));
  const git =
    args.git ??
    (args.yes ? true : cancelled(await p.confirm({ message: 'Initialize a git repository?', initialValue: true })));

  const pm = args.pm ?? detectPackageManager(process.env, cwd);
  if (!PACKAGE_MANAGERS.includes(pm)) throw new UsageError(`Unsupported package manager: ${pm}`);

  const ctx: ProjectContext = { dir, name, browsers, entries, lang, matches, pm };
  generateProject(ctx);
  p.log.success(`Created ${path.relative(cwd, dir) || '.'}`);

  if (git) {
    const inside = await exec('git', ['rev-parse', '--is-inside-work-tree'], dir);
    if (inside.ok) {
      p.log.info('Already inside a git repository; skipped git init.');
    } else {
      const result = await exec('git', ['init'], dir);
      if (result.ok) p.log.success('Initialized git repository.');
      else p.log.warn(`git init failed: ${result.output.trim()}`);
    }
  }

  if (install) {
    const spinner = p.spinner();
    spinner.start(`Installing dependencies with ${pm}`);
    const result = await exec(pm, ['install'], dir);
    if (result.ok) {
      spinner.stop('Dependencies installed.');
    } else {
      spinner.stop('Install failed.');
      p.log.warn(`${result.output.trim().split('\n').slice(-8).join('\n')}\nRun "${installCommand(pm)}" yourself.`);
    }
  }

  const steps = [
    path.relative(cwd, dir) ? `cd ${path.relative(cwd, dir)}` : undefined,
    install ? undefined : installCommand(pm),
    runCommand(pm, 'dev'),
  ].filter(Boolean);
  p.outro(`Next:\n  ${steps.join('\n  ')}`);
  return 0;
}
