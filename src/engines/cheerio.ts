import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Cheerio — fetch HTML, strip junk (nav/footer/scripts), extract main content.
 * Better than raw WebFetch because it cleans the DOM before converting to markdown.
 * Still can't run JavaScript — purely static HTML parsing.
 */
export function createCheerioEngine(): Engine {
  return {
    name: 'cheerio',
    tier: 1,
    capabilities: ['html'] as Capability[],

    async isAvailable(): Promise<boolean> {
      // cheerio is a direct dependency — always available
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
            engine: 'cheerio',
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const rawHtml = await response.text();
        const $ = cheerio.load(rawHtml);

        // Strip noisy elements that pollute the markdown
        $('nav, footer, header, script, style, noscript, iframe, svg').remove();
        $('[role="navigation"]').remove();
        $('[role="banner"]').remove();
        $('[role="contentinfo"]').remove();

        // If the user passed a CSS selector, use that. Otherwise find main content.
        let contentHtml: string;
        if (opts.selector) {
          contentHtml = $(opts.selector).html() ?? '';
        } else {
          // Priority: article > main > [role="main"] > body
          const article = $('article').html();
          const main = $('main').html();
          const roleMain = $('[role="main"]').html();
          const body = $('body').html();
          contentHtml = article ?? main ?? roleMain ?? body ?? '';
        }

        if (!contentHtml.trim()) {
          attempts.push({
            engine: 'cheerio',
            success: false,
            error: 'No content found after stripping noise elements',
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = NodeHtmlMarkdown.translate(contentHtml);
        const title = $('title').first().text().trim() || undefined;

        attempts.push({
          engine: 'cheerio',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: contentHtml,
          title,
          engine: 'cheerio',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'cheerio',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
