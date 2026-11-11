import { braveSearch } from './search.js';
import type { Source } from '../shared/types.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface PageResult {
  text: string;
  url: string; // the URL that actually produced the text
  via: 'direct' | 'search_page' | 'search_snippets';
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/**
 * Parse listing-style date ranges ("Sep 24 - Nov 18, 2026", "Nov 10 - 18, 2026", "Dec 5, 2026 - Jan 9, 2027")
 * into ISO {starts, deadline}. Returns null when the text is not such a range.
 */
export function parseDateRange(text: string): { starts: string; deadline: string } | null {
  const m = text.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,\s*(\d{4}))?\s*[-–—]\s*(?:([A-Za-z]{3})[a-z]*\.?\s+)?(\d{1,2}),?\s*(\d{4})/);
  if (!m) return null;
  const [, m1, d1, y1, m2, d2, y2] = m;
  const mo1 = MONTHS[m1.toLowerCase()], mo2 = m2 ? MONTHS[m2.toLowerCase()] : mo1;
  if (!mo1 || !mo2) return null;
  const iso = (y: string, mo: number, d: string) => `${y}-${String(mo).padStart(2, '0')}-${d.padStart(2, '0')}`;
  const endY = y2, startY = y1 ?? (mo1 > mo2 ? String(Number(y2) - 1) : y2);
  return { starts: iso(startY, mo1, d1), deadline: iso(endY, mo2, d2) };
}

/** Turn a JSON listing into compact "key: value" lines (one block per item, shallow fields only). */
export function jsonToLines(raw: string): string {
  let j: any;
  try { j = JSON.parse(raw); } catch { return raw; }
  const items: any[] = Array.isArray(j) ? j : (Object.values(j).find((v) => Array.isArray(v)) as any[]) ?? [j];
  const KEEP = /^(title|name|url|tagline|description|prize|prize_amount|prizes_counts|submission_period_dates|time_left_to_submission|deadline|ends?_at|end_date|open_state|status|themes|eligibility|location|displayed_location|organization_name|invite_only|eligibility_requirement_invite_only_description|managed_by_devpost_badge)$/i;
  const flat = (v: any): string => {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(', ');
    if (typeof v === 'object') return 'name' in v || 'title' in v || 'location' in v ? flat(v.name ?? v.title ?? v.location) : Object.entries(v).map(([k, x]) => `${k}=${flat(x)}`).join(' ');
    return String(v).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };
  return items
    .slice(0, 15)
    .map((it, i) => {
      const lines = Object.entries(it).filter(([k]) => KEEP.test(k)).map(([k, v]) => `${k}: ${flat(v)}`).filter((l) => !l.endsWith(': '));
      const range = parseDateRange(flat(it.submission_period_dates ?? it.dates ?? it.period ?? ''));
      if (range) lines.push(`starts: ${range.starts}`, `deadline: ${range.deadline}`);
      return `## item ${i + 1}\n` + lines.join('\n');
    })
    .join('\n\n');
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
  const ct = res.headers.get('content-type') ?? '';
  // JSON APIs (e.g. Devpost hackathon list): compact into one line per item so the extractor sees
  // 20-40 items in a few KB instead of a raw JSON blob that overflows the model's output budget.
  const text = (ct.includes('json') || /^\s*[\[{]/.test(html) ? jsonToLines(html) : htmlToText(html)).slice(0, maxChars);
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
    let text = r.text.slice(0, 25_000);
    const rules = await findRulesText(source);
    if (rules) text += `\n\n---- OFFICIAL RULES / ELIGIBILITY (${rules.url}) ----\n${rules.text}`;
    text += await complaintSearchSection(source.name);
    return { ...r, text };
  }
  return r;
}

/** Search for non-payment complaints about a host; returns a section the extractor can cite (may be empty). */
export async function complaintSearchSection(name: string): Promise<string> {
  const hits = await braveSearch(`"${name}" ("never paid" OR "not paid" OR "didn't pay" OR "not received" OR scam OR 未払い OR 支払われない)`, 5);
  if (!hits.length) return '\n\n---- COMPLAINT SEARCH ----\n(no results)';
  return '\n\n---- COMPLAINT SEARCH (unverified web results; cite only credible, specific reports) ----\n' + hits.map((h) => `# ${h.title}\n${h.url}\n${h.description}`).join('\n\n');
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
