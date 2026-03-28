import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Jina Search — free search via s.jina.ai.
 * Fetches https://s.jina.ai/{query} which returns structured search results.
 * No API key, no setup, generous free tier.
 */
export function createJinaSearchEngine(): Engine {
  return {
    name: 'jina-search',
    tier: 0,
    capabilities: ['search'] as Capability[],

    async isAvailable(): Promise<boolean> {
      // Jina Search is a public service — always available
      return true;
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 15_000;

      // If the URL looks like a search query (no protocol), use it directly.
      // Otherwise, search for the domain's content.
      const query = url.startsWith('http') ? new URL(url).hostname : url;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          attempts.push({
            engine: 'jina-search',
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const data = (await response.json()) as {
          data?: Array<{
            title?: string;
            url?: string;
            description?: string;
            content?: string;
          }>;
        };

        const results = data.data ?? [];

        if (results.length === 0) {
          attempts.push({
            engine: 'jina-search',
            success: false,
            error: 'Jina Search returned no results',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Format results as markdown
        const markdown = results
          .map((r, i) => {
            const title = r.title ?? 'Untitled';
            const link = r.url ?? '';
            const desc = r.description ?? r.content ?? '';
            return `## ${i + 1}. ${title}\n${link}\n\n${desc}`;
          })
          .join('\n\n---\n\n');

        attempts.push({
          engine: 'jina-search',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          title: `Search results for: ${query}`,
          engine: 'jina-search',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'jina-search',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
