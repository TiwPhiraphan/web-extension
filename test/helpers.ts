import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Create a temp directory and write `files` (relative path -> content) into it. */
export function tempProject(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-extension-test-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

export const read = (dir: string, relative: string): string =>
  fs.readFileSync(path.join(dir, ...relative.split('/')), 'utf-8');

export const readJson = <T = Record<string, unknown>>(dir: string, relative: string): T =>
  JSON.parse(read(dir, relative)) as T;
