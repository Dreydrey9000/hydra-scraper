import { loadConfig } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Browserbase — cloud browser sessions via REST API.
 * Spins up a remote browser in their infra, useful for auth-walled pages.
 * Currently a stub — returns null. Will wire up the full API later.
 */
export function createBrowserbaseEngine(): Engine {
  return {
    name: 'browserbase',
    tier: 2,
    capabilities: ['html', 'js-render', 'auth'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const config = loadConfig();
      return !!config.browserbaseApiKey;
    },

    async scrape(url: string, _opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const config = loadConfig();

      if (!config.browserbaseApiKey) {
        attempts.push({
          engine: 'browserbase',
          success: false,
          error: 'No BROWSERBASE_API_KEY configured',
          durationMs: Date.now() - start,
        });
        return null;
      }

      // Stub — Browserbase API integration will be wired up in a future phase.
      // The router will skip this engine and fall through to the next available one.
      attempts.push({
        engine: 'browserbase',
        success: false,
        error: 'Browserbase engine is a stub — not yet implemented',
        durationMs: Date.now() - start,
      });

      // Suppress unused variable warning — url is required by the Engine interface
      void url;

      return null;
    },
  };
}
