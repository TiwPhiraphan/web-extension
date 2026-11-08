import { describe, it, expect } from 'vitest';
import { parseCliArgs, validateFlagCombinations } from '../src/cli/args.js';

describe('parseCliArgs', () => {
  it('treats first argument as [dir] when subcommand is omitted', () => {
    const res = parseCliArgs(['my-app', '--yes']);
    expect(res.subcommand).toBe('init');
    expect(res.dir).toBe('my-app');
    expect(res.yes).toBe(true);
  });

  it('handles explicit init subcommand', () => {
    const res = parseCliArgs(['init', 'custom-dir', '--lang', 'ts']);
    expect(res.subcommand).toBe('init');
    expect(res.dir).toBe('custom-dir');
    expect(res.lang).toBe('ts');
  });

  it('--browser supports comma-separated list and repeated flags', () => {
    const res1 = parseCliArgs(['--browser', 'chrome,firefox']);
    const res2 = parseCliArgs(['--browser', 'chrome', '--browser', 'firefox']);
    expect(res1.browser).toEqual(['chrome', 'firefox']);
    expect(res2.browser).toEqual(['chrome', 'firefox']);
  });

  it('maps chromium to chrome alias and deduplicates values silently', () => {
    const res = parseCliArgs(['--browser', 'chromium,chrome,firefox']);
    expect(res.browser).toEqual(['chrome', 'firefox']);
  });

  it('rejects invalid option values with helpful error message', () => {
    expect(() => parseCliArgs(['--browser', 'safari,edge'])).toThrow(
      'Invalid value "edge" for --browser. Expected one of: chrome, firefox, safari',
    );
    expect(() => parseCliArgs(['--lang', 'python'])).toThrow(
      'Invalid value "python" for --lang. Expected one of: ts, js',
    );
    expect(() => parseCliArgs(['--type', 'plugin'])).toThrow(
      'Invalid value "plugin" for --type. Expected one of: full, content-only',
    );
  });

  it('handles features none and extras none', () => {
    const res = parseCliArgs(['--features', 'none', '--extras', 'none']);
    expect(res.features).toEqual([]);
    expect(res.extras).toEqual([]);
  });
});

describe('validateFlagCombinations', () => {
  it('throws when --type content-only is combined with --features or --extras', () => {
    const args1 = parseCliArgs(['--type', 'content-only', '--features', 'content']);
    expect(() => validateFlagCombinations(args1)).toThrow(
      'Cannot specify --features or --extras when --type is content-only.',
    );

    const args2 = parseCliArgs(['--type', 'content-only', '--extras', 'storage']);
    expect(() => validateFlagCombinations(args2)).toThrow(
      'Cannot specify --features or --extras when --type is content-only.',
    );
  });

  it('throws when sidepanel is selected for Safari only', () => {
    const args = parseCliArgs(['--browser', 'safari', '--features', 'sidepanel']);
    expect(() => validateFlagCombinations(args)).toThrow(
      'Side panel feature is not supported when targeting only Safari.',
    );
  });

  it('throws when dnr is selected with MV2 target', () => {
    const args = parseCliArgs(['--browser', 'firefox', '--firefox-mv', '2', '--features', 'dnr']);
    expect(() => validateFlagCombinations(args)).toThrow(
      'DeclarativeNetRequest (DNR) is not supported with Manifest V2 targets.',
    );
  });

  it('throws when extras require background but background is missing', () => {
    const args = parseCliArgs(['--features', 'popup', '--extras', 'contextmenu']);
    expect(() => validateFlagCombinations(args)).toThrow(
      'Extras contextmenu, commands, and omnibox require background feature.',
    );
  });

  it('throws when --world MAIN is used with MV2 target', () => {
    const args = parseCliArgs(['--browser', 'firefox', '--firefox-mv', '2', '--features', 'content', '--world', 'MAIN']);
    expect(() => validateFlagCombinations(args)).toThrow(
      'Content script world MAIN is only supported in Manifest V3.',
    );
  });

  it('warns instead of erroring for ineffective flags', () => {
    const args = parseCliArgs(['--browser', 'chrome', '--firefox-mv', '2']);
    expect(() => validateFlagCombinations(args)).not.toThrow();
    expect(args.warnings.some((w) => w.includes('--firefox-mv'))).toBe(true);
  });
});

