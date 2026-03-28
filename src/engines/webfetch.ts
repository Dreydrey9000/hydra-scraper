import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * WebFetch — native fetch + HTML-to-markdown conversion.
 * Zero dependencies beyond node-html-markdown (already in package.json).
 * Works for static HTML pages and PDFs served as text.
 */
export function createWebFetchEngine(): Engine {
  return {
    name: 'webfetch',
    tier: 0,
    capabilities: ['html', 'pdf'] as Capability[],

    async isAvailable(): Promise<boolean> {
      // Native fetch is built into Node 18+ — always available
      return true;
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 15_000;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          attempts.push({
            engine: 'webfetch',
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const html = await response.text();
        const markdown = NodeHtmlMarkdown.translate(html);

        // Try to extract <title> from raw HTML
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;

        attempts.push({
          engine: 'webfetch',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html,
          title,
          engine: 'webfetch',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'webfetch',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
