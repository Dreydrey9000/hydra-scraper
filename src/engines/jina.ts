import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Jina Reader — free markdown proxy.
 * Fetches https://r.jina.ai/{url} which returns clean markdown.
 * No API key, no setup, no limits (generous free tier).
 */
export function createJinaEngine(): Engine {
  return {
    name: 'jina',
    tier: 0,
    capabilities: ['html'] as Capability[],

    async isAvailable(): Promise<boolean> {
      // Jina Reader is a public service — always available
      return true;
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 15_000;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`https://r.jina.ai/${url}`, {
          headers: {
            Accept: 'text/markdown',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          attempts.push({
            engine: 'jina',
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = await response.text();

        attempts.push({
          engine: 'jina',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          engine: 'jina',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'jina',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
