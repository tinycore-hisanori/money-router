import { braveSearch } from './search.js';
import type { Source } from '../shared/types.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface PageResult {
  text: string;
  url: string; // the URL that actually produced the text
  via: 'direct' | 'search_page' | 'search_snippets';
}

/** Fetch a page and reduce it to readable text (strip scripts/styles/tags). */
export async function fetchPageText(url: string, maxChars = 40_000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = htmlToText(html).slice(0, maxChars);
  if (text.length < 300) throw new Error('page text too short (bot wall or JS-only page)');
  return text;
}

/**
 * Resilient page acquisition for a source:
 * 1. direct fetch of the registered URL
 * 2. on failure: search "<name> paypal payout", try up to 3 result URLs on the same domain
 * 3. on failure: use the search snippets themselves as the text (lower confidence)
 */
export async function acquireSourceText(source: Source): Promise<PageResult> {
  let firstErr: string | undefined;
  try {
    return { text: await fetchPageText(source.url), url: source.url, via: 'direct' };
  } catch (e: any) {
    firstErr = String(e.message ?? e);
  }

  const domain = hostOf(source.url);
  const hits = await braveSearch(`${source.name} PayPal payout OR payment methods site:${domain}`, 5);
  const alt = hits.filter((h) => hostOf(h.url).endsWith(domain) && h.url !== source.url).slice(0, 3);
  for (const h of alt) {
    try {
      return { text: await fetchPageText(h.url), url: h.url, via: 'search_page' };
    } catch {
      /* try next */
    }
  }

  const snippets = hits.flatMap((h) => [`# ${h.title}\n${h.url}\n${h.description}`, ...(h.extra_snippets ?? [])]).join('\n\n');
  if (snippets.length > 200) return { text: snippets, url: hits[0]?.url ?? source.url, via: 'search_snippets' };

  throw new Error(`${firstErr}; no usable search fallback`);
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
