import type {
  BrowserKey,
  ContentScriptRunAt,
  ContentScriptWorld,
  ExtraKey,
  FeatureKey,
  IfExistsAction,
  Language,
  ManifestVersion,
  PackageManager,
  ProjectType,
} from './context.js';
import { parseAndValidateMatches } from '../utils/validate.js';

export interface ParsedArgs {
  subcommand?: string;
  dir?: string;
  name?: string;
  ifExists?: IfExistsAction;
  lang?: Language;
  type?: ProjectType;
  browser?: BrowserKey[];
  firefoxMv?: ManifestVersion;
  safariMv?: ManifestVersion;
  features?: FeatureKey[];
  matches?: string[];
  runAt?: ContentScriptRunAt;
  world?: ContentScriptWorld;
  css?: boolean;
  extras?: ExtraKey[];
  pm?: PackageManager;
  install?: boolean;
  git?: boolean;
  yes?: boolean;
  help?: boolean;
  version?: boolean;
  rawFlags: Record<string, any>;
  warnings: string[];
}

const VALID_BROWSERS = ['chrome', 'firefox', 'safari', 'chromium'];
const VALID_LANGS = ['ts', 'js', 'typescript', 'javascript'];
const VALID_TYPES = ['full', 'content-only'];
const VALID_MVS = ['2', '3'];
const VALID_FEATURES: FeatureKey[] = [
  'background',
  'content',
  'popup',
  'options',
  'sidepanel',
  'dnr',
  'devtools',
  'newtab',
];
const VALID_EXTRAS: ExtraKey[] = [
  'contextmenu',
  'commands',
  'omnibox',
  'storage',
];
const VALID_RUN_AT: ContentScriptRunAt[] = [
  'document_start',
  'document_end',
  'document_idle',
];
const VALID_WORLD: ContentScriptWorld[] = ['ISOLATED', 'MAIN'];
const VALID_IF_EXISTS: IfExistsAction[] = ['cancel', 'overwrite', 'merge'];
const VALID_PM: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

export function parseCliArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    rawFlags: {},
    warnings: [],
  };

  const positionals: string[] = [];
  const browserList: BrowserKey[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
      i++;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
      i++;
    } else if (arg === '--overwrite') {
      result.ifExists = 'overwrite';
      result.rawFlags['ifExists'] = 'overwrite';
      i++;
    } else if (arg === '--css') {
      result.css = true;
      result.rawFlags['css'] = true;
      i++;
    } else if (arg === '--no-css') {
      result.css = false;
      result.rawFlags['css'] = false;
      i++;
    } else if (arg === '--install') {
      result.install = true;
      result.rawFlags['install'] = true;
      i++;
    } else if (arg === '--no-install') {
      result.install = false;
      result.rawFlags['install'] = false;
      i++;
    } else if (arg === '--git') {
      result.git = true;
      result.rawFlags['git'] = true;
      i++;
    } else if (arg === '--no-git') {
      result.git = false;
      result.rawFlags['git'] = false;
      i++;
    } else if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      let flag = arg.slice(2);
      let val: string | undefined;

      if (eqIdx !== -1) {
        flag = arg.slice(2, eqIdx);
        val = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        val = argv[++i];
      }

      if (val === undefined) {
        throw new Error(`Flag --${flag} requires a value.`);
      }

      switch (flag) {
        case 'name':
          result.name = val;
          result.rawFlags['name'] = val;
          break;
        case 'if-exists':
          if (!VALID_IF_EXISTS.includes(val as IfExistsAction)) {
            throw new Error(
              `Invalid value "${val}" for --if-exists. Expected one of: ${VALID_IF_EXISTS.join(', ')}`,
            );
          }
          result.ifExists = val as IfExistsAction;
          result.rawFlags['ifExists'] = val;
          break;
        case 'lang':
          if (!VALID_LANGS.includes(val.toLowerCase())) {
            throw new Error(
              `Invalid value "${val}" for --lang. Expected one of: ts, js`,
            );
          }
          result.lang = (val.toLowerCase() === 'javascript' || val.toLowerCase() === 'js') ? 'js' : 'ts';
          result.rawFlags['lang'] = result.lang;
          break;
        case 'type':
          if (!VALID_TYPES.includes(val.toLowerCase())) {
            throw new Error(
              `Invalid value "${val}" for --type. Expected one of: ${VALID_TYPES.join(', ')}`,
            );
          }
          result.type = val.toLowerCase() as ProjectType;
          result.rawFlags['type'] = result.type;
          break;
        case 'browser':
        case 'browsers': {
          const parts = val.split(',').map((s) => s.trim().toLowerCase());
          for (const b of parts) {
            if (!VALID_BROWSERS.includes(b)) {
              throw new Error(
                `Invalid value "${b}" for --browser. Expected one of: chrome, firefox, safari`,
              );
            }
            const mapped: BrowserKey = b === 'chromium' ? 'chrome' : (b as BrowserKey);
            if (!browserList.includes(mapped)) {
              browserList.push(mapped);
            }
          }
          result.browser = browserList;
          result.rawFlags['browser'] = browserList;
          break;
        }
        case 'firefox-mv':
          if (!VALID_MVS.includes(val)) {
            throw new Error(
              `Invalid value "${val}" for --firefox-mv. Expected 2 or 3.`,
            );
          }
          result.firefoxMv = parseInt(val, 10) as ManifestVersion;
          result.rawFlags['firefoxMv'] = result.firefoxMv;
          break;
        case 'safari-mv':
          if (!VALID_MVS.includes(val)) {
            throw new Error(
              `Invalid value "${val}" for --safari-mv. Expected 2 or 3.`,
            );
          }
          result.safariMv = parseInt(val, 10) as ManifestVersion;
          result.rawFlags['safariMv'] = result.safariMv;
          break;
        case 'features': {
          if (val.trim().toLowerCase() === 'none') {
            result.features = [];
          } else {
            const list = val.split(',').map((s) => s.trim().toLowerCase() as FeatureKey);
            for (const f of list) {
              if (!VALID_FEATURES.includes(f)) {
                throw new Error(
                  `Invalid feature "${f}". Expected one of: ${VALID_FEATURES.join(', ')} (or none)`,
                );
              }
            }
            result.features = Array.from(new Set(list));
          }
          result.rawFlags['features'] = result.features;
          break;
        }
        case 'matches': {
          const matchRes = parseAndValidateMatches(val);
          if (!matchRes.valid) {
            throw new Error(matchRes.error);
          }
          result.matches = matchRes.matches;
          result.rawFlags['matches'] = result.matches;
          break;
        }
        case 'run-at':
          if (!VALID_RUN_AT.includes(val as ContentScriptRunAt)) {
            throw new Error(
              `Invalid value "${val}" for --run-at. Expected one of: ${VALID_RUN_AT.join(', ')}`,
            );
          }
          result.runAt = val as ContentScriptRunAt;
          result.rawFlags['runAt'] = result.runAt;
          break;
        case 'world':
          if (!VALID_WORLD.includes(val.toUpperCase() as ContentScriptWorld)) {
            throw new Error(
              `Invalid value "${val}" for --world. Expected ISOLATED or MAIN`,
            );
          }
          result.world = val.toUpperCase() as ContentScriptWorld;
          result.rawFlags['world'] = result.world;
          break;
        case 'extras': {
          if (val.trim().toLowerCase() === 'none') {
            result.extras = [];
          } else {
            const list = val.split(',').map((s) => s.trim().toLowerCase() as ExtraKey);
            for (const e of list) {
              if (!VALID_EXTRAS.includes(e)) {
                throw new Error(
                  `Invalid extra "${e}". Expected one of: ${VALID_EXTRAS.join(', ')} (or none)`,
                );
              }
            }
            result.extras = Array.from(new Set(list));
          }
          result.rawFlags['extras'] = result.extras;
          break;
        }
        case 'pm':
          if (!VALID_PM.includes(val.toLowerCase() as PackageManager)) {
            throw new Error(
              `Invalid value "${val}" for --pm. Expected one of: ${VALID_PM.join(', ')}`,
            );
          }
          result.pm = val.toLowerCase() as PackageManager;
          result.rawFlags['pm'] = result.pm;
          break;
        default:
          throw new Error(`Unknown option --${flag}. Run with --help to see valid options.`);
      }
      i++;
    } else {
      positionals.push(arg);
      i++;
    }
  }

  if (positionals.length > 0) {
    if (positionals[0] === 'init') {
      result.subcommand = 'init';
      if (positionals.length > 1) {
        result.dir = positionals[1];
      }
    } else {
      result.subcommand = 'init';
      result.dir = positionals[0];
    }
  } else {
    result.subcommand = 'init';
  }

  return result;
}

export function validateFlagCombinations(args: ParsedArgs): void {
  if (args.help || args.version) {
    return;
  }

  const isContentOnly = args.type === 'content-only';

  if (isContentOnly && (args.features !== undefined || args.extras !== undefined)) {
    throw new Error(
      'Cannot specify --features or --extras when --type is content-only.',
    );
  }

  const browsers = args.browser || ['chrome'];
  const hasOnlySafari = browsers.length === 1 && browsers[0] === 'safari';

  if (args.features?.includes('sidepanel') && hasOnlySafari) {
    throw new Error('Side panel feature is not supported when targeting only Safari.');
  }

  const hasFirefoxMv2 = browsers.includes('firefox') && args.firefoxMv === 2;
  const hasSafariMv2 = browsers.includes('safari') && args.safariMv === 2;
  const anyMv2 = hasFirefoxMv2 || hasSafariMv2;

  if (args.features?.includes('dnr') && anyMv2) {
    throw new Error(
      'DeclarativeNetRequest (DNR) is not supported with Manifest V2 targets.',
    );
  }

  const hasBackground = !isContentOnly && (args.features === undefined || args.features.includes('background'));
  if (args.extras?.some((e) => ['contextmenu', 'commands', 'omnibox'].includes(e))) {
    if (!hasBackground) {
      throw new Error(
        'Extras contextmenu, commands, and omnibox require background feature.',
      );
    }
  }

  if (args.world === 'MAIN' && anyMv2) {
    throw new Error('Content script world MAIN is only supported in Manifest V3.');
  }

  if (args.firefoxMv !== undefined && !browsers.includes('firefox')) {
    args.warnings.push('--firefox-mv specified without Firefox target.');
  }
  if (args.safariMv !== undefined && !browsers.includes('safari')) {
    args.warnings.push('--safari-mv specified without Safari target.');
  }
  if (!isContentOnly && args.features !== undefined && !args.features.includes('content')) {
    if (args.matches !== undefined || args.runAt !== undefined || args.world !== undefined || args.css !== undefined) {
      args.warnings.push('Content script options specified but content feature was not selected.');
    }
  }
}

export function printHelp(): void {
  console.log(`
web-extension [init] [dir] [options]

Options:
  [dir]                  Target directory (defaults to current or prompt)
  --name <string>        Project name (defaults to basename of dir or "my-extension")
  --if-exists <action>   Action if directory exists: cancel, overwrite, merge (default: cancel)
  --overwrite            Shorthand for --if-exists overwrite
  --lang <ts|js>         Project language: ts (TypeScript) or js (JavaScript) (default: ts)
  --type <type>          Project type: full or content-only (default: full)
  --browser <browsers>   Target browsers: chrome, firefox, safari (default: chrome)
  --firefox-mv <2|3>     Manifest version for Firefox (default: 3)
  --safari-mv <2|3>      Manifest version for Safari (default: 3)
  --features <list>      Comma-separated features: background,content,popup,options,sidepanel,dnr,devtools,newtab (or "none")
  --matches <patterns>   Content script match patterns (default: https://*/*)
  --run-at <timing>      Content script run timing: document_start, document_end, document_idle (default: document_idle)
  --world <world>        Execution world: ISOLATED or MAIN (default: ISOLATED)
  --css / --no-css       Generate CSS for content script (default: --css)
  --extras <list>        Extras: contextmenu,commands,omnibox,storage (or "none")
  --pm <pm>              Package manager override: npm, pnpm, yarn, bun
  --install / --no-install  Install dependencies automatically (default: --install)
  --git / --no-git       Initialize git repository (default: --git)
  --yes, -y              Use defaults for all unanswered questions
  --help, -h             Show this help message
  --version, -v          Show version number
`);
}

