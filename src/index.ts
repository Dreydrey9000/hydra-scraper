import { loadConfig } from './config.js';
import { EngineRouter } from './engine-router.js';
import { checkHealth, printHealth } from './health.js';
import type { Engine, ScrapeOptions, ScrapeResult, EngineStatus } from './types.js';

// Engine factories — one per scraping backend
import { createJinaEngine } from './engines/jina.js';
import { createWebFetchEngine } from './engines/webfetch.js';
import { createCheerioEngine } from './engines/cheerio.js';
import { createCrawl4aiEngine } from './engines/crawl4ai.js';
import { createScraplingEngine } from './engines/scrapling.js';
import { createFirecrawlEngine } from './engines/firecrawl.js';
import { createPlaywrightEngine } from './engines/playwright.js';
import { createExaEngine } from './engines/exa.js';
import { createTavilyEngine } from './engines/tavily.js';
import { createBrowserbaseEngine } from './engines/browserbase.js';
import { createJinaSearchEngine } from './engines/jina-search.js';
import { createBraveEngine } from './engines/brave.js';
import { createPerplexityEngine } from './engines/perplexity.js';
import { createMarkItDownEngine } from './engines/markitdown.js';
import { createCurlEngine } from './engines/curl.js';

/**
 * Creates all 10 engines and wires them into the router.
 * Returns an object with scrape(), health(), and the raw router.
 *
 * Think of this as turning the key on the whole system —
 * it boots every engine, registers them, and hands you a simple API.
 */
export function createHydra(): {
  scrape: (url: string, opts?: ScrapeOptions) => Promise<ScrapeResult>;
  health: () => Promise<EngineStatus[]>;
  router: EngineRouter;
} {
  // Load config (API keys, timeouts, etc.)
  loadConfig();

  // Create all 15 engines
  const engineList: Engine[] = [
    createJinaEngine(),
    createWebFetchEngine(),
    createCheerioEngine(),
    createCrawl4aiEngine(),
    createScraplingEngine(),
    createFirecrawlEngine(),
    createPlaywrightEngine(),
    createExaEngine(),
    createTavilyEngine(),
    createBrowserbaseEngine(),
    createJinaSearchEngine(),
    createBraveEngine(),
    createPerplexityEngine(),
    createMarkItDownEngine(),
    createCurlEngine(),
  ];

  // Register them in a Map keyed by name
  const engineMap = new Map<string, Engine>();
  for (const engine of engineList) {
    engineMap.set(engine.name, engine);
  }

  // Create the router (the brain that picks which engine to try)
  const router = new EngineRouter(engineMap);

  return {
    /** Scrape a URL — router picks the best engine automatically */
    scrape: (url: string, opts?: ScrapeOptions) => router.scrape(url, opts),

    /** Check which engines are available right now */
    health: () => checkHealth(engineList),

    /** Direct access to the router if you need it */
    router,
  };
}

/**
 * One-shot convenience function.
 * Creates a Hydra instance, scrapes the URL, and returns the result.
 * Good for scripts and one-off use — no need to manage an instance.
 */
export async function scrape(url: string, opts?: ScrapeOptions): Promise<ScrapeResult> {
  const hydra = createHydra();
  return hydra.scrape(url, opts);
}

// Re-export types so consumers don't need a separate import
export type { ScrapeResult, ScrapeOptions, EngineStatus, Engine } from './types.js';
export { EngineRouter } from './engine-router.js';
export { checkHealth, printHealth } from './health.js';
export { loadConfig } from './config.js';
