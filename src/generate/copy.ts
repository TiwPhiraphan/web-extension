import fs from 'node:fs';
import path from 'node:path';

const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf']);

export function copyDirectory(
  sourceDir: string,
  targetDir: string,
  replacements: Record<string, string> = {},
): void {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const targetName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(targetDir, targetName);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath, replacements);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        let content = fs.readFileSync(srcPath, 'utf-8');
        for (const [key, val] of Object.entries(replacements)) {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          content = content.replace(placeholder, val);
        }
        fs.writeFileSync(destPath, content, 'utf-8');
      }
    }
  }
}

