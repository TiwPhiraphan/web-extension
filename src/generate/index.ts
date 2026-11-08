import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from '../cli/context.js';
import { resolveTargets, type TargetConfig } from './targets.js';
import { buildManifest } from './manifest.js';
import { buildPackageJson } from './pkgjson.js';
import { buildConfigs } from './tsconfig.js';
import { copyDirectory } from './copy.js';
import { toSlug } from '../utils/validate.js';
import { getInstallCommand, getRunCommand } from '../utils/pm.js';
import { generateVanillaProject } from './vanilla.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locates the templates directory regardless of whether running from src/ or dist/.
 */
export function getTemplatesDir(): string {
  const candidate1 = path.resolve(__dirname, '../../templates');
  if (fs.existsSync(candidate1)) {
    return candidate1;
  }
  const candidate2 = path.resolve(__dirname, '../templates');
  if (fs.existsSync(candidate2)) {
    return candidate2;
  }
  return path.resolve(process.cwd(), 'templates');
}

export function buildProjectReadme(ctx: Context, targets: TargetConfig[]): string {
  const pm = ctx.pm;
  const devCmd = getRunCommand(pm, 'dev');
  const buildCmd = getRunCommand(pm, 'build');
  const firstTarget = targets[0];

  let loadInstructions = '';
  for (const t of targets) {
    if (t.browser === 'chrome') {
      loadInstructions += `
### Chromium (Chrome, Edge, Brave, Opera)
1. Open \`chrome://extensions\` (or equivalent in your browser)
2. Enable **Developer mode** toggle in the top-right corner
3. Click **Load unpacked** and select the \`${t.outDir}\` directory
`;
    } else if (t.browser === 'firefox') {
      loadInstructions += `
### Firefox
1. Open \`about:debugging#/runtime/this-firefox\`
2. Click **Load Temporary Add-on...**
3. Select the \`manifest.json\` file inside \`${t.outDir}\`
*(Alternatively, run \`${getRunCommand(pm, 'run:firefox')}\`)*
`;
    } else if (t.browser === 'safari') {
      loadInstructions += `
### Safari
Safari requires converting the built extension with Xcode:
\`\`\`bash
xcrun safari-web-extension-converter ${t.outDir}
\`\`\`
Then open and run the generated Xcode project.
`;
    }
  }

  const scriptList = Object.entries(buildPackageJson(ctx, targets).scripts)
    .map(([name, cmd]) => `- \`${getRunCommand(pm, name)}\`: \`${cmd}\``)
    .join('\n');

  return `# ${ctx.projectName}

${ctx.projectName} browser extension built with Vite and CRXJS.

## Getting Started

### Development
\`\`\`bash
${devCmd}
\`\`\`

### Production Build
\`\`\`bash
${buildCmd}
\`\`\`

## Available Scripts
${scriptList}

## Loading the Extension in Your Browser
${loadInstructions}

## Before Publishing
- Update the extension name, description, and icons in \`public/icons/\`.
${targets.some((t) => t.browser === 'firefox') ? '- Customize the Firefox Gecko ID in `manifest.config` (default is placeholder `@example.com`).\n' : ''}${ctx.features.includes('dnr') ? '- Review the default rules in `public/rules/rules.json` and narrow `host_permissions` in the manifest.\n' : ''}
`;
}

export function generateProject(ctx: Context): { targetDir: string; targets: TargetConfig[] } {
  if (ctx.bundler === 'none') {
    return generateVanillaProject(ctx);
  }

  const targetDir = path.resolve(ctx.targetDir);
  const templatesDir = getTemplatesDir();
  const slug = toSlug(ctx.projectName);
  const targets = resolveTargets(ctx.browsers, ctx.firefoxMv, ctx.safariMv);
  const hasMv2 = targets.some((t) => t.mv === 2);
  const ext = ctx.language === 'ts' ? 'ts' : 'js';

  const replacements: Record<string, string> = {
    name: ctx.projectName,
    description: `${ctx.projectName} browser extension`,
    slug,
    pm: ctx.pm,
  };

  fs.mkdirSync(targetDir, { recursive: true });

  const baseDir = path.join(templatesDir, 'base');
  copyDirectory(baseDir, targetDir, replacements);

  const langDir = path.join(templatesDir, ctx.language);
  copyDirectory(langDir, targetDir, replacements);

  if (ctx.projectType === 'content-only') {
    const contentDir = path.join(templatesDir, 'features', 'content', 'content-only', ctx.language);
    copyDirectory(contentDir, targetDir, replacements);
    if (ctx.contentScript?.css) {
      const styleSrc = path.join(templatesDir, 'features', 'content', 'style.css');
      const styleDest = path.join(targetDir, 'src', 'content', 'style.css');
      fs.mkdirSync(path.dirname(styleDest), { recursive: true });
      fs.copyFileSync(styleSrc, styleDest);
    }
  } else {
    if (ctx.features.includes('background')) {
      const bgDir = path.join(templatesDir, 'features', 'background', ctx.language);
      copyDirectory(bgDir, targetDir, replacements);

      const bgFile = path.join(targetDir, 'src', 'background', `index.${ext}`);
      let bgContent = fs.readFileSync(bgFile, 'utf-8');

      if (ctx.extras.includes('contextmenu')) {
        bgContent += `\napi.contextMenus?.create?.({
  id: '${slug}-menu',
  title: '${ctx.projectName} Action',
  contexts: ['all'],
});

api.contextMenus?.onClicked?.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'tab:', tab?.id);
});\n`;
      }

      if (ctx.extras.includes('commands')) {
        bgContent += `\napi.commands?.onCommand?.addListener((command) => {
  console.log('Command received:', command);
});\n`;
      }

      if (ctx.extras.includes('omnibox')) {
        bgContent += `\napi.omnibox?.onInputEntered?.addListener((text, disposition) => {
  console.log('Omnibox search:', text, 'disposition:', disposition);
});\n`;
      }

      fs.writeFileSync(bgFile, bgContent, 'utf-8');
    }

    if (ctx.features.includes('content')) {
      const contentDir = path.join(templatesDir, 'features', 'content', 'full', ctx.language);
      copyDirectory(contentDir, targetDir, replacements);
      if (ctx.contentScript?.css) {
        const styleSrc = path.join(templatesDir, 'features', 'content', 'style.css');
        const styleDest = path.join(targetDir, 'src', 'content', 'style.css');
        fs.mkdirSync(path.dirname(styleDest), { recursive: true });
        fs.copyFileSync(styleSrc, styleDest);
      }
    }

    if (ctx.features.includes('popup')) {
      const popupDir = path.join(templatesDir, 'features', 'popup', ctx.language);
      copyDirectory(popupDir, targetDir, replacements);
    }

    if (ctx.features.includes('options')) {
      const optionsDir = path.join(templatesDir, 'features', 'options', ctx.language);
      copyDirectory(optionsDir, targetDir, replacements);
    }

    if (ctx.features.includes('sidepanel')) {
      const sidepanelDir = path.join(templatesDir, 'features', 'sidepanel', ctx.language);
      copyDirectory(sidepanelDir, targetDir, replacements);
    }

    if (ctx.features.includes('devtools')) {
      const devtoolsDir = path.join(templatesDir, 'features', 'devtools', ctx.language);
      copyDirectory(devtoolsDir, targetDir, replacements);
    }

    if (ctx.features.includes('newtab')) {
      const newtabDir = path.join(templatesDir, 'features', 'newtab', ctx.language);
      copyDirectory(newtabDir, targetDir, replacements);
    }

    if (ctx.features.includes('dnr')) {
      const dnrSrc = path.join(templatesDir, 'features', 'dnr', 'rules.json');
      const dnrDest = path.join(targetDir, 'public', 'rules', 'rules.json');
      fs.mkdirSync(path.dirname(dnrDest), { recursive: true });
      fs.copyFileSync(dnrSrc, dnrDest);
    }

    if (ctx.extras.includes('storage')) {
      const storageDir = path.join(templatesDir, 'features', 'extras', 'storage', ctx.language);
      copyDirectory(storageDir, targetDir, replacements);
    }
  }

  const targetsConfigContent = `export interface TargetConfig {
  id: string;
  browser: 'chrome' | 'firefox' | 'safari';
  mv: 2 | 3;
  outDir: string;
}

export const targets: TargetConfig[] = ${JSON.stringify(targets, null, 2)};

export function getTarget(mode: string): TargetConfig {
  const found = targets.find((t) => t.id === mode);
  return found || targets[0];
}
`;
  fs.writeFileSync(
    path.join(targetDir, `targets.config.${ext}`),
    ctx.language === 'ts'
      ? targetsConfigContent
      : targetsConfigContent.replace(/export interface TargetConfig \{[\s\S]*?\}\n\n/, '').replace(/: TargetConfig\[\]/g, '').replace(/: string/g, '').replace(/: TargetConfig/g, ''),
    'utf-8',
  );

  const manifestMap: Record<string, any> = {};
  for (const t of targets) {
    manifestMap[t.id] = buildManifest(ctx, t);
  }

  const manifestConfigContent = ctx.language === 'ts'
    ? `import type { TargetConfig } from './targets.config';

const manifests: Record<string, any> = ${JSON.stringify(manifestMap, null, 2)};

export function buildManifest(target: TargetConfig): any {
  return manifests[target.id] || manifests['${targets[0].id}'];
}
`
    : `const manifests = ${JSON.stringify(manifestMap, null, 2)};

export function buildManifest(target) {
  return manifests[target.id] || manifests['${targets[0].id}'];
}
`;
  fs.writeFileSync(path.join(targetDir, `manifest.config.${ext}`), manifestConfigContent, 'utf-8');

  if (hasMv2) {
    const mv2Dir = path.join(targetDir, 'build');
    fs.mkdirSync(mv2Dir, { recursive: true });

    const mv2Content = ctx.language === 'ts'
      ? `import type { Plugin } from 'vite';
import { build as viteBuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export function buildMv2Plugin(options: { target: any; manifest: any }): Plugin {
  const { manifest } = options;
  let config: any;

  return {
    name: 'web-extension:mv2-builder',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async writeBundle() {
      const outDir = config.build.outDir;
      const root = config.root || process.cwd();
      const mv2Manifest = JSON.parse(JSON.stringify(manifest));

      if (manifest.background?.scripts?.length) {
        const outScripts: string[] = [];
        for (let i = 0; i < manifest.background.scripts.length; i++) {
          const entryPath = path.resolve(root, manifest.background.scripts[i]);
          const outName = 'background.js';
          await viteBuild({
            configFile: false,
            root,
            build: {
              lib: {
                entry: entryPath,
                formats: ['iife'],
                name: 'ExtensionBackground',
                fileName: () => outName,
              },
              outDir,
              emptyOutDir: false,
              sourcemap: config.build.sourcemap,
            },
          });
          outScripts.push(outName);
        }
        mv2Manifest.background.scripts = outScripts;
      }

      if (manifest.content_scripts?.length) {
        for (let sIdx = 0; sIdx < manifest.content_scripts.length; sIdx++) {
          const cs = manifest.content_scripts[sIdx];
          if (cs.js?.length) {
            const outJs: string[] = [];
            for (let jIdx = 0; jIdx < cs.js.length; jIdx++) {
              const entryPath = path.resolve(root, cs.js[jIdx]);
              const outName = \`content-\${sIdx}-\${jIdx}.js\`;
              await viteBuild({
                configFile: false,
                root,
                build: {
                  lib: {
                    entry: entryPath,
                    formats: ['iife'],
                    name: \`ExtensionContent_\${sIdx}_\${jIdx}\`,
                    fileName: () => outName,
                  },
                  outDir,
                  emptyOutDir: false,
                  sourcemap: config.build.sourcemap,
                },
              });
              outJs.push(outName);
            }
            mv2Manifest.content_scripts[sIdx].js = outJs;
          }

          if (cs.css?.length) {
            const outCss: string[] = [];
            for (let cIdx = 0; cIdx < cs.css.length; cIdx++) {
              const srcCss = path.resolve(root, cs.css[cIdx]);
              const outCssName = \`content-\${sIdx}-\${cIdx}.css\`;
              if (fs.existsSync(srcCss)) {
                fs.copyFileSync(srcCss, path.join(outDir, outCssName));
                outCss.push(outCssName);
              }
            }
            mv2Manifest.content_scripts[sIdx].css = outCss;
          }
        }
      }

      const iconsDir = path.resolve(root, 'public', 'icons');
      if (fs.existsSync(iconsDir)) {
        const outIcons = path.join(outDir, 'icons');
        fs.mkdirSync(outIcons, { recursive: true });
        for (const icon of fs.readdirSync(iconsDir)) {
          fs.copyFileSync(path.join(iconsDir, icon), path.join(outIcons, icon));
        }
      }

      fs.writeFileSync(
        path.join(outDir, 'manifest.json'),
        JSON.stringify(mv2Manifest, null, 2),
      );
    },
  };
}
`
      : `import { build as viteBuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export function buildMv2Plugin(options) {
  const { manifest } = options;
  let config;

  return {
    name: 'web-extension:mv2-builder',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async writeBundle() {
      const outDir = config.build.outDir;
      const root = config.root || process.cwd();
      const mv2Manifest = JSON.parse(JSON.stringify(manifest));

      if (manifest.background?.scripts?.length) {
        const outScripts = [];
        for (let i = 0; i < manifest.background.scripts.length; i++) {
          const entryPath = path.resolve(root, manifest.background.scripts[i]);
          const outName = 'background.js';
          await viteBuild({
            configFile: false,
            root,
            build: {
              lib: {
                entry: entryPath,
                formats: ['iife'],
                name: 'ExtensionBackground',
                fileName: () => outName,
              },
              outDir,
              emptyOutDir: false,
              sourcemap: config.build.sourcemap,
            },
          });
          outScripts.push(outName);
        }
        mv2Manifest.background.scripts = outScripts;
      }

      if (manifest.content_scripts?.length) {
        for (let sIdx = 0; sIdx < manifest.content_scripts.length; sIdx++) {
          const cs = manifest.content_scripts[sIdx];
          if (cs.js?.length) {
            const outJs = [];
            for (let jIdx = 0; jIdx < cs.js.length; jIdx++) {
              const entryPath = path.resolve(root, cs.js[jIdx]);
              const outName = \`content-\${sIdx}-\${jIdx}.js\`;
              await viteBuild({
                configFile: false,
                root,
                build: {
                  lib: {
                    entry: entryPath,
                    formats: ['iife'],
                    name: \`ExtensionContent_\${sIdx}_\${jIdx}\`,
                    fileName: () => outName,
                  },
                  outDir,
                  emptyOutDir: false,
                  sourcemap: config.build.sourcemap,
                },
              });
              outJs.push(outName);
            }
            mv2Manifest.content_scripts[sIdx].js = outJs;
          }

          if (cs.css?.length) {
            const outCss = [];
            for (let cIdx = 0; cIdx < cs.css.length; cIdx++) {
              const srcCss = path.resolve(root, cs.css[cIdx]);
              const outCssName = \`content-\${sIdx}-\${cIdx}.css\`;
              if (fs.existsSync(srcCss)) {
                fs.copyFileSync(srcCss, path.join(outDir, outCssName));
                outCss.push(outCssName);
              }
            }
            mv2Manifest.content_scripts[sIdx].css = outCss;
          }
        }
      }

      const iconsDir = path.resolve(root, 'public', 'icons');
      if (fs.existsSync(iconsDir)) {
        const outIcons = path.join(outDir, 'icons');
        fs.mkdirSync(outIcons, { recursive: true });
        for (const icon of fs.readdirSync(iconsDir)) {
          fs.copyFileSync(path.join(iconsDir, icon), path.join(outIcons, icon));
        }
      }

      fs.writeFileSync(
        path.join(outDir, 'manifest.json'),
        JSON.stringify(mv2Manifest, null, 2),
      );
    },
  };
}
`;
    fs.writeFileSync(path.join(mv2Dir, `mv2.${ext}`), mv2Content, 'utf-8');
  }

  const hasMv3 = targets.some((t) => t.mv === 3);
  let pluginsExpression = '';
  if (hasMv3 && hasMv2) {
    pluginsExpression = `isMv3
      ? [
          crx({
            manifest,
            browser: target.browser === 'firefox' ? 'firefox' : 'chrome',
          }),
        ]
      : [buildMv2Plugin({ target, manifest })]`;
  } else if (hasMv3) {
    pluginsExpression = `[
          crx({
            manifest,
            browser: target.browser === 'firefox' ? 'firefox' : 'chrome',
          }),
        ]`;
  } else {
    pluginsExpression = `[buildMv2Plugin({ target, manifest })]`;
  }

  const viteConfigContent = `import { defineConfig } from 'vite';
${hasMv3 ? "import { crx } from '@crxjs/vite-plugin';" : ''}
import { getTarget } from './targets.config';
import { buildManifest } from './manifest.config';
${hasMv2 ? "import { buildMv2Plugin } from './build/mv2';" : ''}

function getHtmlInputs(manifest${ctx.language === 'ts' ? ': any' : ''}) {
  const inputs${ctx.language === 'ts' ? ': Record<string, string>' : ''} = {};
  if (manifest.action?.default_popup || manifest.browser_action?.default_popup) {
    inputs.popup = manifest.action?.default_popup || manifest.browser_action?.default_popup;
  }
  if (manifest.options_ui?.page) {
    inputs.options = manifest.options_ui.page;
  }
  if (manifest.side_panel?.default_path || manifest.sidebar_action?.default_panel) {
    inputs.sidepanel = manifest.side_panel?.default_path || manifest.sidebar_action?.default_panel;
  }
  if (manifest.devtools_page) {
    inputs.devtools = manifest.devtools_page;
  }
  if (manifest.chrome_url_overrides?.newtab) {
    inputs.newtab = manifest.chrome_url_overrides.newtab;
  }
  return inputs;
}

export default defineConfig(({ mode }) => {
  const target = getTarget(mode);
  const manifest = buildManifest(target);
  const isMv3 = target.mv === 3;

  const htmlInputs = !isMv3 ? getHtmlInputs(manifest) : {};
  const hasInputs = Object.keys(htmlInputs).length > 0;

  return {
    build: {
      outDir: \`dist/\${target.id}\`,
      emptyOutDir: true,
      ...(!isMv3
        ? {
            rollupOptions: hasInputs
              ? { input: htmlInputs }
              : undefined,
            ...(hasInputs
              ? {}
              : {
                  lib: {
                    entry: manifest.content_scripts?.[0]?.js?.[0] || 'src/content/index.${ext}',
                    formats: ['iife'],
                    name: 'ExtensionContent',
                    fileName: () => 'content-0-0.js',
                  },
                }),
          }
        : {}),
    },
    plugins: ${pluginsExpression},
  };
});
`;
  fs.writeFileSync(path.join(targetDir, `vite.config.${ext}`), viteConfigContent, 'utf-8');

  const pkgJson = buildPackageJson(ctx, targets);
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

  const configs = buildConfigs(ctx, targets);
  for (const [relPath, content] of Object.entries(configs)) {
    const fullPath = path.join(targetDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  const readmeContent = buildProjectReadme(ctx, targets);
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');

  return { targetDir, targets };
}

