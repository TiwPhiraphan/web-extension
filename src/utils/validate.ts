import path from 'node:path';

/**
 * Validates npm package name.
 * Rules:
 * - non-empty
 * - lowercase
 * - no spaces
 * - only URL-friendly characters (lowercase letters, numbers, hyphens, dots, underscores, @, /)
 * - cannot start with dot or underscore
 */
export function validatePackageName(name: string): true | string {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty.';
  }
  const trimmed = name.trim();
  if (trimmed !== trimmed.toLowerCase()) {
    return 'Project name must be lowercase.';
  }
  if (/\s/.test(trimmed)) {
    return 'Project name cannot contain spaces.';
  }
  if (trimmed.startsWith('.') || trimmed.startsWith('_')) {
    return 'Project name cannot start with a dot or underscore.';
  }
  if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(trimmed)) {
    return 'Project name contains invalid characters for an npm package.';
  }
  if (encodeURIComponent(trimmed) !== trimmed && !trimmed.startsWith('@')) {
    return 'Project name must be URL-safe.';
  }
  return true;
}

/**
 * Derives valid package name from path or string.
 */
export function getPackageName(input: string): string {
  const base = path.basename(path.resolve(input));
  return base.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^-+|-+$/g, '') || 'my-extension';
}

/**
 * Validates match patterns for Chrome/Firefox/Safari content scripts.
 * Must start with http://, https://, *://, file://, or be <all_urls>
 */
export function validateMatchPattern(pattern: string): true | string {
  const p = pattern.trim();
  if (!p) {
    return 'Match pattern cannot be empty.';
  }
  if (p === '<all_urls>') {
    return true;
  }
  const validSchemes = ['http://', 'https://', '*://', 'file://'];
  const hasValidScheme = validSchemes.some((scheme) => p.startsWith(scheme));
  if (!hasValidScheme) {
    return `Invalid match pattern "${p}". Must start with http://, https://, *://, file://, or be <all_urls>`;
  }
  return true;
}

export function parseAndValidateMatches(input: string | string[]): { valid: true; matches: string[] } | { valid: false; error: string } {
  const list = Array.isArray(input)
    ? input
    : input.split(',').map((s) => s.trim()).filter(Boolean);

  if (list.length === 0) {
    return { valid: false, error: 'At least one match pattern is required.' };
  }

  for (const item of list) {
    const res = validateMatchPattern(item);
    if (res !== true) {
      return { valid: false, error: res };
    }
  }

  return { valid: true, matches: list };
}

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'extension';
}

