import { loadConfig } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

/**
 * Perplexity — AI-powered search and content extraction.
 * POST https://api.perplexity.ai/chat/completions with model "sonar".
 * Sends a message asking to extract/summarize content from the URL.
 * Needs PERPLEXITY_API_KEY from config or env.
 */
export function createPerplexityEngine(): Engine {
  return {
    name: 'perplexity',
    tier: 2,
    capabilities: ['search', 'html'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const config = loadConfig();
      return !!(config.perplexityApiKey ?? process.env.PERPLEXITY_API_KEY);
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const config = loadConfig();
      const timeout = opts.timeout ?? 30_000;

      const apiKey = config.perplexityApiKey ?? process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        attempts.push({
          engine: 'perplexity',
          success: false,
          error: 'No PERPLEXITY_API_KEY configured',
          durationMs: Date.now() - start,
        });
        return null;
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content:
                  'You are a web content extractor. Extract and return the full content from the given URL in clean markdown format. Include all text, headings, and key information. Do not summarize — return as much content as possible.',
              },
              {
                role: 'user',
                content: `Extract the full content from this URL and return it as clean markdown: ${url}`,
              },
            ],
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          attempts.push({
            engine: 'perplexity',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const markdown = data.choices?.[0]?.message?.content?.trim();

        if (!markdown) {
          attempts.push({
            engine: 'perplexity',
            success: false,
            error: 'Perplexity returned empty content',
            durationMs: Date.now() - start,
          });
          return null;
        }

        attempts.push({
          engine: 'perplexity',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          engine: 'perplexity',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'perplexity',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
