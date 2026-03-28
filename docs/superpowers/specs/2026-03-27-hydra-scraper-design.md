# Hydra Scraper — Design Spec

**Date:** 2026-03-27
**Author:** Drey + Claude
**Status:** Approved

## Purpose

A self-healing, portable web scraping toolkit with multi-tier fallback engines. Never fails. Auto-detects available engines, degrades gracefully, ships to friends with zero config.

## Requirements

1. Single function `scrape(url)` → clean markdown, always returns something
2. 10+ scraping engines across 3 tiers (free/local/paid)
3. Auto-fallback: if engine A fails, engine B fires silently
4. URL-type detection: social media, SPAs, PDFs, auth-walled get specialized chains
5. CLI: `hydra-scraper <url>` works standalone
6. Claude Code skill: `/scrape` for Drey's workflow
7. Portable: friends install via `npm install -g hydra-scraper` + `hydra-scraper init`
8. Health dashboard: `hydra-scraper health` shows all engines + status
9. TypeScript orchestration layer (Andreas Ehn compliant)
10. Python engines (Crawl4AI, Scrapling) called via subprocess, not imports

## Architecture

```
~/My Apps/hydra-scraper/
├── src/
│   ├── index.ts              # Main export: scrape(), search(), extract()
│   ├── engine-router.ts      # Smart routing + fallback logic
│   ├── engines/
│   │   ├── jina.ts           # Tier 0: r.jina.ai prefix (free, instant)
│   │   ├── webfetch.ts       # Tier 0: Built-in fetch → markdown
│   │   ├── crawl4ai.ts       # Tier 1: Local Python crawler
│   │   ├── scrapling.ts      # Tier 1: Local Python stealth scraper
│   │   ├── playwright.ts     # Tier 1: Local browser automation
│   │   ├── cheerio.ts        # Tier 1: Fast HTML → markdown parser
│   │   ├── firecrawl.ts      # Tier 2: Cloud API
│   │   ├── tavily.ts         # Tier 2: Cloud API
│   │   ├── browserbase.ts    # Tier 2: Cloud browser
│   │   └── exa.ts            # Tier 2: Semantic search + extract
│   ├── health.ts             # Engine health checker
│   ├── detector.ts           # URL type detection (social, SPA, PDF, auth)
│   ├── types.ts              # ScrapeResult, ScrapeOptions, EngineStatus
│   └── utils/
│       ├── html-to-md.ts     # Turndown-based HTML → markdown
│       └── stealth.ts        # Anti-bot headers, user-agent rotation
├── cli.ts                    # CLI entry point
├── skill/
│   └── SKILL.md              # Claude Code skill wrapper
├── scripts/
│   └── init.ts               # Interactive setup wizard
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

## Engine Interface

Every engine implements:

```typescript
interface Engine {
  name: string;
  tier: 0 | 1 | 2;
  capabilities: ('html' | 'js-render' | 'stealth' | 'pdf' | 'search' | 'auth')[];
  isAvailable(): Promise<boolean>;
  scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult>;
}

interface ScrapeResult {
  url: string;
  markdown: string;
  html?: string;
  title?: string;
  engine: string;
  attempts: { engine: string; error?: string; durationMs: number }[];
  timestamp: string;
}

interface ScrapeOptions {
  format?: 'markdown' | 'html' | 'json';
  stealth?: boolean;
  waitFor?: number;       // ms to wait for JS render
  selector?: string;      // CSS selector to extract
  timeout?: number;       // per-engine timeout (default 15s)
  maxRetries?: number;    // max engines to try (default: all)
  preferTier?: 0 | 1 | 2;
  jsonSchema?: object;    // structured extraction schema
}
```

## Fallback Chains by URL Type

| URL Type | Detection | Engine Order |
|----------|-----------|-------------|
| General | default | Jina → WebFetch → Crawl4AI → Firecrawl → Scrapling → Playwright |
| JS SPA | `<noscript>`, empty body, SPA frameworks in HTML | Crawl4AI → Playwright → Scrapling(Dynamic) → Firecrawl(waitFor) |
| Instagram | `instagram.com` in URL | Scrapling(stealth) → Firecrawl(stealth) → Playwright(profile) → Crawl4AI |
| LinkedIn | `linkedin.com` in URL | Exa(people) → Tavily(advanced) → Scrapling(stealth) → Firecrawl(enhanced) |
| Twitter/X | `x.com` or `twitter.com` | Jina → Firecrawl → Scrapling → Tavily |
| PDF | `.pdf` extension or content-type | WebFetch → Firecrawl(pdf) → Crawl4AI → curl |
| Search | opts.type === 'search' | Exa → Firecrawl search → Tavily search |
| Auth-walled | opts.stealth or detected login redirect | Playwright(profile) → Browserbase → Scrapling(session) → Firecrawl(browser) |

## Engine Router Logic

```
1. Detect URL type (social, SPA, PDF, search, general)
2. Get fallback chain for that type
3. Filter chain to available engines only (health check, cached 5min)
4. For each engine in chain:
   a. Try scrape with per-engine timeout (15s default)
   b. If success + content length > 100 chars → return result
   c. If fail → log attempt, try next engine
   d. If content too short → try next engine (might be a block page)
5. If all engines fail → return best partial result with error context
6. NEVER return empty. Partial > nothing.
```

## Health Check System

```typescript
// hydra-scraper health
╔══════════════════════════════════════════════╗
║  HYDRA SCRAPER — Engine Health               ║
╠══════════════════════════════════════════════╣
║  Tier 0 (Free, Zero Config)                  ║
║  ✅ Jina Reader         — ready              ║
║  ✅ WebFetch            — ready              ║
║                                              ║
║  Tier 1 (Free, Local Install)                ║
║  ✅ Crawl4AI            — ready (v0.4.2)     ║
║  ✅ Scrapling           — ready (v0.3.1)     ║
║  ✅ Playwright          — ready (chromium)   ║
║  ✅ Cheerio             — ready              ║
║                                              ║
║  Tier 2 (Paid APIs)                          ║
║  ⚠️  Firecrawl           — no credits        ║
║  ⚠️  Tavily              — no credits        ║
║  ✅ Browserbase         — ready              ║
║  ✅ Exa                 — ready              ║
║                                              ║
║  Active engines: 8/10                        ║
║  Fallback depth: 8 engines                   ║
╚══════════════════════════════════════════════╝
```

## Portability (Friends Setup)

```bash
npm install -g hydra-scraper
hydra-scraper init
```

Init wizard:
1. Detect Node.js version (require 18+)
2. Detect Python3 availability
3. Offer to install Crawl4AI: `pip install crawl4ai && crawl4ai-setup`
4. Offer to install Scrapling: `pip install scrapling`
5. Ask for optional API keys (Firecrawl, Tavily, Exa, Browserbase)
6. Write `.hydra.json` to home directory
7. Run `hydra-scraper health` to verify

Minimum viable: Node.js only. Tier 0 engines (Jina + fetch) work with zero additional installs.

## Claude Code Skill

```markdown
---
name: hydra-scraper
description: "Bulletproof web scraping with 10+ fallback engines. Never fails. Triggers: /scrape, 'scrape this', 'get this page', 'read this URL'"
---

Run `hydra-scraper <url>` via Bash. Parse the markdown output.
For structured data: `hydra-scraper <url> --json --schema '{"title":"string","price":"number"}'`
For health check: `hydra-scraper health`
For stealth mode: `hydra-scraper --stealth <url>`
```

## Dependencies

### npm (TypeScript layer)
- `turndown` — HTML to markdown conversion
- `cheerio` — fast HTML parsing
- `node-fetch` — HTTP client (or built-in fetch on Node 18+)
- `commander` — CLI framework
- `chalk` — terminal colors
- `ora` — spinners

### pip (Python engines, optional)
- `crawl4ai` — LLM-native web crawler
- `scrapling` — stealth scraper with anti-bot bypass

### Optional API keys
- `FIRECRAWL_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `BROWSERBASE_API_KEY`

## Success Criteria

1. `hydra-scraper https://example.com` returns markdown in <5s
2. `hydra-scraper health` shows all available engines
3. When Firecrawl is out of credits, scraping still works via free engines
4. A friend can install and scrape within 2 minutes
5. Instagram/LinkedIn/Twitter scraping works via stealth engines
6. Claude Code `/scrape` skill works in Drey's sessions
