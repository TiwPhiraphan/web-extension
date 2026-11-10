import { parseArgs } from 'node:util';
import { BROWSERS, type Browser } from '../core/manifest.js';

/** A problem with how the user ran the command. Printed without a stack trace. */
export class UsageError extends Error {}

export type Language = 'ts' | 'js';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type EntryKey = 'background' | 'content' | 'main-world' | 'popup' | 'options' | 'sidepanel' | 'newtab';

export const ENTRY_KEYS: readonly EntryKey[] = [
  'background',
  'content',
  'main-world',
  'popup',
  'options',
  'sidepanel',
  'newtab',
];

export const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

const splitList = (values: string[] | undefined): string[] =>
  (values ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

/** Parse `--browser chrome,firefox` style values. `chromium` is an alias of `chrome`. Duplicates are dropped. */
export function parseBrowserList(values: string[] | undefined): Browser[] {
  const result: Browser[] = [];
  for (const raw of splitList(values)) {
    const value = raw === 'chromium' ? 'chrome' : raw;
    if (!BROWSERS.includes(value as Browser)) {
      throw new UsageError(`Invalid browser "${raw}". Expected one of: ${BROWSERS.join(', ')}`);
    }
    if (!result.includes(value as Browser)) result.push(value as Browser);
  }
  return result;
}

export function parseEntryList(values: string[] | undefined): EntryKey[] {
  const result: EntryKey[] = [];
  for (const raw of splitList(values)) {
    if (raw === 'none') continue;
    if (!ENTRY_KEYS.includes(raw as EntryKey)) {
      throw new UsageError(`Invalid entry "${raw}". Expected one of: ${ENTRY_KEYS.join(', ')}, none`);
    }
    if (!result.includes(raw as EntryKey)) result.push(raw as EntryKey);
  }
  return result;
}

function parse<T extends Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>>(
  argv: string[],
  options: T,
  allowPositionals: boolean,
) {
  try {
    return parseArgs({ args: argv, options, allowPositionals, strict: true });
  } catch (err) {
    throw new UsageError((err as Error).message);
  }
}

export interface InitArgs {
  dir?: string;
  name?: string;
  browsers?: Browser[];
  entries?: EntryKey[];
  lang?: Language;
  matches?: string[];
  pm?: PackageManager;
  install?: boolean;
  git?: boolean;
  yes: boolean;
  help: boolean;
  version: boolean;
}

export function parseInitArgs(argv: string[]): InitArgs {
  const { values, positionals } = parse(
    argv,
    {
      name: { type: 'string' },
      browser: { type: 'string', multiple: true },
      entries: { type: 'string', multiple: true },
      lang: { type: 'string' },
      matches: { type: 'string', multiple: true },
      pm: { type: 'string' },
      install: { type: 'boolean' },
      'no-install': { type: 'boolean' },
      git: { type: 'boolean' },
      'no-git': { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    true,
  );

  if (positionals.length > 1) {
    throw new UsageError(`Expected at most one directory, got: ${positionals.join(' ')}`);
  }
  if (values.install && values['no-install']) throw new UsageError('Use either --install or --no-install, not both.');
  if (values.git && values['no-git']) throw new UsageError('Use either --git or --no-git, not both.');

  let lang: Language | undefined;
  if (values.lang !== undefined) {
    const raw = values.lang.toLowerCase();
    lang = raw === 'ts' || raw === 'typescript' ? 'ts' : raw === 'js' || raw === 'javascript' ? 'js' : undefined;
    if (!lang) throw new UsageError(`Invalid language "${values.lang}". Expected one of: ts, js`);
  }

  if (values.pm !== undefined && !PACKAGE_MANAGERS.includes(values.pm as PackageManager)) {
    throw new UsageError(`Invalid package manager "${values.pm}". Expected one of: ${PACKAGE_MANAGERS.join(', ')}`);
  }

  const matches = splitListKeepCase(values.matches);

  return {
    dir: positionals[0],
    name: values.name,
    browsers: values.browser ? parseBrowserList(values.browser) : undefined,
    entries: values.entries ? parseEntryList(values.entries) : undefined,
    lang,
    matches: matches.length > 0 ? matches : undefined,
    pm: values.pm as PackageManager | undefined,
    install: values.install ? true : values['no-install'] ? false : undefined,
    git: values.git ? true : values['no-git'] ? false : undefined,
    yes: values.yes ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
  };
}

const splitListKeepCase = (values: string[] | undefined): string[] =>
  (values ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

export interface BuildArgs {
  browsers: Browser[];
  minify: boolean;
  sourcemap: boolean;
  help: boolean;
}

export function parseBuildArgs(argv: string[]): BuildArgs {
  const { values } = parse(
    argv,
    {
      browser: { type: 'string', multiple: true },
      'no-minify': { type: 'boolean' },
      sourcemap: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    false,
  );
  const browsers = parseBrowserList(values.browser);
  return {
    browsers: browsers.length > 0 ? browsers : ['chrome'],
    minify: !values['no-minify'],
    sourcemap: values.sourcemap ?? false,
    help: values.help ?? false,
  };
}

export interface DevArgs {
  browser: Browser;
  port: number;
  help: boolean;
}

export function parseDevArgs(argv: string[]): DevArgs {
  const { values } = parse(
    argv,
    {
      browser: { type: 'string', multiple: true },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    false,
  );
  const browsers = parseBrowserList(values.browser);
  if (browsers.length > 1) throw new UsageError('dev watches one browser at a time. Pass a single --browser.');

  let port = 0;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new UsageError(`Invalid port "${values.port}".`);
    }
  }
  return { browser: browsers[0] ?? 'chrome', port, help: values.help ?? false };
}

export const HELP = {
  main: `web-extension - scaffold and build cross-browser extensions

Usage:
  web-extension [init] [dir] [options]   create a project (default command)
  web-extension dev [options]            build, watch and live-reload one browser
  web-extension build [options]          production build

Run "web-extension <command> --help" for command options.
  -h, --help       show help
  -v, --version    show version
`,
  init: `Usage: web-extension [init] [dir] [options]

Creates a project in [dir]. The directory must be empty or not exist.

Options (a flag skips its own question):
  --name <name>           package name (default: directory name)
  --browser <list>        chrome, firefox, safari (comma separated or repeated; chromium = chrome)
  --entries <list>        background, content, main-world, popup, options, sidepanel, newtab, none
  --lang <ts|js>          language (default: ts)
  --matches <patterns>    content script match patterns (default: https://*/*)
  --pm <npm|pnpm|yarn|bun>  package manager (default: detected)
  --install / --no-install  install dependencies (default: install)
  --git / --no-git          git init (default: init, skipped inside a repo)
  -y, --yes               use defaults for everything not given as a flag
  -h, --help              show help
  -v, --version           show version

Defaults with --yes: --browser chrome --entries background,content --lang ts
`,
  dev: `Usage: web-extension dev [options]

Builds into dist/<browser>, rebuilds on change and reloads the extension.

Options:
  --browser <name>   chrome (default), firefox or safari
  --port <number>    reload server port (default: any free port)
  -h, --help
`,
  build: `Usage: web-extension build [options]

Builds into dist/<browser>.

Options:
  --browser <list>   chrome (default), firefox, safari. Comma separated or repeated.
  --no-minify        keep output readable
  --sourcemap        emit source maps
  -h, --help
`,
};
