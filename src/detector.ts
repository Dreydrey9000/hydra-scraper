import { UrlType } from './types.js';

/**
 * Detects URL type based on domain or file extension.
 * Used by the engine router to pick the right fallback chain.
 */
export function detectUrlType(url: string): UrlType {
  let hostname = '';
  let pathname = '';

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    // If URL parsing fails, treat as general
    return 'general';
  }

  // Check file extension first — a PDF on any domain is still a PDF
  if (pathname.endsWith('.pdf')) {
    return 'pdf';
  }

  // Match by domain
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }

  if (hostname.includes('linkedin.com')) {
    return 'linkedin';
  }

  if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
    return 'twitter';
  }

  if (hostname.includes('tiktok.com')) {
    return 'tiktok';
  }

  return 'general';
}
