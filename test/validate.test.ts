import { describe, it, expect } from 'vitest';
import {
  validatePackageName,
  getPackageName,
  validateMatchPattern,
  parseAndValidateMatches,
  toSlug,
} from '../src/utils/validate.js';

describe('validatePackageName', () => {
  it('accepts valid npm package names', () => {
    expect(validatePackageName('my-extension')).toBe(true);
    expect(validatePackageName('chrome-ext-123')).toBe(true);
    expect(validatePackageName('simple')).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(typeof validatePackageName('')).toBe('string');
    expect(typeof validatePackageName('   ')).toBe('string');
  });

  it('rejects uppercase letters', () => {
    expect(typeof validatePackageName('MyExtension')).toBe('string');
  });

  it('rejects names with spaces or illegal characters', () => {
    expect(typeof validatePackageName('my extension')).toBe('string');
    expect(typeof validatePackageName('my/extension/test')).toBe('string');
    expect(typeof validatePackageName('.hidden')).toBe('string');
    expect(typeof validatePackageName('_private')).toBe('string');
  });
});

describe('getPackageName', () => {
  it('extracts basename and converts to valid package name', () => {
    expect(getPackageName('./foo/bar/my-app')).toBe('my-app');
    expect(getPackageName('My Extension App')).toBe('my-extension-app');
  });
});

describe('validateMatchPattern', () => {
  it('accepts <all_urls>', () => {
    expect(validateMatchPattern('<all_urls>')).toBe(true);
  });

  it('accepts valid schemes (http, https, *, file)', () => {
    expect(validateMatchPattern('https://example.com/*')).toBe(true);
    expect(validateMatchPattern('http://*.google.com/*')).toBe(true);
    expect(validateMatchPattern('*://*/*')).toBe(true);
    expect(validateMatchPattern('file:///path/*')).toBe(true);
  });

  it('rejects invalid schemes', () => {
    expect(typeof validateMatchPattern('ftp://example.com/*')).toBe('string');
    expect(typeof validateMatchPattern('chrome://extensions')).toBe('string');
    expect(typeof validateMatchPattern('example.com/*')).toBe('string');
  });
});

describe('parseAndValidateMatches', () => {
  it('parses comma-separated patterns', () => {
    const res = parseAndValidateMatches('https://example.com/*, https://google.com/*');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.matches).toEqual(['https://example.com/*', 'https://google.com/*']);
    }
  });

  it('returns error if any pattern is invalid', () => {
    const res = parseAndValidateMatches('https://example.com/*, invalid-url');
    expect(res.valid).toBe(false);
  });
});

describe('toSlug', () => {
  it('converts names to safe slugs', () => {
    expect(toSlug('My Awesome Extension!')).toBe('my-awesome-extension');
    expect(toSlug('chrome-ext')).toBe('chrome-ext');
  });
});

