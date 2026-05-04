export interface ScrapeResult {
  url: string;
  markdown: string;
  html?: string;
  title?: string;
  engine: string;
  attempts: Attempt[];
  timestamp: string;
  durationMs: number;
}

export interface Attempt {
  engine: string;
  success: boolean;
  error?: string;
  durationMs: number;
  contentLength?: number;
}

export interface ScrapeOptions {
  format?: "markdown" | "html" | "json";
  stealth?: boolean;
  waitFor?: number;
  selector?: string;
  timeout?: number;
  maxRetries?: number;
  preferTier?: 0 | 1 | 2;
  jsonSchema?: Record<string, unknown>;
  silent?: boolean;
  /** Page actions executed before scraping (only honored by action-capable engines like scrapling-stealth) */
  actions?: ScrapeAction[];
  /** Wait for a CSS selector to appear before scraping */
  waitSelector?: string;
  /** Use the real installed Chrome instead of bundled Chromium (better fingerprint) */
  realChrome?: boolean;
}

export type ScrapeAction =
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "wait"; ms: number }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "top" | "bottom"; selector?: string }
  | { type: "hover"; selector: string };

export interface EngineStatus {
  name: string;
  tier: 0 | 1 | 2;
  available: boolean;
  reason?: string;
  version?: string;
}

export type UrlType =
  | "general"
  | "spa"
  | "instagram"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "pdf"
  | "search"
  | "auth";

export type Capability =
  | "html"
  | "js-render"
  | "stealth"
  | "pdf"
  | "search"
  | "auth";

export interface Engine {
  name: string;
  tier: 0 | 1 | 2;
  capabilities: Capability[];
  isAvailable(): Promise<boolean>;
  scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null>;
}

export interface HydraConfig {
  firecrawlApiKey?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  browserbaseApiKey?: string;
  braveApiKey?: string;
  perplexityApiKey?: string;
  pythonPath?: string;
  venvPath?: string;
  defaultTimeout?: number;
  preferredTier?: 0 | 1 | 2;
}
