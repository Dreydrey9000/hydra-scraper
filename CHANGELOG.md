## [2026-05-04] — evening (nice-to-haves)

### Added
- **CLI flags for scrapling-stealth**: `--actions <json>`, `--wait-selector <css>`, `--cookies <json>`, `--real-chrome`. You can now drive interactive scrapes from a bash one-liner instead of having to write Node code.
- **Cookie support** in `ScrapeOptions.cookies` — array of `{name, value}` sent as a Cookie header. Useful for session-token auth on sites that accept cookie-based logins. (Note: NOT a full storage_state — localStorage / sessionStorage are not restored.)
- **Vitest test suite** — 9 unit tests covering the engine contract, URL detection, action serialization round-trip, and cookie-header formatting. `npm test` green. Tests live in `tests/`.

### Changed
- CLI now validates `--actions` and `--cookies` JSON up-front and fails fast with a readable error before spinning up engines.

## [2026-05-04] — afternoon (lock-the-door fixes)

### Fixed
- `scrapling-stealth` no longer logs Scrapling's "deprecated" warning on every fetch — switched from instance-based `PlayWrightFetcher().fetch(...)` to class-method `PlayWrightFetcher.fetch(...)`. Removed deprecated `hide_canvas`/`disable_webgl` kwargs (already no-ops in 0.2.99).

### Added
- `requirements.txt` with pinned versions for all Python deps. Prevents silent breakage when Scrapling 0.3 lands with a different API.
- README: actions API example, scrapling-stealth in the engine table, requirements.txt install instructions, engine count bumped from 10 → 11.

## [2026-05-04]

### Added
- New engine: `scrapling-stealth` — Scrapling's `PlayWrightFetcher` with stealth (canvas hide, WebGL disable, real UA) and **page actions** (click/fill/wait/press/scroll/hover). First Hydra engine that can interact with a page, not just read it.
- New `ScrapeOptions` fields: `actions[]`, `waitSelector`, `realChrome` — opt-in interaction layer.
- Wired `scrapling-stealth` to lead `instagram`, `tiktok`, `auth`, and `spa` chains; added as backup on `general`, `linkedin`, `twitter`.
- `rebrowser-playwright` chromium browser installed (Scrapling uses this fork, separate from regular Playwright cache).
- "Why" — gives Hydra a stealth + interaction engine for sites where the read-only `scrapling` (StealthyFetcher) hits JS walls.

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
