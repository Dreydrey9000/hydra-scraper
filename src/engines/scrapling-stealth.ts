import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getVenvPython } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability, ScrapeAction, ScrapeCookie } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Scrapling Stealth — PlayWrightFetcher-backed engine.
 *
 * Differs from `scrapling` (which uses StealthyFetcher, a stealth HTTP fetcher):
 *   - Real browser via Playwright Python
 *   - Can perform actions (click, fill, scroll, press, hover) before scraping
 *   - Uses Scrapling's stealth mode (canvas hide, WebGL disable, real UA, real Chrome optional)
 *   - Honors `waitSelector` and `actions` from ScrapeOptions
 *
 * When the router picks this:
 *   - Sites with anti-bot walls that need JS render
 *   - Workflows requiring interactions (login, expand, scroll-to-load)
 *   - Auth-walled pages where Comet isn't available
 */
export function createScraplingStealthEngine(): Engine {
  return {
    name: 'scrapling-stealth',
    tier: 1,
    capabilities: ['html', 'js-render', 'stealth', 'auth'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const pythonPath = getVenvPython();
      try {
        await execFileAsync(
          pythonPath,
          ['-c', 'from scrapling import PlayWrightFetcher; import playwright'],
          { timeout: 5_000 },
        );
        return true;
      } catch {
        return false;
      }
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 45_000;
      const pythonPath = getVenvPython();

      const actions: ScrapeAction[] = opts.actions ?? [];
      const waitSelector = opts.waitSelector ?? '';
      const realChrome = opts.realChrome ?? false;
      const stealth = opts.stealth ?? true;
      const cookies: ScrapeCookie[] = opts.cookies ?? [];
      const cookieHeader = cookies.length > 0
        ? cookies.map((c) => `${c.name}=${c.value}`).join('; ')
        : '';

      // Pass URL + actions via env vars to avoid shell-escape pitfalls
      const env = {
        ...process.env,
        HYDRA_URL: url,
        HYDRA_ACTIONS: JSON.stringify(actions),
        HYDRA_WAIT_SELECTOR: waitSelector,
        HYDRA_STEALTH: stealth ? '1' : '0',
        HYDRA_REAL_CHROME: realChrome ? '1' : '0',
        HYDRA_TIMEOUT_MS: String(timeout),
        HYDRA_COOKIE_HEADER: cookieHeader,
      };

      const script = `
import json, os, sys
from scrapling import PlayWrightFetcher

url = os.environ["HYDRA_URL"]
actions = json.loads(os.environ.get("HYDRA_ACTIONS", "[]"))
wait_selector = os.environ.get("HYDRA_WAIT_SELECTOR") or None
stealth = os.environ.get("HYDRA_STEALTH") == "1"
real_chrome = os.environ.get("HYDRA_REAL_CHROME") == "1"
timeout_ms = int(os.environ.get("HYDRA_TIMEOUT_MS", "45000"))
cookie_header = os.environ.get("HYDRA_COOKIE_HEADER") or ""

def make_page_action(action_list):
    def page_action(page):
        for a in action_list:
            t = a.get("type")
            try:
                if t == "click":
                    page.click(a["selector"], timeout=10000)
                elif t == "fill":
                    page.fill(a["selector"], a["value"], timeout=10000)
                elif t == "wait":
                    page.wait_for_timeout(int(a.get("ms", 1000)))
                elif t == "press":
                    page.keyboard.press(a["key"])
                elif t == "hover":
                    page.hover(a["selector"], timeout=10000)
                elif t == "scroll":
                    sel = a.get("selector")
                    if sel:
                        page.locator(sel).scroll_into_view_if_needed(timeout=10000)
                    else:
                        direction = a.get("direction", "bottom")
                        if direction == "top":
                            page.evaluate("window.scrollTo(0, 0)")
                        else:
                            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            except Exception as ex:
                print(f"[hydra-action-warn] {t} failed: {ex}", file=sys.stderr)
        return page
    return page_action

try:
    # Use class-method form (PlayWrightFetcher.fetch, not PlayWrightFetcher().fetch).
    # The instance-based API is deprecated in 0.2.99 and will be removed in 0.3.
    # Stealth, hide_canvas, disable_webgl are deprecated and have no effect; stealth
    # is now baked into rebrowser-playwright at the browser level.
    kwargs = {
        "headless": True,
        "stealth": stealth,
        "real_chrome": real_chrome,
        "network_idle": True,
        "timeout": timeout_ms,
    }
    if wait_selector:
        kwargs["wait_selector"] = wait_selector
    if actions:
        kwargs["page_action"] = make_page_action(actions)
    if cookie_header:
        kwargs["extra_headers"] = {"Cookie": cookie_header}

    page = PlayWrightFetcher.fetch(url, **kwargs)

    text = page.get_all_text() if hasattr(page, "get_all_text") else str(getattr(page, "text", ""))
    html = str(getattr(page, "html_content", "") or "")
    title = ""
    if hasattr(page, "css_first"):
        try:
            t_el = page.css_first("title")
            if t_el:
                title = t_el.text() if hasattr(t_el, "text") else str(t_el)
        except Exception:
            pass

    print(json.dumps({
        "text": text or "",
        "html": html or "",
        "title": title or "",
        "success": True,
    }))
except Exception as e:
    print(json.dumps({
        "text": "", "html": "", "title": "",
        "success": False, "error": str(e),
    }))
`;

      try {
        const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
          timeout: timeout + 5_000,
          maxBuffer: 20 * 1024 * 1024,
          env,
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
            engine: 'scrapling-stealth',
            success: false,
            error: result.error ?? 'Returned empty result',
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = result.text;

        attempts.push({
          engine: 'scrapling-stealth',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          html: result.html || undefined,
          title: result.title || undefined,
          engine: 'scrapling-stealth',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'scrapling-stealth',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
