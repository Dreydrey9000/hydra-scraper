import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getVenvPython } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Playwright — full browser automation via Python subprocess.
 * Launches headless Chromium, navigates to the URL, waits for load, grabs content.
 * Handles JS-rendered pages and can use auth (logged-in browser profiles).
 */
export function createPlaywrightEngine(): Engine {
  return {
    name: 'playwright',
    tier: 1,
    capabilities: ['html', 'js-render', 'auth'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const pythonPath = getVenvPython();
      try {
        await execFileAsync(pythonPath, ['-c', 'from playwright.sync_api import sync_playwright'], {
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

      const waitFor = opts.waitFor ?? 2000;
      const script = `
import json, sys
from playwright.sync_api import sync_playwright

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("${url}", wait_until="domcontentloaded", timeout=${timeout})
        page.wait_for_timeout(${waitFor})

        title = page.title() or ""
        html = page.content() or ""

        # Try to extract just the main content text
        text_content = page.evaluate("""() => {
            const el = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
            return el ? el.innerText : '';
        }""")

        browser.close()

        output = {
            "text": text_content or "",
            "html": html,
            "title": title,
            "success": True
        }
        print(json.dumps(output))
except Exception as e:
    print(json.dumps({"text": "", "html": "", "title": "", "success": False, "error": str(e)}))
`;

      try {
        const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
          timeout: timeout + 10_000, // Extra buffer for browser startup
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
            engine: 'playwright',
            success: false,
            error: result.error ?? 'Playwright returned empty result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        // innerText gives us plain text — treat it as markdown (it's already readable)
        const markdown = result.text;

        attempts.push({
          engine: 'playwright',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: result.html || undefined,
          title: result.title || undefined,
          engine: 'playwright',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'playwright',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
