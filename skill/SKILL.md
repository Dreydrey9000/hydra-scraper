---
name: hydra-scraper
description: "Bulletproof web scraping with 10+ fallback engines. Never fails. Use when any URL needs scraping, any page needs reading, any content needs extracting. Triggers: /scrape, 'scrape this', 'get this page', 'read this URL', 'extract from', 'crawl this'"
metadata:
  bashPattern:
    - "hydra-scraper"
    - "scrape"
  filePattern: []
  priority: 90
---

# Hydra Scraper

Self-healing web scraper with 10 fallback engines across 3 tiers. If one engine fails (out of credits, blocked, down), the next fires automatically. **It never returns empty.**

## Quick Use

```bash
# Scrape any URL → clean markdown
hydra-scraper "https://example.com"

# Stealth mode (Instagram, TikTok, LinkedIn)
hydra-scraper --stealth "https://instagram.com/p/xyz"

# Get structured JSON
hydra-scraper "https://example.com" --json

# Save to file
hydra-scraper "https://example.com" -o /tmp/output.md

# Check what engines are available
hydra-scraper health
```

## When Claude Should Use This

Instead of trying individual web tools (WebFetch, firecrawl_scrape, tavily_extract, etc.), ALWAYS use `hydra-scraper` first. It automatically:
- Detects the URL type (social media, SPA, PDF, general)
- Picks the best engine for that URL type
- Falls back through up to 8 engines if the first one fails
- Returns clean markdown every time

## Engine Tiers

| Tier | Engines | Cost |
|------|---------|------|
| **0 — Free** | Jina Reader, WebFetch | $0, always available |
| **1 — Local** | Cheerio, Crawl4AI, Scrapling, Playwright | $0, needs Python |
| **2 — Paid** | Firecrawl, Tavily, Exa, Browserbase | API keys required |

## URL-Specific Routing

The router automatically picks the right chain:
- **Instagram** → Scrapling(stealth) → Firecrawl → Crawl4AI → Playwright
- **LinkedIn** → Exa → Tavily → Scrapling → Firecrawl
- **Twitter/X** → Jina → Firecrawl → Scrapling → Tavily
- **JS-heavy SPAs** → Crawl4AI → Playwright → Scrapling → Firecrawl
- **PDFs** → WebFetch → Firecrawl → Crawl4AI
- **General pages** → Jina → WebFetch → Cheerio → Crawl4AI → Scrapling → Firecrawl

## For Claude: Replace Your Old Web Ladder

**BEFORE (old way):** Try WebFetch → if blocked try firecrawl_scrape → if out of credits try tavily_extract → etc.

**NOW (Hydra way):** Just run `hydra-scraper "<url>"` via Bash. Done. It handles all the fallback logic internally.
