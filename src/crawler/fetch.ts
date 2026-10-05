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
  const r = await acquireBase(source);
  // Contests/promos: eligibility lives in Official Rules. Try hard to append them.
  if (source.category === 'contest' || source.category === 'referral') {
    const rules = await findRulesText(source);
    if (rules) return { ...r, text: `${r.text.slice(0, 25_000)}\n\n---- OFFICIAL RULES / ELIGIBILITY (${rules.url}) ----\n${rules.text}` };
  }
  return r;
}

/** Look for an official rules / eligibility page on the same domain; returns null when nothing usable. */
async function findRulesText(source: Source): Promise<{ url: string; text: string } | null> {
  const domain = hostOf(source.url);
  const hits = await braveSearch(`${source.name} official rules eligibility OR 応募資格 OR 参加資格 site:${domain}`, 5);
  for (const h of hits.slice(0, 3)) {
    try {
      const text = await fetchPageText(h.url, 20_000);
      if (/eligib|resident|citizen|応募資格|参加資格|対象|void where prohibited|18 years|age of majority/i.test(text)) return { url: h.url, text };
    } catch {
      /* next */
    }
  }
  return null;
}

async function acquireBase(source: Source): Promise<PageResult> {
  let firstErr: string | undefined;
  let direct: string | null = null;
  try {
    direct = await fetchPageText(source.url);
    // A landing page that never mentions PayPal is not enough to judge payout terms:
    // keep it, but go find the payout/payment page and append it.
    if (/paypal/i.test(direct)) return { text: direct, url: source.url, via: 'direct' };
  } catch (e: any) {
    firstErr = String(e.message ?? e);
  }

  const domain = hostOf(source.url);
  // parse_hint steers the search toward the right page (e.g. "publisher payout", not an advertiser or product page)
  const hint = source.parse_hint ? ` ${source.parse_hint.split(/[;,.]/)[0]}` : '';
  let hits = await braveSearch(`${source.name}${hint} PayPal payout OR payment methods site:${domain}`, 5);
  // Registered host may be wrong or unreachable: widen to the open web, keep official-looking hits first.
  if (!hits.length) {
    hits = await braveSearch(`${source.name} payout methods PayPal official`, 6);
    const root = domain.split('.').slice(-2, -1)[0] ?? '';
    hits.sort((a, b) => Number(hostOf(b.url).includes(root)) - Number(hostOf(a.url).includes(root)));
  }
  const alt = hits.filter((h) => h.url !== source.url).slice(0, 3);
  for (const h of alt) {
    try {
      const t = await fetchPageText(h.url);
      return { text: direct ? `${direct.slice(0, 15_000)}\n\n---- payout page (${h.url}) ----\n${t}` : t, url: h.url, via: 'search_page' };
    } catch {
      /* try next */
    }
  }

  const snippets = hits.flatMap((h) => [`# ${h.title}\n${h.url}\n${h.description}`, ...(h.extra_snippets ?? [])]).join('\n\n');
  if (snippets.length > 200) {
    return {
      text: direct ? `${direct.slice(0, 15_000)}\n\n---- search snippets about payouts ----\n${snippets}` : snippets,
      url: hits[0]?.url ?? source.url,
      via: 'search_snippets',
    };
  }
  if (direct) return { text: direct, url: source.url, via: 'direct' }; // nothing better; let the extractor decide

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
