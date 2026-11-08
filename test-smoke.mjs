import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cliPath = path.resolve('dist/index.js');

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
}

function verifyDist(outDir, manifest) {
  if (manifest.icons) {
    for (const [size, iconRel] of Object.entries(manifest.icons)) {
      const p = path.join(outDir, iconRel);
      if (!fs.existsSync(p)) throw new Error(`Missing icon in dist: ${iconRel}`);
    }
  }

  if (manifest.background?.service_worker) {
    const p = path.join(outDir, manifest.background.service_worker);
    if (!fs.existsSync(p)) throw new Error(`Missing service worker in dist: ${manifest.background.service_worker}`);
  }
  if (manifest.background?.scripts) {
    for (const s of manifest.background.scripts) {
      const p = path.join(outDir, s);
      if (!fs.existsSync(p)) throw new Error(`Missing background script in dist: ${s}`);
    }
  }

  const popup = manifest.action?.default_popup || manifest.browser_action?.default_popup;
  if (popup) {
    const p = path.join(outDir, popup);
    if (!fs.existsSync(p)) throw new Error(`Missing popup html in dist: ${popup}`);
  }

  if (manifest.options_ui?.page) {
    const p = path.join(outDir, manifest.options_ui.page);
    if (!fs.existsSync(p)) throw new Error(`Missing options html in dist: ${manifest.options_ui.page}`);
  }

  const panel = manifest.side_panel?.default_path || manifest.sidebar_action?.default_panel;
  if (panel) {
    const p = path.join(outDir, panel);
    if (!fs.existsSync(p)) throw new Error(`Missing sidepanel in dist: ${panel}`);
  }

  if (manifest.content_scripts) {
    for (const cs of manifest.content_scripts) {
      if (cs.js) {
        for (const jsFile of cs.js) {
          const p = path.join(outDir, jsFile);
          if (!fs.existsSync(p)) throw new Error(`Missing content script in dist: ${jsFile}`);
        }
      }
      if (cs.css) {
        for (const cssFile of cs.css) {
          const p = path.join(outDir, cssFile);
          if (!fs.existsSync(p)) throw new Error(`Missing content css in dist: ${cssFile}`);
        }
      }
    }
  }
}

async function testSuite(name, flags, expectedTargets, isContentOnly) {
  console.log(`\n================ Running Smoke Suite ${name} ================`);
  const tmpDir = path.join(os.tmpdir(), `we-smoke-${name.toLowerCase()}-${Date.now()}`);

  try {
    const genCmd = `node "${cliPath}" "${tmpDir}" ${flags} --yes --install --no-git --pm bun`;
    console.log(`[${name}] Generating in ${tmpDir}...`);
    run(genCmd);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    console.log(`[${name}] Package name: ${pkg.name}`);

    console.log(`[${name}] Running typecheck...`);
    run('bun run typecheck', tmpDir);

    for (const t of expectedTargets) {
      console.log(`[${name}] Building target: ${t.browser} (mode: ${t.id})...`);
      run(`bun run build:${t.browser}`, tmpDir);

      const outDir = path.join(tmpDir, t.outDir);
      const manifestFile = path.join(outDir, 'manifest.json');
      if (!fs.existsSync(manifestFile)) {
        throw new Error(`Manifest not found at ${manifestFile}`);
      }

      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
      expect(manifest.manifest_version).toBe(t.mv);

      verifyDist(outDir, manifest);

      if (isContentOnly) {
        if (manifest.permissions) {
          throw new Error(`Content-only mode must not have permissions, got: ${JSON.stringify(manifest.permissions)}`);
        }
        if (manifest.background || manifest.action || manifest.browser_action || manifest.options_ui) {
          throw new Error('Content-only mode must not have background or UI entries');
        }
      }
      console.log(`[${name}] Target ${t.id} build and verification OK!`);
    }

    console.log(`[${name}] SUITE PASSED!`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
  };
}

async function testSuiteVanilla(name, flags) {
  console.log(`\n================ Running Smoke Suite ${name} (Vanilla) ================`);
  const tmpDir = path.join(os.tmpdir(), `we-smoke-${name.toLowerCase()}-${Date.now()}`);

  try {
    const genCmd = `node "${cliPath}" "${tmpDir}" ${flags} --yes --no-install --no-git`;
    console.log(`[${name}] Generating in ${tmpDir}...`);
    run(genCmd);

    const manifestFile = path.join(tmpDir, 'manifest.json');
    if (!fs.existsSync(manifestFile)) {
      throw new Error(`Manifest not found at ${manifestFile}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    expect(manifest.manifest_version).toBe(3);

    // Verify all referenced files in manifest exist
    verifyDist(tmpDir, manifest);

    // Verify no bundler configs exist
    if (fs.existsSync(path.join(tmpDir, 'vite.config.js')) || fs.existsSync(path.join(tmpDir, 'targets.config.js'))) {
      throw new Error('Vanilla project must not have vite or targets configs');
    }

    // Verify package.json zero-dep
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    if (pkg.dependencies || pkg.devDependencies) {
      throw new Error('Vanilla JS project must have zero dependencies');
    }

    console.log(`[${name}] Vanilla project verification OK! Unpacked load-ready.`);
    console.log(`[${name}] SUITE PASSED!`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runAll() {
  await testSuite(
    'A',
    '--lang ts --browser chrome --features background,content,popup,options,sidepanel,dnr,devtools,newtab --extras contextmenu,commands,storage',
    [{ browser: 'chrome', id: 'chrome-mv3', mv: 3, outDir: 'dist/chrome-mv3' }],
    false
  );

  await testSuite(
    'B',
    '--lang js --browser firefox --firefox-mv 2 --features background,content,popup,options',
    [{ browser: 'firefox', id: 'firefox-mv2', mv: 2, outDir: 'dist/firefox-mv2' }],
    false
  );

  await testSuite(
    'C',
    '--lang ts --browser chrome,firefox,safari --firefox-mv 3 --safari-mv 2 --features background,content,popup',
    [
      { browser: 'chrome', id: 'chrome-mv3', mv: 3, outDir: 'dist/chrome-mv3' },
      { browser: 'firefox', id: 'firefox-mv3', mv: 3, outDir: 'dist/firefox-mv3' },
      { browser: 'safari', id: 'safari-mv2', mv: 2, outDir: 'dist/safari-mv2' },
    ],
    false
  );

  await testSuite(
    'D',
    '--lang ts --type content-only --browser chrome,firefox --matches "https://example.com/*"',
    [
      { browser: 'chrome', id: 'chrome-mv3', mv: 3, outDir: 'dist/chrome-mv3' },
      { browser: 'firefox', id: 'firefox-mv3', mv: 3, outDir: 'dist/firefox-mv3' },
    ],
    true
  );

  await testSuite(
    'E',
    '--lang js --type content-only --browser firefox --firefox-mv 2',
    [{ browser: 'firefox', id: 'firefox-mv2', mv: 2, outDir: 'dist/firefox-mv2' }],
    true
  );

  await testSuiteVanilla(
    'F',
    '--bundler none --lang js --browser chrome --features background,content',
  );

  console.log('\n>>> ALL SMOKE TEST SUITES (A, B, C, D, E, F) PASSED SUCCESSFULLY! <<<');
}

runAll().catch((err) => {
  console.error('\nSmoke test failed:', err);
  process.exit(1);
});

