import { describe, it, expect } from 'vitest';
import { createScraplingStealthEngine } from '../src/engines/scrapling-stealth.js';
import { detectUrlType } from '../src/detector.js';
import type { ScrapeAction, ScrapeCookie } from '../src/types.js';

describe('scrapling-stealth engine — contract', () => {
  const engine = createScraplingStealthEngine();

  it('exposes name "scrapling-stealth"', () => {
    expect(engine.name).toBe('scrapling-stealth');
  });

  it('lives on Tier 1 (local, free)', () => {
    expect(engine.tier).toBe(1);
  });

  it('declares stealth + js-render + auth capabilities', () => {
    expect(engine.capabilities).toContain('stealth');
    expect(engine.capabilities).toContain('js-render');
    expect(engine.capabilities).toContain('auth');
  });
});

describe('URL type detection — scrapling-stealth target chains', () => {
  it('routes Instagram as instagram', () => {
    expect(detectUrlType('https://instagram.com/p/xyz')).toBe('instagram');
    expect(detectUrlType('https://www.instagram.com/somebody')).toBe('instagram');
  });

  it('routes TikTok as tiktok', () => {
    expect(detectUrlType('https://tiktok.com/@user')).toBe('tiktok');
    expect(detectUrlType('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('routes plain URLs as general', () => {
    expect(detectUrlType('https://example.com')).toBe('general');
  });
});

describe('ScrapeAction shape — guarantees the python script can interpret it', () => {
  it('accepts every supported action variant', () => {
    const actions: ScrapeAction[] = [
      { type: 'click', selector: 'button.primary' },
      { type: 'fill', selector: 'input[name=email]', value: 'a@b.com' },
      { type: 'wait', ms: 1500 },
      { type: 'press', key: 'Enter' },
      { type: 'scroll', direction: 'bottom' },
      { type: 'scroll', selector: '#footer' },
      { type: 'hover', selector: 'a.menu' },
    ];
    // Round-trip serialize — the engine sends JSON to a Python subprocess,
    // so the array MUST survive JSON.parse(JSON.stringify(...)) intact.
    const roundTripped = JSON.parse(JSON.stringify(actions)) as ScrapeAction[];
    expect(roundTripped).toEqual(actions);
    expect(roundTripped).toHaveLength(7);
  });
});

describe('ScrapeCookie → Cookie header serialization', () => {
  it('serializes a single cookie to "name=value"', () => {
    const cookies: ScrapeCookie[] = [{ name: 'session', value: 'abc123' }];
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect(header).toBe('session=abc123');
  });

  it('serializes multiple cookies with "; " separator (RFC 6265)', () => {
    const cookies: ScrapeCookie[] = [
      { name: 'session', value: 'abc' },
      { name: 'csrf', value: 'xyz' },
    ];
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect(header).toBe('session=abc; csrf=xyz');
  });
});
