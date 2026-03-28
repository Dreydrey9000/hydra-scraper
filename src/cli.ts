#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile } from 'node:fs/promises';
import { createHydra } from './index.js';
import { printHealth } from './health.js';

const program = new Command();

program
  .name('hydra-scraper')
  .description('Self-healing web scraper with 10+ fallback engines. Never fails.')
  .version('0.1.0');

/**
 * Default command: scrape a URL
 * hydra-scraper <url> [options]
 */
program
  .argument('<url>', 'URL to scrape')
  .option('--json', 'Output result as JSON instead of markdown')
  .option('--stealth', 'Force stealth mode (anti-bot evasion)')
  .option('-o, --output <file>', 'Save output to a file instead of stdout')
  .option('--timeout <ms>', 'Per-engine timeout in milliseconds', '15000')
  .action(async (url: string, opts: { json?: boolean; stealth?: boolean; output?: string; timeout?: string }) => {
    const spinner = ora({
      text: chalk.cyan('Scraping with Hydra...'),
      color: 'cyan',
    }).start();

    try {
      const hydra = createHydra();

      const result = await hydra.scrape(url, {
        stealth: opts.stealth,
        timeout: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
      });

      // Check if all engines failed
      if (result.engine === 'none') {
        spinner.fail(chalk.red('All engines failed'));
        console.log('');

        for (const attempt of result.attempts) {
          console.log(
            `  ${chalk.red('✗')}  ${chalk.gray(attempt.engine)} — ${chalk.gray(attempt.error ?? 'unknown error')} ${chalk.gray(`(${attempt.durationMs}ms)`)}`,
          );
        }

        console.log('');
        console.log(chalk.yellow('Tip: run `hydra-scraper health` to check engine availability'));
        process.exit(1);
      }

      // Success
      spinner.succeed(
        chalk.green(`Scraped with ${chalk.bold(result.engine)}`) +
        chalk.gray(` in ${result.durationMs}ms`),
      );

      // Show failed attempts if any
      const failedAttempts = result.attempts.filter((a) => !a.success);
      if (failedAttempts.length > 0) {
        console.log(chalk.gray(`  (${failedAttempts.length} engine(s) tried first)`));
      }

      // Format output
      const output = opts.json
        ? JSON.stringify(result, null, 2)
        : result.markdown;

      // Write to file or stdout
      if (opts.output) {
        await writeFile(opts.output, output, 'utf-8');
        console.log(chalk.green(`\n  Saved to ${opts.output}`));
      } else {
        console.log('');
        console.log(output);
      }
    } catch (err) {
      spinner.fail(chalk.red('Unexpected error'));
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  ${msg}`));
      process.exit(1);
    }
  });

/**
 * Health command: show which engines are up/down
 * hydra-scraper health
 */
program
  .command('health')
  .description('Show engine health dashboard')
  .action(async () => {
    const spinner = ora({
      text: chalk.cyan('Checking engine health...'),
      color: 'cyan',
    }).start();

    try {
      const hydra = createHydra();
      const statuses = await hydra.health();
      spinner.stop();
      printHealth(statuses);
    } catch (err) {
      spinner.fail(chalk.red('Health check failed'));
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  ${msg}`));
      process.exit(1);
    }
  });

/**
 * Init command: setup wizard (placeholder)
 * hydra-scraper init
 */
program
  .command('init')
  .description('Run setup wizard to configure API keys and engines')
  .action(() => {
    console.log('');
    console.log(chalk.bold('  Hydra Scraper — Setup Wizard'));
    console.log(chalk.gray('  ─'.repeat(24)));
    console.log('');
    console.log(chalk.yellow('  Coming soon.'));
    console.log(chalk.gray('  For now, create ~/.hydra.json with your API keys:'));
    console.log('');
    console.log(chalk.gray('  {'));
    console.log(chalk.gray('    "firecrawlApiKey": "fc-...",'));
    console.log(chalk.gray('    "tavilyApiKey": "tvly-...",'));
    console.log(chalk.gray('    "exaApiKey": "exa-...",'));
    console.log(chalk.gray('    "browserbaseApiKey": "bb-..."'));
    console.log(chalk.gray('  }'));
    console.log('');
    console.log(chalk.gray('  Or set environment variables: FIRECRAWL_API_KEY, TAVILY_API_KEY, etc.'));
    console.log('');
  });

program.parse();
