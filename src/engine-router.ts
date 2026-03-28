import { Engine, ScrapeOptions, ScrapeResult, Attempt, UrlType } from './types.js';
import { detectUrlType } from './detector.js';
import { loadConfig } from './config.js';

/**
 * Fallback chains per URL type.
 * Order matters — first engine that succeeds wins.
 * Chains are tuned so the fastest/cheapest engines go first.
 */
const FALLBACK_CHAINS: Record<UrlType, string[]> = {
  general:   ['jina', 'webfetch', 'cheerio', 'crawl4ai', 'scrapling', 'firecrawl', 'playwright'],
  instagram: ['scrapling', 'firecrawl', 'crawl4ai', 'playwright'],
  linkedin:  ['exa', 'tavily', 'scrapling', 'firecrawl'],
  twitter:   ['jina', 'firecrawl', 'scrapling', 'tavily'],
  tiktok:    ['scrapling', 'firecrawl', 'crawl4ai', 'playwright'],
  pdf:       ['webfetch', 'firecrawl', 'crawl4ai'],
  spa:       ['crawl4ai', 'playwright', 'scrapling', 'firecrawl'],
  search:    ['exa', 'firecrawl', 'tavily'],
  auth:      ['playwright', 'browserbase', 'scrapling', 'firecrawl'],
};

/** Minimum content length to consider a scrape successful */
const MIN_CONTENT_LENGTH = 100;

/**
 * The brain of Hydra. Takes a URL, figures out what kind of site it is,
 * picks the right engine chain, and tries each one until something works.
 *
 * Think of it like a lockpick set — it tries the most likely pick first,
 * then works through the rest until the door opens.
 */
export class EngineRouter {
  private engines: Map<string, Engine>;

  constructor(engines: Map<string, Engine>) {
    this.engines = engines;
  }

  /**
   * Scrape a URL with automatic engine selection and fallback.
   * NEVER returns null — worst case you get an error result with all attempts logged.
   */
  async scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
    const startTime = Date.now();
    const attempts: Attempt[] = [];
    const config = loadConfig();
    const perEngineTimeout = opts.timeout ?? config.defaultTimeout ?? 15_000;

    // Step 1: Detect what kind of URL this is
    const urlType = detectUrlType(url);

    // Step 2: Get the fallback chain for this type
    const chain = FALLBACK_CHAINS[urlType] ?? FALLBACK_CHAINS.general;

    // Step 3: Filter to only engines we actually have registered
    const availableChain = await this.filterAvailable(chain);

    if (availableChain.length === 0) {
      return this.buildErrorResult(url, attempts, startTime, 'No engines available for this URL type');
    }

    // Step 4: Try each engine in order until one succeeds
    let bestPartial: ScrapeResult | null = null;

    for (const engineName of availableChain) {
      const engine = this.engines.get(engineName)!;
      const attemptStart = Date.now();

      try {
        const result = await this.runWithTimeout(
          engine.scrape(url, opts),
          perEngineTimeout,
          engineName,
        );

        const attemptDuration = Date.now() - attemptStart;

        if (!result) {
          attempts.push({
            engine: engineName,
            success: false,
            error: 'Engine returned null',
            durationMs: attemptDuration,
          });
          continue;
        }

        const contentLength = result.markdown.length;

        // If content is too short, treat as failure but keep as partial
        if (contentLength < MIN_CONTENT_LENGTH) {
          attempts.push({
            engine: engineName,
            success: false,
            error: `Content too short (${contentLength} chars)`,
            durationMs: attemptDuration,
            contentLength,
          });

          // Save as partial in case everything else fails too
          if (!bestPartial || contentLength > (bestPartial.markdown.length)) {
            bestPartial = { ...result, attempts: [...attempts], durationMs: Date.now() - startTime };
          }

          continue;
        }

        // Success — attach all attempts and return
        attempts.push({
          engine: engineName,
          success: true,
          durationMs: attemptDuration,
          contentLength,
        });

        return {
          ...result,
          attempts,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        const attemptDuration = Date.now() - attemptStart;
        const errorMsg = err instanceof Error ? err.message : String(err);

        attempts.push({
          engine: engineName,
          success: false,
          error: errorMsg,
          durationMs: attemptDuration,
        });
      }
    }

    // Step 5: All engines failed — return partial if we have one, otherwise error
    if (bestPartial) {
      return {
        ...bestPartial,
        attempts,
        durationMs: Date.now() - startTime,
      };
    }

    return this.buildErrorResult(url, attempts, startTime, 'All engines failed');
  }

  /**
   * Filters the chain to only engines that are registered AND available.
   * Checks availability in parallel for speed.
   */
  private async filterAvailable(chain: string[]): Promise<string[]> {
    // First pass: only engines we have registered
    const registered = chain.filter((name) => this.engines.has(name));

    // Second pass: check which ones are actually available (parallel)
    const checks = await Promise.all(
      registered.map(async (name) => {
        try {
          const available = await this.engines.get(name)!.isAvailable();
          return { name, available };
        } catch {
          return { name, available: false };
        }
      }),
    );

    return checks.filter((c) => c.available).map((c) => c.name);
  }

  /**
   * Wraps a promise with a timeout. If the engine takes too long, we move on.
   */
  private runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    engineName: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${engineName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Builds a guaranteed non-null error result when everything fails.
   */
  private buildErrorResult(
    url: string,
    attempts: Attempt[],
    startTime: number,
    error: string,
  ): ScrapeResult {
    return {
      url,
      markdown: '',
      title: undefined,
      engine: 'none',
      attempts,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }
}
