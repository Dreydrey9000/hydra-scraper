import { loadConfig } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Exa — semantic search + content extraction API.
 * POST to https://api.exa.ai/contents to get clean page content.
 * Great for getting content when you already know the URL.
 */
export function createExaEngine(): Engine {
  return {
    name: 'exa',
    tier: 2,
    capabilities: ['html', 'search'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const config = loadConfig();
      return !!config.exaApiKey;
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const config = loadConfig();
      const timeout = opts.timeout ?? 30_000;

      if (!config.exaApiKey) {
        attempts.push({
          engine: 'exa',
          success: false,
          error: 'No EXA_API_KEY configured',
          durationMs: Date.now() - start,
        });
        return null;
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch('https://api.exa.ai/contents', {
          method: 'POST',
          headers: {
            'x-api-key': config.exaApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids: [url],
            text: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          attempts.push({
            engine: 'exa',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const data = (await response.json()) as {
          results?: Array<{
            url: string;
            title?: string;
            text?: string;
          }>;
        };

        const result = data.results?.[0];
        if (!result?.text?.trim()) {
          attempts.push({
            engine: 'exa',
            success: false,
            error: 'Exa returned empty result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = result.text;

        attempts.push({
          engine: 'exa',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          title: result.title ?? undefined,
          engine: 'exa',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'exa',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
