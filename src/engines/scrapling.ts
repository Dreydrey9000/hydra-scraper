import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getVenvPython } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Scrapling — Python scraping library with optional stealth mode.
 * Uses Fetcher for normal pages, StealthyFetcher when stealth is needed.
 * Lighter than Crawl4AI — good middle ground between static fetch and full browser.
 */
export function createScraplingEngine(): Engine {
  return {
    name: 'scrapling',
    tier: 1,
    capabilities: ['html', 'stealth', 'js-render'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const pythonPath = getVenvPython();
      try {
        await execFileAsync(pythonPath, ['-c', 'import scrapling'], {
          timeout: 5_000,
        });
        return true;
      } catch {
        return false;
      }
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 30_000;
      const pythonPath = getVenvPython();

      // Pick the right fetcher based on stealth mode
      const fetcher = opts.stealth ? 'StealthyFetcher' : 'Fetcher';
      const script = `
import json, sys
from scrapling import ${fetcher}

try:
    page = ${fetcher}().get("${url}")
    text = page.get_all_text() if hasattr(page, 'get_all_text') else str(page.text)
    html = str(page.html_content) if hasattr(page, 'html_content') else ""
    title = ""
    if hasattr(page, 'css_first'):
        title_el = page.css_first("title")
        if title_el:
            title = title_el.text()
    output = {
        "text": text or "",
        "html": html or "",
        "title": title or "",
        "success": True
    }
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({"text": "", "html": "", "title": "", "success": False, "error": str(e)}))
`;

      try {
        const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
          timeout,
          maxBuffer: 10 * 1024 * 1024,
        });

        const result = JSON.parse(stdout.trim()) as {
          text: string;
          html: string;
          title: string;
          success: boolean;
          error?: string;
        };

        if (!result.success || !result.text.trim()) {
          attempts.push({
            engine: 'scrapling',
            success: false,
            error: result.error ?? 'Scrapling returned empty result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Scrapling returns plain text, not markdown — wrap it minimally
        const markdown = result.text;

        attempts.push({
          engine: 'scrapling',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: result.html || undefined,
          title: result.title || undefined,
          engine: 'scrapling',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'scrapling',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
