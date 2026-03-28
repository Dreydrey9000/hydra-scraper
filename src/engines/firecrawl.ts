import { loadConfig } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Firecrawl — paid API that handles JS rendering, stealth proxy, PDF parsing.
 * POST to https://api.firecrawl.dev/v1/scrape with your API key.
 * The most reliable engine for hard-to-scrape sites — costs money per request.
 */
export function createFirecrawlEngine(): Engine {
  return {
    name: 'firecrawl',
    tier: 2,
    capabilities: ['html', 'js-render', 'stealth', 'pdf', 'search'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const config = loadConfig();
      if (!config.firecrawlApiKey) {
        return false;
      }

      // Quick validation that the key works
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'HEAD',
          headers: {
            Authorization: `Bearer ${config.firecrawlApiKey}`,
          },
        });
        // 405 Method Not Allowed is fine — means the server is reachable and the key format is accepted
        // 401/403 means bad key
        return response.status !== 401 && response.status !== 403;
      } catch {
        return false;
      }
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const config = loadConfig();
      const timeout = opts.timeout ?? 30_000;

      if (!config.firecrawlApiKey) {
        attempts.push({
          engine: 'firecrawl',
          success: false,
          error: 'No FIRECRAWL_API_KEY configured',
          durationMs: Date.now() - start,
        });
        return null;
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        // Build the request body
        const body: Record<string, unknown> = {
          url,
          formats: ['markdown'],
        };

        if (opts.waitFor) {
          body.waitFor = opts.waitFor;
        }

        if (opts.selector) {
          body.includeTags = [opts.selector];
        }

        // Stealth proxy for protected sites
        if (opts.stealth) {
          body.proxy = 'stealth';
        }

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          attempts.push({
            engine: 'firecrawl',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const data = (await response.json()) as {
          success: boolean;
          data?: {
            markdown?: string;
            html?: string;
            metadata?: {
              title?: string;
            };
          };
        };

        if (!data.success || !data.data?.markdown?.trim()) {
          attempts.push({
            engine: 'firecrawl',
            success: false,
            error: 'Firecrawl returned empty or unsuccessful result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = data.data.markdown;

        attempts.push({
          engine: 'firecrawl',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: data.data.html ?? undefined,
          title: data.data.metadata?.title ?? undefined,
          engine: 'firecrawl',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'firecrawl',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
