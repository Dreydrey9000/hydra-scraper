## [2026-03-27]

### Added
- Initial build of Hydra Scraper — self-healing web scraper with 10 fallback engines
- 3-tier engine system: Tier 0 (Jina, WebFetch), Tier 1 (Cheerio, Crawl4AI, Scrapling, Playwright), Tier 2 (Firecrawl, Tavily, Exa, Browserbase)
- Smart URL type detection: Instagram, LinkedIn, Twitter, TikTok, PDF, SPA, general
- Per-URL-type fallback chains — each URL type gets the optimal engine order
- Engine health dashboard (`hydra-scraper health`) showing all engines + availability
- CLI with stealth mode, JSON output, file save, and timeout options
- Claude Code skill at `~/.claude/skills/hydra-scraper/SKILL.md`
- Python venv with Crawl4AI + Scrapling installed locally
- Portable design: friends can install with `npm install` + optional Python setup
- TypeScript orchestration layer (Andreas Ehn compliant — Python called via subprocess only)
