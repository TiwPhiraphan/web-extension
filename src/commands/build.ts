import path from 'node:path';
import { HELP, parseBuildArgs } from '../cli/args.js';
import { buildOnce, formatBuildError, outDirFor } from '../core/bundle.js';

/** `web-extension build`: returns the process exit code. */
export async function runBuild(argv: string[], root = process.cwd()): Promise<number> {
  const args = parseBuildArgs(argv);
  if (args.help) {
    console.log(HELP.build);
    return 0;
  }

  for (const browser of args.browsers) {
    const outDir = outDirFor(root, browser);
    try {
      const report = await buildOnce({
        root,
        outDir,
        browser,
        mode: 'production',
        minify: args.minify,
        sourcemap: args.sourcemap,
      });
      for (const warning of report.warnings) console.warn(`[${browser}] warning: ${warning}`);
      console.log(`[${browser}] built in ${report.ms}ms -> ${path.relative(root, outDir) || '.'}`);
    } catch (err) {
      console.error(`[${browser}] build failed\n${await formatBuildError(err)}`);
      return 1;
    }
  }
  return 0;
}
