import pkg from '../package.json';
import { HELP, UsageError } from './cli/args.js';
import { runBuild } from './commands/build.js';
import { runDev } from './commands/dev.js';
import { runInit } from './commands/init.js';

const COMMANDS = new Set(['init', 'dev', 'build']);

async function main(argv: string[]): Promise<number> {
  const [first, ...rest] = argv;

  if (first === '--help' || first === '-h') {
    console.log(HELP.main);
    return 0;
  }
  if (first === '--version' || first === '-v') {
    console.log(`web-extension v${pkg.version}`);
    return 0;
  }

  if (first === 'dev') return runDev(rest);
  if (first === 'build') return runBuild(rest);
  if (first === 'init') return runInit(rest);
  return runInit(argv);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError) {
      console.error(`error: ${err.message}`);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exitCode = 1;
  },
);
