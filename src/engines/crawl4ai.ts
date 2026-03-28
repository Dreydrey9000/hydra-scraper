import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getVenvPython } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Crawl4AI — Python-based async web crawler with JS rendering.
 * Runs a Python subprocess that uses AsyncWebCrawler under the hood.
 * Handles SPAs, JS-heavy pages, and stealth mode out of the box.
 */
export function createCrawl4aiEngine(): Engine {
  return {
    name: 'crawl4ai',
    tier: 1,
    capabilities: ['html', 'js-render', 'stealth'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const pythonPath = getVenvPython();
      try {
        await execFileAsync(pythonPath, ['-c', 'import crawl4ai'], {
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

      // Build a self-contained Python script that crawls the URL and prints markdown
      const waitFor = opts.waitFor ?? 2000;
      const script = `
import asyncio, json, sys
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

async def main():
    browser_cfg = BrowserConfig(headless=True)
    run_cfg = CrawlerRunConfig(
        wait_until="domcontentloaded",
        delay_before_return_html=${waitFor / 1000}
    )
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url="${url}", config=run_cfg)
        output = {
            "markdown": result.markdown or "",
            "html": result.html or "",
            "title": getattr(result, "title", "") or "",
            "success": result.success
        }
        print(json.dumps(output))

asyncio.run(main())
`;

      try {
        const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB — some pages are big
        });

        const result = JSON.parse(stdout.trim()) as {
          markdown: string;
          html: string;
          title: string;
          success: boolean;
        };

        if (!result.success || !result.markdown.trim()) {
          attempts.push({
            engine: 'crawl4ai',
            success: false,
            error: 'Crawl4AI returned empty or unsuccessful result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        attempts.push({
          engine: 'crawl4ai',
          success: true,
          durationMs: Date.now() - start,
          contentLength: result.markdown.length,
        });

        return {
          url,
          markdown: result.markdown,
          html: result.html || undefined,
          title: result.title || undefined,
          engine: 'crawl4ai',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'crawl4ai',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
