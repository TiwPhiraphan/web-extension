import { describe, expect, it } from 'vitest';
import {
  UsageError,
  parseBrowserList,
  parseBuildArgs,
  parseDevArgs,
  parseEntryList,
  parseInitArgs,
} from '../src/cli/args';

describe('parseBrowserList', () => {
  it('accepts commas, repeats, case and the chromium alias, and drops duplicates', () => {
    expect(parseBrowserList(['Chrome,firefox', 'chromium', 'safari'])).toEqual(['chrome', 'firefox', 'safari']);
  });
  it('rejects unknown browsers', () => {
    expect(() => parseBrowserList(['edge'])).toThrow(UsageError);
  });
});

describe('parseEntryList', () => {
  it('treats "none" as an empty list', () => {
    expect(parseEntryList(['none'])).toEqual([]);
  });
  it('rejects unknown entries', () => {
    expect(() => parseEntryList(['background,devtools'])).toThrow(/Invalid entry "devtools"/);
  });
});

describe('parseInitArgs', () => {
  it('reads every option', () => {
    const args = parseInitArgs([
      'my-ext', '--browser', 'chrome,firefox', '--entries', 'background,popup', '--lang', 'typescript',
      '--matches', 'https://a.com/*,https://b.com/*', '--pm', 'pnpm', '--no-install', '--git', '-y',
    ]);
    expect(args).toMatchObject({
      dir: 'my-ext', browsers: ['chrome', 'firefox'], entries: ['background', 'popup'], lang: 'ts',
      matches: ['https://a.com/*', 'https://b.com/*'], pm: 'pnpm', install: false, git: true, yes: true,
    });
  });
  it('leaves unset options undefined so prompts can ask', () => {
    expect(parseInitArgs([])).toMatchObject({ dir: undefined, browsers: undefined, install: undefined, git: undefined });
  });
  it.each([
    [['--lang', 'rust']],
    [['--pm', 'deno']],
    [['--install', '--no-install']],
    [['a', 'b']],
    [['--nope']],
  ])('rejects %j', (argv) => {
    expect(() => parseInitArgs(argv)).toThrow(UsageError);
  });
});

describe('parseBuildArgs / parseDevArgs', () => {
  it('build defaults to chrome with minify on', () => {
    expect(parseBuildArgs([])).toMatchObject({ browsers: ['chrome'], minify: true, sourcemap: false });
  });
  it('build accepts several browsers and flags', () => {
    expect(parseBuildArgs(['--browser', 'chrome,firefox', '--no-minify', '--sourcemap'])).toMatchObject({
      browsers: ['chrome', 'firefox'], minify: false, sourcemap: true,
    });
  });
  it('dev takes one browser and a valid port', () => {
    expect(parseDevArgs(['--browser', 'firefox', '--port', '4000'])).toMatchObject({ browser: 'firefox', port: 4000 });
    expect(() => parseDevArgs(['--browser', 'chrome,firefox'])).toThrow(UsageError);
    expect(() => parseDevArgs(['--port', 'abc'])).toThrow(UsageError);
  });
});
