import chalk from 'chalk';
import type { Engine, EngineStatus } from './types.js';

/**
 * Checks every engine's availability in parallel.
 * Returns an EngineStatus[] you can display or serialize.
 */
export async function checkHealth(engines: Engine[]): Promise<EngineStatus[]> {
  const results = await Promise.all(
    engines.map(async (engine): Promise<EngineStatus> => {
      try {
        const available = await engine.isAvailable();
        return {
          name: engine.name,
          tier: engine.tier,
          available,
          reason: available ? undefined : 'Engine reported unavailable',
        };
      } catch (err) {
        return {
          name: engine.name,
          tier: engine.tier,
          available: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return results;
}

/**
 * Prints a nice terminal dashboard showing which engines are up/down.
 * Groups by tier so you can see free vs paid vs premium at a glance.
 */
export function printHealth(statuses: EngineStatus[]): void {
  const tierLabels: Record<number, string> = {
    0: 'Tier 0 — Free / No Setup',
    1: 'Tier 1 — Local / Self-Hosted',
    2: 'Tier 2 — Paid API',
  };

  const tiers = [0, 1, 2] as const;
  const totalActive = statuses.filter((s) => s.available).length;
  const totalCount = statuses.length;

  console.log('');
  console.log(chalk.bold('  🐍 Hydra Scraper — Engine Health Dashboard'));
  console.log(chalk.gray('  ─'.repeat(24)));
  console.log('');

  for (const tier of tiers) {
    const tierStatuses = statuses.filter((s) => s.tier === tier);
    if (tierStatuses.length === 0) continue;

    console.log(chalk.bold.underline(`  ${tierLabels[tier]}`));
    console.log('');

    for (const status of tierStatuses) {
      const icon = status.available
        ? chalk.green('✓')
        : chalk.red('✗');

      const name = status.available
        ? chalk.white(status.name)
        : chalk.gray(status.name);

      const reason = !status.available && status.reason
        ? chalk.gray(` — ${status.reason}`)
        : '';

      console.log(`    ${icon}  ${name}${reason}`);
    }

    console.log('');
  }

  // Summary line
  const color = totalActive === totalCount
    ? chalk.green
    : totalActive > 0
      ? chalk.yellow
      : chalk.red;

  console.log(
    chalk.gray('  ─'.repeat(24)),
  );
  console.log(
    `  ${color.bold(`${totalActive}/${totalCount}`)} engines active`,
  );
  console.log('');
}
