#!/usr/bin/env node
import * as p from '@clack/prompts';
import pico from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, printHelp, validateFlagCombinations } from './cli/args.js';
import { runPrompts } from './cli/prompts.js';
import { generateProject } from './generate/index.js';
import { getInstallCommand, getRunCommand } from './utils/pm.js';
import { isCommandAvailable, runCommand } from './utils/exec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCliVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return data.version || '2.0.0';
    }
  } catch {
  }
  return '2.0.0';
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  let parsedArgs;

  try {
    parsedArgs = parseCliArgs(rawArgs);
  } catch (err: any) {
    console.error(pico.red(`Error: ${err.message}`));
    process.exit(1);
  }

  if (parsedArgs.help) {
    printHelp();
    process.exit(0);
  }

  if (parsedArgs.version) {
    console.log(`web-extension v${getCliVersion()}`);
    process.exit(0);
  }

  try {
    validateFlagCombinations(parsedArgs);
  } catch (err: any) {
    console.error(pico.red(`Configuration Error: ${err.message}`));
    process.exit(1);
  }

  p.intro(pico.bold(pico.cyan('web-extension scaffold')));

  for (const warning of parsedArgs.warnings) {
    p.log.warn(warning);
  }

  let ctx;
  try {
    ctx = await runPrompts(parsedArgs);
  } catch (err: any) {
    console.error(pico.red(`Error: ${err.message}`));
    process.exit(1);
  }

  if (ctx.ifExists === 'overwrite' && fs.existsSync(ctx.targetDir)) {
    const entries = fs.readdirSync(ctx.targetDir);
    for (const entry of entries) {
      fs.rmSync(path.join(ctx.targetDir, entry), { recursive: true, force: true });
    }
  }

  const s = p.spinner();
  s.start('Generating project files...');
  try {
    generateProject(ctx);
    s.stop('Project files created successfully.');
  } catch (err: any) {
    s.stop('Failed to generate project files.');
    console.error(pico.red(err.message));
    process.exit(1);
  }

  if (ctx.git) {
    s.start('Initializing git repository...');
    const gitRes = await runCommand('git', ['init'], ctx.targetDir);
    if (gitRes.success) {
      s.stop('Git repository initialized.');
    } else {
      s.stop('Skipped git initialization.');
      p.log.warn(`Git init failed: ${gitRes.error}`);
    }
  }

  if (ctx.install) {
    const pmAvailable = await isCommandAvailable(ctx.pm);
    if (!pmAvailable) {
      p.log.warn(
        `Package manager "${ctx.pm}" is not found in PATH. Skipping dependency installation.`,
      );
      p.log.info(`Please run "${getInstallCommand(ctx.pm)}" manually.`);
    } else {
      s.start(`Installing dependencies with ${ctx.pm}...`);
      const installCmd = ctx.pm === 'yarn' ? [] : ['install'];
      const installRes = await runCommand(ctx.pm, installCmd, ctx.targetDir);
      if (installRes.success) {
        s.stop('Dependencies installed successfully.');
      } else {
        s.stop('Failed to install dependencies.');
        p.log.warn(`Installation failed: ${installRes.error}`);
        p.log.info(`You can try running "${getInstallCommand(ctx.pm)}" manually.`);
      }
    }
  }

  const relPath = path.relative(process.cwd(), ctx.targetDir);
  const cdInstruction = relPath && relPath !== '.' ? `cd ${relPath}\n  ` : '';
  const firstBrowser = ctx.browsers[0];
  const devCommand = getRunCommand(ctx.pm, `dev:${firstBrowser}`);

  p.outro(
    pico.green(
      `Done! To get started:\n\n  ${pico.bold(
        `${cdInstruction}${devCommand}`,
      )}\n`,
    ),
  );
}

main().catch((err) => {
  console.error(pico.red(`Fatal Error: ${err.message}`));
  process.exit(1);
});

