import * as p from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import type { ParsedArgs } from './args.js';
import type {
  BrowserKey,
  ContentScriptRunAt,
  ContentScriptWorld,
  Context,
  ExtraKey,
  FeatureKey,
  IfExistsAction,
  Language,
  ManifestVersion,
  PackageManager,
  ProjectType,
} from './context.js';
import {
  getPackageName,
  parseAndValidateMatches,
  validatePackageName,
} from '../utils/validate.js';
import {
  detectPackageManager,
  formatPmSource,
} from '../utils/pm.js';
import { isInsideGitRepo } from '../utils/exec.js';

export async function runPrompts(args: ParsedArgs): Promise<Context> {
  const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const useDefaults = Boolean(args.yes);

  function handleCancel<T>(value: T | symbol): T {
    if (p.isCancel(value)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    return value as T;
  }

  let projectName = args.name;
  let targetDir = args.dir;

  if (!projectName && !targetDir) {
    if (!isTTY && !useDefaults) {
      throw new Error('Missing project name or target directory. Provide [dir] or --name.');
    }
    if (useDefaults) {
      projectName = 'my-extension';
      targetDir = 'my-extension';
    } else {
      const nameInput = handleCancel(
        await p.text({
          message: 'Project name:',
          placeholder: 'my-extension',
          defaultValue: 'my-extension',
          validate(val) {
            const trimmed = val ? val.trim() : '';
            if (!trimmed) return 'Project name cannot be empty.';
            const check = validatePackageName(trimmed);
            return check === true ? undefined : check;
          },
        }),
      );
      projectName = (nameInput as string).trim();
      targetDir = projectName;
    }
  } else if (!projectName && targetDir) {
    projectName = getPackageName(targetDir);
  } else if (projectName && !targetDir) {
    targetDir = projectName;
  }

  const resolvedTargetDir = path.resolve(targetDir!);

  let ifExists: IfExistsAction = args.ifExists || 'cancel';
  const dirExists = fs.existsSync(resolvedTargetDir);
  const dirHasFiles = dirExists && fs.readdirSync(resolvedTargetDir).length > 0;

  if (dirHasFiles && !args.ifExists) {
    if (!isTTY && !useDefaults) {
      throw new Error(
        `Target directory "${targetDir}" is not empty. Specify --if-exists or --overwrite.`,
      );
    }
    if (useDefaults) {
      throw new Error(
        `Target directory "${targetDir}" is not empty and default action is cancel.`,
      );
    }
    ifExists = handleCancel(
      await p.select({
        message: `Target directory "${targetDir}" is not empty. How to proceed?`,
        options: [
          { value: 'cancel', label: 'Cancel', hint: 'Exit without modifying files' },
          { value: 'overwrite', label: 'Overwrite', hint: 'Delete existing files and proceed' },
          { value: 'merge', label: 'Merge', hint: 'Keep existing files and add extension files' },
        ],
        initialValue: 'cancel',
      }),
    ) as IfExistsAction;

    if (ifExists === 'cancel') {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  let language: Language = args.lang || (useDefaults ? 'ts' : (undefined as any));
  if (!language) {
    if (!isTTY) throw new Error('Missing --lang flag in non-interactive environment.');
    language = handleCancel(
      await p.select({
        message: 'Select language:',
        options: [
          { value: 'ts', label: 'TypeScript', hint: 'Recommended' },
          { value: 'js', label: 'JavaScript' },
        ],
        initialValue: 'ts',
      }),
    ) as Language;
  }

  let projectType: ProjectType = args.type || (useDefaults ? 'full' : (undefined as any));
  if (!projectType) {
    if (!isTTY) throw new Error('Missing --type flag in non-interactive environment.');
    projectType = handleCancel(
      await p.select({
        message: 'Select project type:',
        options: [
          { value: 'full', label: 'Full extension', hint: 'Background, popup, options, content scripts, etc.' },
          { value: 'content-only', label: 'Content script only', hint: 'DOM injector/script with no extension UI' },
        ],
        initialValue: 'full',
      }),
    ) as ProjectType;
  }

  let browsers: BrowserKey[] = args.browser?.length
    ? args.browser
    : (useDefaults ? ['chrome'] : (undefined as any));

  if (!browsers) {
    if (!isTTY) throw new Error('Missing --browser flag in non-interactive environment.');
    browsers = handleCancel(
      await p.multiselect({
        message: 'Select target browsers:',
        options: [
          { value: 'chrome', label: 'Chromium (Chrome, Edge, Brave, Opera)', hint: 'default' },
          { value: 'firefox', label: 'Firefox' },
          { value: 'safari', label: 'Safari' },
        ],
        initialValues: ['chrome'],
        required: true,
      }),
    ) as BrowserKey[];
  }

  let firefoxMv: ManifestVersion | undefined = args.firefoxMv;
  if (browsers.includes('firefox') && firefoxMv === undefined) {
    if (useDefaults) {
      firefoxMv = 3;
    } else if (!isTTY) {
      throw new Error('Missing --firefox-mv flag in non-interactive environment.');
    } else {
      firefoxMv = handleCancel(
        await p.select({
          message: 'Manifest version for Firefox:',
          options: [
            { value: 3, label: 'MV3', hint: 'Recommended modern standard' },
            { value: 2, label: 'MV2', hint: 'Legacy background page' },
          ],
          initialValue: 3,
        }),
      ) as ManifestVersion;
    }
  }

  let safariMv: ManifestVersion | undefined = args.safariMv;
  if (browsers.includes('safari') && safariMv === undefined) {
    if (useDefaults) {
      safariMv = 3;
    } else if (!isTTY) {
      throw new Error('Missing --safari-mv flag in non-interactive environment.');
    } else {
      safariMv = handleCancel(
        await p.select({
          message: 'Manifest version for Safari:',
          options: [
            { value: 3, label: 'MV3', hint: 'Recommended modern standard' },
            { value: 2, label: 'MV2', hint: 'Legacy extension converter target' },
          ],
          initialValue: 3,
        }),
      ) as ManifestVersion;
    }
  }

  const anyMv2 =
    (browsers.includes('firefox') && firefoxMv === 2) ||
    (browsers.includes('safari') && safariMv === 2);
  const onlySafari = browsers.length === 1 && browsers[0] === 'safari';

  let features: FeatureKey[] = [];
  if (projectType === 'full') {
    if (args.features !== undefined) {
      features = args.features;
    } else if (useDefaults) {
      features = ['background', 'content'];
    } else if (!isTTY) {
      throw new Error('Missing --features flag in non-interactive environment.');
    } else {
      const featureOptions: { value: FeatureKey; label: string; hint?: string }[] = [
        { value: 'background', label: 'Background', hint: 'Service worker or background script' },
        { value: 'content', label: 'Content script', hint: 'Inject scripts and styles into webpages' },
        { value: 'popup', label: 'Popup', hint: 'Toolbar action popup HTML dialog' },
        { value: 'options', label: 'Options page', hint: 'Extension settings interface' },
      ];

      if (!onlySafari) {
        featureOptions.push({
          value: 'sidepanel',
          label: 'Side panel',
          hint: browsers.includes('safari') ? 'Not supported on Safari' : undefined,
        });
      }

      if (!anyMv2) {
        featureOptions.push({
          value: 'dnr',
          label: 'declarativeNetRequest rules',
          hint: 'Declarative network request blocking/redirect rules',
        });
      }

      featureOptions.push({ value: 'devtools', label: 'DevTools page', hint: 'Custom developer tools tab' });
      featureOptions.push({ value: 'newtab', label: 'New tab override', hint: 'Override default new tab page' });

      features = handleCancel(
        await p.multiselect({
          message: 'Select extension features:',
          options: featureOptions,
          initialValues: ['background', 'content'],
          required: false,
        }),
      ) as FeatureKey[];
    }
  }

  const hasContentScript = projectType === 'content-only' || features.includes('content');
  let contentScriptOptions: Context['contentScript'] = undefined;

  if (hasContentScript) {
    let matches: string[] = args.matches || [];
    if (matches.length === 0) {
      if (useDefaults) {
        matches = ['https://*/*'];
      } else if (!isTTY) {
        throw new Error('Missing --matches flag in non-interactive environment.');
      } else {
        const matchesInput = handleCancel(
          await p.text({
            message: 'Content script URL match patterns (comma-separated):',
            placeholder: 'https://*/*',
            defaultValue: 'https://*/*',
            validate(val) {
              const res = parseAndValidateMatches(val || '');
              return res.valid ? undefined : res.error;
            },
          }),
        );
        const parsed = parseAndValidateMatches(matchesInput as string);
        if (parsed.valid) {
          matches = parsed.matches;
        } else {
          matches = ['https://*/*'];
        }
      }
    }

    let runAt: ContentScriptRunAt = args.runAt || 'document_idle';
    if (!args.runAt) {
      if (useDefaults) {
        runAt = 'document_idle';
      } else if (!isTTY) {
        throw new Error('Missing --run-at flag in non-interactive environment.');
      } else {
        runAt = handleCancel(
          await p.select({
            message: 'Content script run timing:',
            options: [
              { value: 'document_idle', label: 'document_idle', hint: 'Default, after page finishes loading' },
              { value: 'document_start', label: 'document_start', hint: 'Before any DOM is created' },
              { value: 'document_end', label: 'document_end', hint: 'Immediately after DOM is parsed' },
            ],
            initialValue: 'document_idle',
          }),
        ) as ContentScriptRunAt;
      }
    }

    let world: ContentScriptWorld = args.world || 'ISOLATED';
    if (!anyMv2 && args.world === undefined) {
      if (useDefaults) {
        world = 'ISOLATED';
      } else if (!isTTY) {
        world = 'ISOLATED';
      } else {
        world = handleCancel(
          await p.select({
            message: 'Content script execution world:',
            options: [
              { value: 'ISOLATED', label: 'ISOLATED', hint: 'Default, isolated JS execution space' },
              { value: 'MAIN', label: 'MAIN', hint: 'Share DOM and JS context with page scripts' },
            ],
            initialValue: 'ISOLATED',
          }),
        ) as ContentScriptWorld;
      }
    }

    let css: boolean = args.css ?? true;
    if (args.css === undefined) {
      if (useDefaults) {
        css = true;
      } else if (!isTTY) {
        css = true;
      } else {
        css = handleCancel(
          await p.confirm({
            message: 'Create CSS style file for content script?',
            initialValue: true,
          }),
        ) as boolean;
      }
    }

    contentScriptOptions = {
      matches,
      runAt,
      world,
      css,
    };
  }

  let extras: ExtraKey[] = [];
  if (projectType === 'full') {
    if (args.extras !== undefined) {
      extras = args.extras;
    } else if (useDefaults) {
      extras = [];
    } else if (!isTTY) {
      extras = [];
    } else {
      const extraOptions: { value: ExtraKey; label: string; hint?: string }[] = [];
      const hasBackground = features.includes('background');

      if (hasBackground) {
        extraOptions.push({
          value: 'contextmenu',
          label: 'Context menu sample',
          hint: 'contextMenus permission + listener',
        });
        extraOptions.push({
          value: 'commands',
          label: 'Keyboard shortcut sample',
          hint: 'commands manifest entry + listener',
        });
        extraOptions.push({
          value: 'omnibox',
          label: 'Omnibox address bar keyword sample',
          hint: 'omnibox keyword + handler',
        });
      }

      extraOptions.push({
        value: 'storage',
        label: 'Storage helper library',
        hint: 'Type-safe local storage wrapper in src/lib/storage',
      });

      if (extraOptions.length > 0) {
        extras = handleCancel(
          await p.multiselect({
            message: 'Select optional extra samples:',
            options: extraOptions,
            initialValues: [],
            required: false,
          }),
        ) as ExtraKey[];
      }
    }
  }

  const detectedPm = detectPackageManager({
    flag: args.pm,
    targetDir: resolvedTargetDir,
  });

  let chosenPm: PackageManager = detectedPm.name;
  if (!args.pm && !detectedPm.confident && isTTY && !useDefaults) {
    chosenPm = handleCancel(
      await p.select({
        message: 'Select package manager to use:',
        options: [
          { value: 'npm', label: 'npm' },
          { value: 'pnpm', label: 'pnpm' },
          { value: 'yarn', label: 'yarn' },
          { value: 'bun', label: 'bun' },
        ],
        initialValue: detectedPm.name,
      }),
    ) as PackageManager;
  } else {
    p.log.info(`Using ${chosenPm} (detected from ${formatPmSource(detectedPm.source)})`);
  }

  let install: boolean = args.install ?? true;
  if (args.install === undefined) {
    if (useDefaults || !isTTY) {
      install = true;
    } else {
      install = handleCancel(
        await p.confirm({
          message: 'Install dependencies now?',
          initialValue: true,
        }),
      ) as boolean;
    }
  }

  let git: boolean = args.git ?? true;
  const alreadyInGit = isInsideGitRepo(resolvedTargetDir);
  if (args.git === undefined) {
    if (alreadyInGit) {
      git = false;
    } else if (useDefaults || !isTTY) {
      git = true;
    } else {
      git = handleCancel(
        await p.confirm({
          message: 'Initialize a new git repository?',
          initialValue: true,
        }),
      ) as boolean;
    }
  } else if (git && alreadyInGit) {
    p.log.warn('Target directory is already inside a git repository; skipping git init.');
    git = false;
  }

  return {
    projectName: projectName || 'my-extension',
    targetDir: resolvedTargetDir,
    ifExists,
    language,
    projectType,
    browsers,
    firefoxMv,
    safariMv,
    features,
    contentScript: contentScriptOptions,
    extras,
    pm: chosenPm,
    install,
    git,
    isInteractive: isTTY && !useDefaults,
  };
}
