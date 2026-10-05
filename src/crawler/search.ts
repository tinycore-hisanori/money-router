import { config } from '../server/lib/config.js';

export interface SearchHit {
  title: string;
  url: string;
  description: string;
  extra_snippets?: string[];
}

export const braveAvailable = () => Boolean(config.brave.apiKey);

let used = 0;
export const braveQueriesUsed = () => used;
export const resetBraveBudget = () => (used = 0);

/** Brave Web Search. Returns [] (never throws) when the key is missing or the budget is spent. */
export async function braveSearch(q: string, count = 5, opts: { freshness?: 'pd' | 'pw' | 'pm' | 'py'; lang?: string } = {}): Promise<SearchHit[]> {
  if (!braveAvailable()) return [];
  if (used >= config.brave.maxQueriesPerRun) {
    console.warn(`[brave] query budget (${config.brave.maxQueriesPerRun}) spent; skipping "${q}"`);
    return [];
  }
  used++;
  const qs = new URLSearchParams({ q, count: String(count), text_decorations: '0', extra_snippets: '1' });
  if (opts.freshness) qs.set('freshness', opts.freshness);
  if (opts.lang) qs.set('search_lang', opts.lang);
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${qs}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': config.brave.apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(`[brave] ${res.status} for "${q}"`);
    return [];
  }
  const j = (await res.json()) as any;
  return (j.web?.results ?? []).map((r: any) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.description ?? '',
    extra_snippets: r.extra_snippets ?? [],
  }));
}
