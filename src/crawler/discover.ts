// Source Discovery: let the AI find NEW places that pay via PayPal, shaped by the user's profile.
// Flow: profile -> search strategies (LLM) -> Brave search -> candidate pages -> LLM triage -> candidates.json
// Candidates are NOT crawled until a human approves them in the UI (anti-scam gate).
import { config } from '../server/lib/config.js';
import { structured } from '../server/lib/llm.js';
import { store } from '../server/lib/storage.js';
import { braveSearch, braveQueriesUsed, resetBraveBudget } from './search.js';
import { fetchPageText } from './fetch.js';
import type { Category, Source, UserProfile } from '../shared/types.js';

export interface SourceCandidate {
  id: string;
  name: string;
  url: string;
  category: Category;
  why: string; // one line: what it is and why it fits the profile
  paypal_evidence: string; // what the page/snippet says about PayPal
  fit_score: number; // 0-100: relevance to this profile (country + skills)
  legitimacy_hint: number; // 0-100: quick triage, not the full audit
  country_note: string;
  query: string; // which search found it
  found_at: string;
  status: 'candidate' | 'approved' | 'rejected';
}

const CATEGORIES = ['game_portal', 'bug_bounty', 'user_testing', 'survey', 'microtask', 'stock_assets', 'freelance', 'affiliate', 'referral', 'contest', 'licensing', 'localization', 'data_collection', 'other'];

/** 1) Turn the profile into concrete search queries (in English and the user's language). */
async function planQueries(profile: UserProfile, max: number): Promise<{ query: string; category: string; rationale: string }[]> {
  const r = await structured<{ queries: { query: string; category: string; rationale: string }[] }>({
    model: config.models.explain,
    system: `You design web-search queries to discover places where a specific person can earn money that is PAID OUT VIA PAYPAL.
Rules:
- Prefer "do X, get paid Y" opportunities with explicit amounts: contests and hackathon prizes, bounties, per-task work, sign-up/referral bonuses, game licensing/sponsorship deals, localization gigs, data-collection panels. Avoid generic "make money online" listicles.
- Every query must be answerable with an official platform page (not a blog). Include words like "PayPal", "payout", "prize", "paid", and the country or language when it matters (e.g. "Japan", "日本", "Japanese speakers").
- Mix English queries and queries in the user's language.
- Return at most ${max} queries, most promising first. Categories: ${CATEGORIES.join(', ')}.`,
    user: JSON.stringify({ profile: { country: profile.country, language: profile.language, skills: profile.skills, hours_per_week: profile.hours_per_week, free_text: profile.free_text } }),
    schema: { type: 'object', properties: { queries: { type: 'array', items: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, rationale: { type: 'string' } } } } } },
  });
  return r.queries.slice(0, max);
}

/** 3) Triage a batch of search hits: which are real PayPal-paying sources worth a human look? */
async function triage(profile: UserProfile, hits: { query: string; category: string; title: string; url: string; text: string }[]) {
  const r = await structured<{ candidates: { url: string; name: string; category: string; why: string; paypal_evidence: string; fit_score: number; legitimacy_hint: number; country_note: string; keep: boolean }[] }>({
    model: config.models.audit,
    maxTokens: 4096,
    system: `You triage web pages found while searching for ways a person can earn money paid via PayPal.
For each page decide keep=true only if ALL hold: (1) it is an official platform/program page (not a blog, listicle, forum or affiliate review), (2) there is concrete evidence it pays via PayPal (quote it; if the page is silent, keep=false), (3) the person's country is not excluded, (4) it is a real earning opportunity with a defined action and reward.
fit_score: how well it matches the person's skills/country. legitimacy_hint: 0-100 quick scam check (upfront fees, "guaranteed income", no company = low). Use the page's own name for "name". Categories: ${CATEGORIES.join(', ')}.`,
    user: JSON.stringify({ profile: { country: profile.country, language: profile.language, skills: profile.skills }, pages: hits.map((h) => ({ ...h, text: h.text.slice(0, 6000) })) }),
    schema: {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          items: { type: 'object', properties: { url: { type: 'string' }, name: { type: 'string' }, category: { type: 'string' }, why: { type: 'string' }, paypal_evidence: { type: 'string' }, fit_score: { type: 'integer' }, legitimacy_hint: { type: 'integer' }, country_note: { type: 'string' }, keep: { type: 'boolean' } } },
        },
      },
    },
  });
  return r.candidates.filter((c) => c.keep);
}

export interface DiscoveryResult {
  ran_at: string;
  queries: { query: string; category: string; rationale: string; hits: number }[];
  new_candidates: number;
  brave_queries_used: number;
}

export async function runDiscovery(opts: { maxQueries?: number; perQuery?: number } = {}): Promise<DiscoveryResult> {
  const maxQueries = Math.min(opts.maxQueries ?? 12, config.brave.maxQueriesPerRun);
  const perQuery = opts.perQuery ?? 5;
  const profile = await store.getProfile();
  const sources = await store.getSources();
  const existing = await store.getCandidates();
  const known = new Set([...sources.map((s) => hostOf(s.url)), ...existing.map((c) => hostOf(c.url))]);
  resetBraveBudget();

  const plan = await planQueries(profile, maxQueries);
  const result: DiscoveryResult = { ran_at: new Date().toISOString(), queries: [], new_candidates: 0, brave_queries_used: 0 };
  const pages: { query: string; category: string; title: string; url: string; text: string }[] = [];

  for (const q of plan) {
    const hits = await braveSearch(q.query, perQuery);
    result.queries.push({ ...q, hits: hits.length });
    for (const h of hits) {
      const host = hostOf(h.url);
      if (!host || known.has(host) || BLOCKED_HOSTS.some((b) => host.endsWith(b))) continue;
      known.add(host); // one page per host per run
      let text = `${h.description}\n${(h.extra_snippets ?? []).join('\n')}`;
      try {
        text = await fetchPageText(h.url, 12_000);
      } catch {
        /* snippets only */
      }
      pages.push({ query: q.query, category: q.category, title: h.title, url: h.url, text });
    }
  }
  console.log(`[discover] ${plan.length} queries -> ${pages.length} candidate pages`);

  const out = [...existing];
  for (let i = 0; i < pages.length; i += 8) {
    const batch = pages.slice(i, i + 8);
    try {
      const kept = await triage(profile, batch);
      for (const c of kept) {
        const page = batch.find((p) => p.url === c.url) ?? batch[0];
        out.push({
          id: `cand:${hostOf(c.url)}`,
          name: c.name,
          url: c.url,
          category: (CATEGORIES.includes(c.category) ? c.category : 'other') as Category,
          why: c.why,
          paypal_evidence: c.paypal_evidence,
          fit_score: c.fit_score,
          legitimacy_hint: c.legitimacy_hint,
          country_note: c.country_note,
          query: page.query,
          found_at: result.ran_at,
          status: 'candidate',
        });
        result.new_candidates++;
      }
    } catch (e: any) {
      console.warn(`[discover] triage failed for batch ${i}: ${e.message ?? e}`);
    }
  }
  await store.saveCandidates(out);
  result.brave_queries_used = braveQueriesUsed();
  console.log(`[discover] done: ${result.new_candidates} new candidates, brave queries used: ${result.brave_queries_used}`);
  return result;
}

/** Approve a candidate: it becomes a real Source and gets crawled on the next run. */
export async function approveCandidate(id: string): Promise<Source | null> {
  const cands = await store.getCandidates();
  const c = cands.find((x) => x.id === id);
  if (!c) return null;
  const sources = await store.getSources();
  const sid = hostOf(c.url).replace(/\./g, '-');
  const src: Source = {
    id: sid,
    name: c.name,
    url: c.url,
    category: c.category,
    parse_hint: `Discovered: ${c.why}. PayPal evidence: ${c.paypal_evidence}`,
    trust_baseline: Math.max(40, Math.min(80, c.legitimacy_hint)),
    enabled: true,
  };
  if (!sources.some((s) => s.id === sid)) await store.saveSources([...sources, src]);
  await store.saveCandidates(cands.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)));
  return src;
}

export async function rejectCandidate(id: string): Promise<void> {
  const cands = await store.getCandidates();
  await store.saveCandidates(cands.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)));
}

const BLOCKED_HOSTS = ['reddit.com', 'quora.com', 'medium.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'pinterest.com', 'wikipedia.org', 'linkedin.com', 'tiktok.com', 'instagram.com', 'amazon.com', 'note.com', 'ameblo.jp', 'hatenablog.com', 'qiita.com'];

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
