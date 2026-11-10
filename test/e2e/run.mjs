import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const bin = path.join(root, 'dist/index.js');

// 1. Ensure latest build
execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'inherit' });

// If a project dir is passed, run directly against it
const existingDir = process.argv[2];
if (existingDir) {
  const res = spawnSync(process.execPath, [path.join(__dirname, 'chromium.cjs'), path.resolve(existingDir)], {
    stdio: 'inherit',
    cwd: root,
  });
  process.exit(res.status ?? 1);
}

// 2. Otherwise create isolated temp project inside root so root node_modules are resolvable
const tmp = fs.mkdtempSync(path.join(root, '.tmp-e2e-'));
const projectDir = path.join(tmp, 'app');

let exitCode = 1;
try {
  // 3. Scaffold the test extension
  execFileSync(
    process.execPath,
    [
      bin,
      projectDir,
      '--browser',
      'chrome',
      '--entries',
      'background,content,main-world,popup',
      '--matches',
      'http://127.0.0.1/*',
      '--lang',
      'ts',
      '--no-install',
      '--no-git',
      '--pm',
      'bun',
    ],
    { stdio: 'inherit' },
  );

  // 4. Setup node_modules in the scaffolded project
  const nodeModules = path.join(projectDir, 'node_modules');
  const extTarget = path.join(nodeModules, 'web-extension');
  fs.mkdirSync(nodeModules, { recursive: true });

  // Copy dist and package.json for web-extension CLI
  fs.mkdirSync(path.join(extTarget, 'dist'), { recursive: true });
  fs.copyFileSync(bin, path.join(extTarget, 'dist/index.js'));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(extTarget, 'package.json'));

  // 5. Run the chromium e2e test
  const res = spawnSync(process.execPath, [path.join(__dirname, 'chromium.cjs'), projectDir], {
    stdio: 'inherit',
    cwd: root,
  });
  exitCode = res.status ?? 1;
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

process.exit(exitCode);
