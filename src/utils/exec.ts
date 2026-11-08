import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(command, ['--version'], {
      shell: isWindows,
      stdio: 'ignore',
    });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export function isInsideGitRepo(dir: string): boolean {
  let cur = path.resolve(dir);
  while (true) {
    if (fs.existsSync(path.join(cur, '.git'))) {
      return true;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return false;
}

export function runCommand(command: string, args: string[], cwd: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(command, args, {
      cwd,
      shell: isWindows,
      stdio: 'inherit',
    });
    child.on('error', (err) => resolve({ success: false, error: err.message }));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Exited with code ${code}` });
      }
    });
  });
}

