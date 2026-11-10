/**
 * Source for every generated file. The TypeScript and JavaScript projects share the same code:
 * these snippets are valid in both, so only the file extension differs.
 */

export const BROWSER_MODULE = `import browser from 'webextension-polyfill';

export default browser;
`;

export const background = (ts: boolean): string => `import browser from '../lib/browser';

browser.runtime.onInstalled.addListener(() => {
  console.log('[background] installed');
});

browser.runtime.onMessage.addListener((message${ts ? ': unknown' : ''}) => {
  console.log('[background] message', message);
});
`;

/** Isolated-world content script. When a MAIN-world script exists it also receives its messages. */
export const content = (withMainWorld: boolean): string => `import browser from '../lib/browser';

console.log('[content] loaded on', location.href);

const observer = new MutationObserver(() => {
  // React to DOM changes here.
});
observer.observe(document.documentElement, { childList: true, subtree: true });
${
  withMainWorld
    ? `
// Messages from the MAIN-world script arrive here, where extension APIs are available.
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== 'main-world') return;
  browser.runtime.sendMessage(event.data);
});
`
    : ''
}`;

/** MAIN-world content script. Runs in the page, so it must not use any extension API. */
export const MAIN_WORLD = `// Runs inside the page's own JavaScript context (world: MAIN).
// Do not import webextension-polyfill here: extension APIs do not exist in this world.
// Talk to the isolated content script with postMessage instead.

console.log('[main-world] loaded');

window.postMessage({ source: 'main-world', type: 'ready' }, '*');
`;

export const page = (title: string, ext: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.${ext}"></script>
  </body>
</html>
`;

export const pageMain = (title: string): string => `const app = document.getElementById('app');

if (app) {
  app.textContent = '${title}';
}

export {};
`;

export const PAGE_STYLE = `body {
  margin: 0;
  padding: 16px;
  font-family: system-ui, sans-serif;
}
`;

export const GITIGNORE = `node_modules
dist
*.log
.DS_Store
`;

export const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
`;

export const JSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "checkJs": false,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`;
