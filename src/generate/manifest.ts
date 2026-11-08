import type { Context } from '../cli/context.js';
import { CAPABILITY_MATRIX, type TargetConfig } from './targets.js';
import { toSlug } from '../utils/validate.js';

export function buildManifest(ctx: Context, target: TargetConfig): Record<string, any> {
  const cap = CAPABILITY_MATRIX[target.id] || {
    supportsBackgroundServiceWorker: true,
    supportsBackgroundScripts: false,
    popupKey: 'action',
    supportsSidePanel: false,
    supportsDnr: target.mv === 3,
    supportsDevtools: false,
    supportsNewtab: false,
    supportsWorldMain: target.mv === 3,
  };

  const ext = ctx.language === 'ts' ? 'ts' : 'js';
  const slug = toSlug(ctx.projectName);

  const manifest: Record<string, any> = {
    manifest_version: target.mv,
    name: ctx.projectName,
    version: '0.0.1',
    description: `${ctx.projectName} browser extension`,
    icons: {
      '16': 'icons/16.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
  };

  if (ctx.projectType === 'content-only') {
    const matches = ctx.contentScript?.matches?.length
      ? ctx.contentScript.matches
      : ['https://*/*'];

    const contentEntry: Record<string, any> = {
      matches,
      js: [`src/content/index.${ext}`],
      run_at: ctx.contentScript?.runAt || 'document_idle',
    };

    if (ctx.contentScript?.css) {
      contentEntry.css = ['src/content/style.css'];
    }

    if (target.mv === 3 && cap.supportsWorldMain) {
      contentEntry.world = ctx.contentScript?.world || 'ISOLATED';
    }

    manifest.content_scripts = [contentEntry];

    if (target.browser === 'firefox') {
      manifest.browser_specific_settings = {
        gecko: {
          id: `${slug}@example.com`,
          strict_min_version: target.mv === 3 ? '109.0' : '58.0',
        },
      };
    }

    return manifest;
  }

  const permissions: string[] = [];

  if (ctx.features.includes('background')) {
    if (target.mv === 3) {
      if (cap.supportsBackgroundScripts) {
        manifest.background = {
          scripts: [`src/background/index.${ext}`],
        };
      } else {
        manifest.background = {
          service_worker: `src/background/index.${ext}`,
          type: 'module',
        };
      }
    } else {
      manifest.background = {
        scripts: [`src/background/index.${ext}`],
        persistent: false,
      };
    }
  }

  if (ctx.features.includes('popup')) {
    if (cap.popupKey === 'action') {
      manifest.action = {
        default_popup: 'src/popup/index.html',
      };
    } else {
      manifest.browser_action = {
        default_popup: 'src/popup/index.html',
      };
    }
  }

  if (ctx.features.includes('options')) {
    if (target.mv === 3) {
      manifest.options_ui = {
        page: 'src/options/index.html',
        open_in_tab: true,
      };
    } else {
      manifest.options_ui = {
        page: 'src/options/index.html',
        chrome_style: true,
      };
    }
  }

  if (ctx.features.includes('sidepanel') && cap.supportsSidePanel) {
    if (cap.sidePanelType === 'side_panel') {
      manifest.side_panel = {
        default_path: 'src/sidepanel/index.html',
      };
      permissions.push('sidePanel');
    } else if (cap.sidePanelType === 'sidebar_action') {
      manifest.sidebar_action = {
        default_panel: 'src/sidepanel/index.html',
      };
    }
  }

  if (ctx.features.includes('devtools') && cap.supportsDevtools) {
    manifest.devtools_page = 'src/devtools/devtools.html';
  }

  if (ctx.features.includes('newtab') && cap.supportsNewtab) {
    manifest.chrome_url_overrides = {
      newtab: 'src/newtab/index.html',
    };
  }

  if (ctx.features.includes('content')) {
    const matches = ctx.contentScript?.matches?.length
      ? ctx.contentScript.matches
      : ['https://*/*'];

    const contentEntry: Record<string, any> = {
      matches,
      js: [`src/content/index.${ext}`],
      run_at: ctx.contentScript?.runAt || 'document_idle',
    };

    if (ctx.contentScript?.css) {
      contentEntry.css = ['src/content/style.css'];
    }

    if (target.mv === 3 && cap.supportsWorldMain) {
      contentEntry.world = ctx.contentScript?.world || 'ISOLATED';
    }

    manifest.content_scripts = [contentEntry];
  }

  if (ctx.features.includes('dnr') && cap.supportsDnr && target.mv === 3) {
    manifest.declarative_net_request = {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'rules/rules.json',
        },
      ],
    };
    permissions.push('declarativeNetRequest');
    manifest.host_permissions = ['<all_urls>'];
  }

  if (ctx.extras.includes('storage')) {
    permissions.push('storage');
  }

  if (ctx.features.includes('background')) {
    if (ctx.extras.includes('contextmenu')) {
      permissions.push('contextMenus');
    }

    if (ctx.extras.includes('commands')) {
      manifest.commands = {
        _execute_action: {
          suggested_key: {
            default: 'Ctrl+Shift+Y',
            mac: 'Command+Shift+Y',
          },
          description: 'Toggle extension action',
        },
      };
    }

    if (ctx.extras.includes('omnibox')) {
      manifest.omnibox = {
        keyword: slug.slice(0, 10),
      };
    }
  }

  if (permissions.length > 0) {
    manifest.permissions = permissions;
  }

  if (target.browser === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: `${slug}@example.com`,
        strict_min_version: target.mv === 3 ? '109.0' : '58.0',
      },
    };
  }

  return manifest;
}

