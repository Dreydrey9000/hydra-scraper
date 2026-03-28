import { loadConfig } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Brave Search — web search via Brave Search API.
 * GET https://api.search.brave.com/res/v1/web/search?q={query}
 * Needs BRAVE_API_KEY (or BRAVE_SEARCH_API_KEY) from config or env.
 */
export function createBraveEngine(): Engine {
  return {
    name: 'brave',
    tier: 0,
    capabilities: ['search'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const config = loadConfig();
      return !!(config.braveApiKey ?? process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY);
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const config = loadConfig();
      const timeout = opts.timeout ?? 15_000;

      const apiKey = config.braveApiKey ?? process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY;

      if (!apiKey) {
        attempts.push({
          engine: 'brave',
          success: false,
          error: 'No BRAVE_API_KEY configured',
          durationMs: Date.now() - start,
        });
        return null;
      }

      // Treat the URL as a search query — strip protocol if present
      const query = url.startsWith('http') ? new URL(url).hostname : url;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          attempts.push({
            engine: 'brave',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const data = (await response.json()) as {
          web?: {
            results?: Array<{
              title?: string;
              url?: string;
              description?: string;
            }>;
          };
        };

        const results = data.web?.results ?? [];

        if (results.length === 0) {
          attempts.push({
            engine: 'brave',
            success: false,
            error: 'Brave Search returned no results',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Format results as markdown
        const markdown = results
          .map((r, i) => {
            const title = r.title ?? 'Untitled';
            const link = r.url ?? '';
            const desc = r.description ?? '';
            return `## ${i + 1}. ${title}\n${link}\n\n${desc}`;
          })
          .join('\n\n---\n\n');

        attempts.push({
          engine: 'brave',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          title: `Search results for: ${query}`,
          engine: 'brave',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'brave',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
