import fs from 'node:fs';
import path from 'node:path';
import type { Context } from '../cli/context.js';
import { resolveTargets, type TargetConfig } from './targets.js';
import { toSlug } from '../utils/validate.js';
import { getTemplatesDir } from './index.js';
import { getRunCommand, getInstallCommand } from '../utils/pm.js';

export function buildVanillaManifest(ctx: Context, target: TargetConfig): Record<string, any> {
  const slug = toSlug(ctx.projectName);
  const scriptExt = 'js';

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
      js: [`src/content.${scriptExt}`],
      run_at: ctx.contentScript?.runAt || 'document_idle',
    };

    if (ctx.contentScript?.css) {
      contentEntry.css = ['src/content.css'];
    }

    if (target.mv === 3) {
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
      if (target.browser === 'firefox') {
        manifest.background = {
          scripts: [`src/background.${scriptExt}`],
        };
      } else {
        manifest.background = {
          service_worker: `src/background.${scriptExt}`,
          type: 'module',
        };
      }
    } else {
      manifest.background = {
        scripts: [`src/background.${scriptExt}`],
        persistent: false,
      };
    }
  }

  if (ctx.features.includes('popup')) {
    if (target.mv === 3) {
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

  if (ctx.features.includes('sidepanel')) {
    if (target.browser === 'firefox') {
      manifest.sidebar_action = {
        default_panel: 'src/sidepanel/index.html',
      };
    } else {
      manifest.side_panel = {
        default_path: 'src/sidepanel/index.html',
      };
      permissions.push('sidePanel');
    }
  }

  if (ctx.features.includes('devtools')) {
    manifest.devtools_page = 'src/devtools/devtools.html';
  }

  if (ctx.features.includes('newtab')) {
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
      js: [`src/content.${scriptExt}`],
      run_at: ctx.contentScript?.runAt || 'document_idle',
    };

    if (ctx.contentScript?.css) {
      contentEntry.css = ['src/content.css'];
    }

    if (target.mv === 3) {
      contentEntry.world = ctx.contentScript?.world || 'ISOLATED';
    }

    manifest.content_scripts = [contentEntry];
  }

  if (ctx.features.includes('dnr') && target.mv === 3) {
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

export function buildVanillaReadme(ctx: Context, isTs: boolean): string {
  const pm = ctx.pm;

  let loadGuide = `### Chromium (Chrome, Edge, Brave, Opera)
1. Open \`chrome://extensions\` in your browser
2. Turn on **Developer mode** in the top-right corner
3. Click **Load unpacked** and select:
   - \`${isTs ? 'dist/' : '.'}\` (this directory)
4. To test updates, click the reload icon on the extension card in \`chrome://extensions\`.
`;

  if (ctx.browsers.includes('firefox')) {
    loadGuide += `
### Firefox
1. Open \`about:debugging#/runtime/this-firefox\`
2. Click **Load Temporary Add-on...**
3. Select the \`${isTs ? 'dist/' : ''}manifest.json\` file
`;
  }

  if (ctx.browsers.includes('safari')) {
    loadGuide += `
### Safari
Safari requires converting the extension with Xcode:
\`\`\`bash
xcrun safari-web-extension-converter ${isTs ? 'dist' : '.'}
\`\`\`
Then open and run the generated Xcode project.
`;
  }

  let devGuide = '';
  if (isTs) {
    devGuide = `## Scripts & Development

### Install Dependencies
\`\`\`bash
${getInstallCommand(pm)}
\`\`\`

### Watch Mode
\`\`\`bash
${getRunCommand(pm, 'dev')}
\`\`\`

### Production Build
\`\`\`bash
${getRunCommand(pm, 'build')}
\`\`\`
`;
  }

  return `# ${ctx.projectName}

${ctx.projectName} browser extension (${isTs ? 'TypeScript' : 'Vanilla Zero-Build'}).

## Loading the Extension in Your Browser

${loadGuide}
${devGuide}
## Extension Details
- **Type**: ${ctx.projectType === 'content-only' ? 'Content Script Only' : 'Full Extension'}
- **Build Tool**: Vanilla / Zero-Build (No bundler)
- **Manifest Version**: MV3
`;
}

export function generateVanillaProject(ctx: Context): { targetDir: string; targets: TargetConfig[] } {
  const targetDir = path.resolve(ctx.targetDir);
  const templatesDir = getTemplatesDir();
  const slug = toSlug(ctx.projectName);
  const targets = resolveTargets(ctx.browsers, ctx.firefoxMv, ctx.safariMv);
  const primaryTarget = targets[0];
  const isTs = ctx.language === 'ts';
  const ext = isTs ? 'ts' : 'js';

  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Icons
  const iconsSrc = path.join(templatesDir, 'base', 'public', 'icons');
  const iconsDest = path.join(targetDir, 'icons');
  fs.mkdirSync(iconsDest, { recursive: true });
  for (const file of fs.readdirSync(iconsSrc)) {
    fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDest, file));
  }

  if (isTs) {
    const distIconsDest = path.join(targetDir, 'dist', 'icons');
    fs.mkdirSync(distIconsDest, { recursive: true });
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.join(iconsSrc, file), path.join(distIconsDest, file));
    }
  }

  // 2. Manifest
  const manifest = buildVanillaManifest(ctx, primaryTarget);
  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  if (isTs) {
    fs.mkdirSync(path.join(targetDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'dist', 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
  }

  // 3. .gitignore
  const gitignoreContent = isTs ? 'node_modules\ndist\n.DS_Store\n' : 'node_modules\n.DS_Store\n';
  fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignoreContent, 'utf-8');

  // Helper to write file to src/ and optionally copy to dist/src/ if static file (html/css)
  const writeSrcFile = (relPath: string, content: string, isStatic = false) => {
    const fullPath = path.join(targetDir, 'src', relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');

    if (isTs && isStatic) {
      const distPath = path.join(targetDir, 'dist', 'src', relPath);
      fs.mkdirSync(path.dirname(distPath), { recursive: true });
      fs.writeFileSync(distPath, content, 'utf-8');
    }
  };

  // 4. Code & Assets
  if (ctx.projectType === 'content-only') {
    const contentJs = `console.log('${ctx.projectName} content script (DOM injector) initialized on', window.location.href);

function initDomHacks() {
  const badge = document.createElement('div');
  badge.className = 'we-injected-badge';
  badge.textContent = '${ctx.projectName} Active';
  document.body.appendChild(badge);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener(
    'pagehide',
    () => {
      observer.disconnect();
    },
    { once: true }
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDomHacks);
} else {
  initDomHacks();
}
`;
    writeSrcFile(`content.${ext}`, contentJs);

    if (ctx.contentScript?.css) {
      const styleSrc = path.join(templatesDir, 'features', 'content', 'style.css');
      const cssContent = fs.readFileSync(styleSrc, 'utf-8');
      writeSrcFile('content.css', cssContent, true);
    }
  } else {
    // Background
    if (ctx.features.includes('background')) {
      let bgContent = `chrome.runtime.onInstalled.addListener((details) => {
  console.log('${ctx.projectName} extension installed or updated:', details.reason);
});\n`;

      if (ctx.extras.includes('contextmenu')) {
        bgContent += `\nchrome.contextMenus?.create?.({
  id: '${slug}-menu',
  title: '${ctx.projectName} Action',
  contexts: ['all'],
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'tab:', tab?.id);
});\n`;
      }

      if (ctx.extras.includes('commands')) {
        bgContent += `\nchrome.commands?.onCommand?.addListener((command) => {
  console.log('Command received:', command);
});\n`;
      }

      if (ctx.extras.includes('omnibox')) {
        bgContent += `\nchrome.omnibox?.onInputEntered?.addListener((text, disposition) => {
  console.log('Omnibox search:', text, 'disposition:', disposition);
});\n`;
      }

      writeSrcFile(`background.${ext}`, bgContent);
    }

    // Content
    if (ctx.features.includes('content')) {
      const contentJs = `console.log('${ctx.projectName} content script loaded on', window.location.href);

chrome.runtime?.sendMessage?.({ type: 'CONTENT_LOADED', url: window.location.href }).catch(() => {});
`;
      writeSrcFile(`content.${ext}`, contentJs);

      if (ctx.contentScript?.css) {
        const styleSrc = path.join(templatesDir, 'features', 'content', 'style.css');
        const cssContent = fs.readFileSync(styleSrc, 'utf-8');
        writeSrcFile('content.css', cssContent, true);
      }
    }

    // Popup
    if (ctx.features.includes('popup')) {
      const popupHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Popup</title>
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <div class="container">
      <h1>${ctx.projectName}</h1>
      <p id="status">Extension popup loaded.</p>
      <button id="btn">Click me</button>
    </div>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
`;
      const popupCss = `body {
  margin: 0;
  padding: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-width: 280px;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h1 {
  font-size: 16px;
  margin: 0;
  color: #1e293b;
}

p {
  font-size: 14px;
  margin: 0;
  color: #64748b;
}

button {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

button:hover {
  background-color: #1d4ed8;
}
`;
      const popupScript = `document.getElementById('btn')?.addEventListener('click', () => {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Button clicked!';
  }
});
`;
      writeSrcFile('popup/index.html', popupHtml, true);
      writeSrcFile('popup/popup.css', popupCss, true);
      writeSrcFile(`popup/popup.${ext}`, popupScript);
    }

    // Options
    if (ctx.features.includes('options')) {
      const optionsHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Options</title>
    <link rel="stylesheet" href="./options.css" />
  </head>
  <body>
    <div class="container">
      <h1>${ctx.projectName} Settings</h1>
      <label>
        <input type="checkbox" id="enabled" />
        Enable extension feature
      </label>
    </div>
    <script type="module" src="./options.js"></script>
  </body>
</html>
`;
      const optionsCss = `body {
  margin: 0;
  padding: 24px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h1 {
  font-size: 20px;
  margin: 0;
  color: #1e293b;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}
`;
      const optionsScript = `const checkbox = document.getElementById('enabled');
if (checkbox) {
  chrome.storage?.local?.get(['enabled'], (result) => {
    (checkbox as HTMLInputElement).checked = Boolean(result.enabled);
  });
  checkbox.addEventListener('change', (e) => {
    chrome.storage?.local?.set({ enabled: (e.target as HTMLInputElement).checked });
  });
}
`;
      writeSrcFile('options/index.html', optionsHtml, true);
      writeSrcFile('options/options.css', optionsCss, true);
      writeSrcFile(
        `options/options.${ext}`,
        isTs ? optionsScript : optionsScript.replace(/ as HTMLInputElement/g, ''),
      );
    }

    // Sidepanel
    if (ctx.features.includes('sidepanel')) {
      const sidepanelHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Side Panel</title>
    <link rel="stylesheet" href="./sidepanel.css" />
  </head>
  <body>
    <div class="container">
      <h2>${ctx.projectName} Panel</h2>
      <p>Side panel content loaded.</p>
    </div>
    <script type="module" src="./sidepanel.js"></script>
  </body>
</html>
`;
      const sidepanelCss = `body {
  margin: 0;
  padding: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`;
      const sidepanelScript = `console.log('Side panel loaded');\n`;
      writeSrcFile('sidepanel/index.html', sidepanelHtml, true);
      writeSrcFile('sidepanel/sidepanel.css', sidepanelCss, true);
      writeSrcFile(`sidepanel/sidepanel.${ext}`, sidepanelScript);
    }

    // DevTools
    if (ctx.features.includes('devtools')) {
      const devtoolsHtml = `<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="./devtools.js"></script>
  </head>
  <body></body>
</html>
`;
      const devtoolsScript = `chrome.devtools.panels.create(
  '${ctx.projectName}',
  'icons/16.png',
  'src/devtools/panel.html',
  () => {}
);
`;
      const panelHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>${ctx.projectName} DevTools</title>
  </head>
  <body>
    <h2>${ctx.projectName} DevTools Panel</h2>
    <script type="module" src="./panel.js"></script>
  </body>
</html>
`;
      const panelScript = `console.log('DevTools panel active');\n`;

      writeSrcFile('devtools/devtools.html', devtoolsHtml, true);
      writeSrcFile(`devtools/devtools.${ext}`, devtoolsScript);
      writeSrcFile('devtools/panel.html', panelHtml, true);
      writeSrcFile(`devtools/panel.${ext}`, panelScript);
    }

    // New Tab
    if (ctx.features.includes('newtab')) {
      const newtabHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>New Tab</title>
    <link rel="stylesheet" href="./newtab.css" />
  </head>
  <body>
    <h1>${ctx.projectName}</h1>
    <script type="module" src="./newtab.js"></script>
  </body>
</html>
`;
      const newtabCss = `body {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  margin: 0;
  font-family: system-ui, sans-serif;
}
`;
      const newtabScript = `console.log('New tab override loaded');\n`;
      writeSrcFile('newtab/index.html', newtabHtml, true);
      writeSrcFile('newtab/newtab.css', newtabCss, true);
      writeSrcFile(`newtab/newtab.${ext}`, newtabScript);
    }

    // DNR Rules
    if (ctx.features.includes('dnr')) {
      const dnrSrc = path.join(templatesDir, 'features', 'dnr', 'rules.json');
      const dnrDest = path.join(targetDir, 'rules', 'rules.json');
      fs.mkdirSync(path.dirname(dnrDest), { recursive: true });
      fs.copyFileSync(dnrSrc, dnrDest);

      if (isTs) {
        const distDnrDest = path.join(targetDir, 'dist', 'rules', 'rules.json');
        fs.mkdirSync(path.dirname(distDnrDest), { recursive: true });
        fs.copyFileSync(dnrSrc, distDnrDest);
      }
    }

    // Storage Extra
    if (ctx.extras.includes('storage')) {
      const storageCode = isTs
        ? `export const storage = {
  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const res = await chrome.storage.local.get([key]);
    return res[key] !== undefined ? res[key] : defaultValue;
  },
  async set(key: string, value: any): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove([key]);
  },
};
`
        : `export const storage = {
  async get(key, defaultValue) {
    const res = await chrome.storage.local.get([key]);
    return res[key] !== undefined ? res[key] : defaultValue;
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key) {
    await chrome.storage.local.remove([key]);
  },
};
`;
      writeSrcFile(`lib/storage.${ext}`, storageCode);
    }
  }

  // 5. TypeScript Config (if TS)
  if (isTs) {
    const types = ['chrome'];
    if (ctx.browsers.includes('firefox')) {
      types.push('firefox-webext-browser');
    }

    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        rootDir: '.',
        outDir: 'dist',
        strict: true,
        skipLibCheck: true,
        types,
      },
      include: ['src/**/*'],
    };
    fs.writeFileSync(
      path.join(targetDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2),
      'utf-8',
    );
  }

  // 6. package.json
  const pkgJson: Record<string, any> = {
    name: ctx.projectName,
    version: '0.0.1',
    description: `${ctx.projectName} browser extension`,
    type: 'module',
  };

  if (isTs) {
    pkgJson.scripts = {
      build: 'tsc',
      dev: 'tsc --watch',
    };
    const devDeps: Record<string, string> = {
      typescript: '^5.8.2',
      '@types/chrome': '^0.3.7',
    };
    if (ctx.browsers.includes('firefox')) {
      devDeps['@types/firefox-webext-browser'] = '^143.0.1';
    }
    pkgJson.devDependencies = devDeps;
  }

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2),
    'utf-8',
  );

  // 7. README.md
  const readmeContent = buildVanillaReadme(ctx, isTs);
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');

  return { targetDir, targets };
}

