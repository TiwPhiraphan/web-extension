/**
 * Optional end-to-end check in a real Chromium. Not part of `npm test` (needs Playwright and a browser).
 *
 *   node test/e2e/chromium.cjs <project-dir>
 *
 * The project must be generated with: --entries background,content,main-world,popup --matches 'http://127.0.0.1/*'
 * and have the `web-extension` CLI installed (its dev server is started here).
 *
 * Phase 1 loads the extension and edits a source file; the dev client inside the extension must see the
 * new build and call chrome.runtime.reload(). The call is replaced by a beacon so we can observe it:
 * Chromium started with --load-extension leaves the extension disabled after a real reload, which would
 * stop the checks that follow. Phase 2 loads the extension and checks content, MAIN-world and popup.
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const app = path.resolve(process.argv[2] ?? '.');
const dist = path.join(app, 'dist/chrome');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
};

async function startDev() {
  // Run the CLI with node directly: signalling `npx` would leave the real process running.
  const bin = path.join(app, 'node_modules/web-extension/dist/index.js');
  const child = spawn(process.execPath, [bin, 'dev', '--browser', 'chrome'], { cwd: app });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !/Reload server on port/.test(log); i++) await sleep(100);
  return { child, log: () => log };
}

const launch = (extension) => {
  const extPosix = path.resolve(extension).replace(/\\/g, '/');
  return chromium.launchPersistentContext('', {
    ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } : {}),
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${extPosix}`, `--load-extension=${extPosix}`],
  });
};

async function pageServer() {
  const beacons = [];
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/beacon/')) beacons.push(req.url);
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>t</title><body>hello</body>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, beacons, port: server.address().port };
}

async function reloadPhase() {
  const dev = await startDev();
  check('dev started', /Reload server on port \d+/.test(dev.log()));
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
  check('dev manifest uses the reload wrapper', manifest.background?.service_worker === 'web-extension-dev/sw.js');

  const { server, beacons, port } = await pageServer();
  const ctx = await launch(dist);

  // The worker handle goes stale if Chromium restarts the service worker, so fetch it again on failure.
  const hookReload = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 10000 }));
      try {
        await sw.evaluate((url) => {
          chrome.runtime.reload = () => {
            fetch(url).catch(() => {});
          };
        }, `http://127.0.0.1:${port}/beacon/reload-called`);
        return;
      } catch {
        await sleep(300);
      }
    }
    throw new Error('could not reach the extension service worker');
  };
  // The dev client takes its baseline version from its first poll; give it time to do that.
  await sleep(1500);
  await hookReload();

  const file = path.join(app, 'src/background/index.ts');
  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}\nconsole.log('edit-${Date.now()}');\n`);
  for (let i = 0; i < 80 && !beacons.includes('/beacon/reload-called'); i++) await sleep(100);
  check('dev client called runtime.reload() after the edit', beacons.includes('/beacon/reload-called'));
  const built = fs.readFileSync(path.join(dist, 'src/background/index.js'), 'utf8');
  check('the new build was on disk when reload was requested', /edit-\d+/.test(built));

  await ctx.close();
  server.close();
  dev.child.kill('SIGINT');
  await sleep(300);
}

async function loadPhase() {
  const dev = await startDev();
  const { server, port } = await pageServer();
  const ctx = await launch(dist);
  const lines = [];
  const page = await ctx.newPage();
  page.on('console', (m) => lines.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/`);
  await sleep(1500);
  check('content script ran', lines.some((l) => l.includes('[content] loaded on')), JSON.stringify(lines));
  check('MAIN-world script ran', lines.some((l) => l.includes('[main-world] loaded')));

  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 5000 }).catch(() => undefined));
  check('service worker registered', Boolean(sw));
  if (sw) {
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${new URL(sw.url()).host}/src/popup/index.html`);
    check('popup renders', (await popup.textContent('#app')) === 'Popup');
  }

  const marker = `content-${Date.now()}`;
  const file = path.join(app, 'src/content/index.ts');
  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}\nconsole.log('${marker}');\n`);
  const built = path.join(dist, 'src/content/index.js');
  for (let i = 0; i < 50 && !fs.readFileSync(built, 'utf8').includes(marker); i++) await sleep(100);
  check('content edit rebuilt into dist', fs.readFileSync(built, 'utf8').includes(marker));

  await ctx.close();
  server.close();
  dev.child.kill('SIGINT');
  await sleep(300);
}

(async () => {
  await reloadPhase();
  await loadPhase();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((err) => {
  console.error('test crashed', err);
  process.exit(2);
});
