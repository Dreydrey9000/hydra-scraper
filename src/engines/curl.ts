import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Curl — absolute last resort engine.
 * Runs `curl -sL` via child_process and converts raw HTML to markdown.
 * Always available since curl ships with every OS.
 */
export function createCurlEngine(): Engine {
  return {
    name: 'curl',
    tier: 0,
    capabilities: ['html', 'pdf'] as Capability[],

    async isAvailable(): Promise<boolean> {
      // curl is on every system
      return true;
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 15_000;

      // Convert timeout from ms to seconds for curl's --max-time
      const maxTimeSec = Math.max(1, Math.floor(timeout / 1000));

      try {
        const { stdout, stderr } = await execFileAsync(
          'curl',
          ['-sL', '-A', USER_AGENT, '--max-time', String(maxTimeSec), url],
          {
            timeout: timeout + 2_000, // Give Node a bit more than curl's own timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB
          },
        );

        if (!stdout.trim()) {
          attempts.push({
            engine: 'curl',
            success: false,
            error: stderr ? `curl error: ${stderr.slice(0, 500)}` : 'curl returned empty response',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Convert HTML to markdown
        const markdown = NodeHtmlMarkdown.translate(stdout);

        if (!markdown.trim()) {
          attempts.push({
            engine: 'curl',
            success: false,
            error: 'HTML-to-markdown conversion produced empty output',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Try to extract a title from the HTML
        const titleMatch = stdout.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim();

        attempts.push({
          engine: 'curl',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: stdout,
          title,
          engine: 'curl',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'curl',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
