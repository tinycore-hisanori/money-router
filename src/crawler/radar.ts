// Event Radar: find one-off, irregular, anywhere-in-the-world events that pay money
// (contests, hackathons, game jams, bounties, limited promos) — the "stray" opportunities
// a platform registry never catches. Searches recent pages in several languages, pulls the
// official rules, extracts deadline / prize / eligibility, and registers them as opportunities
// under source_id "radar". They expire by deadline. No approval gate: nothing is paid out by the
// user, so legitimacy score + eligibility warning are enough.
import crypto from 'node:crypto';
import { auditPlanFor, config } from '../server/lib/config.js';
import { structured } from '../server/lib/llm.js';
import { store } from '../server/lib/storage.js';
import { braveSearch, braveQueriesUsed, resetBraveBudget } from './search.js';
import { fetchPageText } from './fetch.js';
import { extractOpportunities } from './extract.js';
import { auditOpportunity } from './audit.js';
import { localizeOpportunity } from './localize.js';
import type { Opportunity, Source, UserProfile } from '../shared/types.js';

const RADAR_SOURCE: Source = { id: 'radar', name: 'Event Radar', url: 'https://example.invalid/radar', category: 'contest', trust_baseline: 50, enabled: true, parse_hint: 'One-off event found by search. Extract ONE opportunity for the event on this page: deadline, prize, eligibility (quote rules).' };

const BLOCKED = ['reddit.com', 'quora.com', 'medium.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'pinterest.com', 'wikipedia.org', 'linkedin.com', 'tiktok.com', 'instagram.com', 'note.com', 'ameblo.jp', 'hatenablog.com', 'qiita.com', 'zenn.dev', 'prtimes.jp'];

async function planEventQueries(profile: UserProfile, max: number) {
  const r = await structured<{ queries: { query: string; lang: string; rationale: string }[] }>({
    model: config.models.explain,
    system: `You design web-search queries to find ONE-OFF, RECENTLY ANNOUNCED events where a specific person can win or earn money: hackathons, developer/game contests, game jams with cash prizes, creator challenges, bounty programs with deadlines, limited-time promotions. The money should be payable internationally (PayPal, wire) — prefer events open worldwide or to the person's country.
Rules:
- Target announcement pages and official event pages, not listicles. Use words like "2026", "prize", "deadline", "submissions open", "賞金", "募集", "締切", "공모전", "상금", "海选", "奖金".
- Spread queries across languages: English, the person's language, and at least Korean and Chinese (big game/dev contest ecosystems that rarely reach English media).
- Match the person's skills (e.g. HTML5 games, Unity, web) and avoid generic "make money" phrasing.
- Return at most ${max} queries with the BCP-47 search language code for each (en, ja, ko, zh-hans ...).`,
    user: JSON.stringify({ profile: { country: profile.country, language: profile.language, skills: profile.skills, free_text: profile.free_text }, today: new Date().toISOString().slice(0, 10) }),
    schema: { type: 'object', properties: { queries: { type: 'array', items: { type: 'object', properties: { query: { type: 'string' }, lang: { type: 'string' }, rationale: { type: 'string' } } } } } },
  });
  return r.queries.slice(0, max);
}

export interface RadarResult { ran_at: string; queries: { query: string; lang: string; hits: number }[]; pages: number; added: number; updated: number; expired: number; brave_queries_used: number }

export async function runRadar(opts: { maxQueries?: number; perQuery?: number } = {}): Promise<RadarResult> {
  const maxQueries = Math.min(opts.maxQueries ?? 10, config.brave.maxQueriesPerRun);
  const perQuery = opts.perQuery ?? 5;
  const profile = await store.getProfile();
  const existing = await store.getOpportunities();
  const plan = auditPlanFor();
  resetBraveBudget();

  const result: RadarResult = { ran_at: new Date().toISOString(), queries: [], pages: 0, added: 0, updated: 0, expired: 0, brave_queries_used: 0 };
  const byId = new Map(existing.map((o) => [o.id, o]));
  const seenHosts = new Set<string>();

  const queries = await planEventQueries(profile, maxQueries);
  for (const q of queries) {
    const hits = await braveSearch(q.query, perQuery, { freshness: 'pm', lang: q.lang.split('-')[0] });
    result.queries.push({ query: q.query, lang: q.lang, hits: hits.length });
    for (const h of hits) {
      const host = hostOf(h.url);
      if (!host || BLOCKED.some((b) => host.endsWith(b)) || seenHosts.has(host + h.url)) continue;
      seenHosts.add(host + h.url);
      let text: string;
      try {
        text = await fetchPageText(h.url, 25_000);
      } catch {
        continue;
      }
      // Rules page on the same host (eligibility!)
      const rules = await braveSearch(`official rules eligibility OR 応募資格 OR 참가 자격 OR 参赛资格 site:${host}`, 3);
      for (const r of rules.slice(0, 2)) {
        try {
          const rt = await fetchPageText(r.url, 15_000);
          if (/eligib|resident|citizen|応募資格|参加資格|참가|资格|void where prohibited/i.test(rt)) { text += `\n\n---- OFFICIAL RULES / ELIGIBILITY (${r.url}) ----\n${rt}`; break; }
        } catch { /* skip */ }
      }
      result.pages++;
      try {
        const ex = await extractOpportunities({ ...RADAR_SOURCE, url: h.url, name: h.title.slice(0, 80) }, text, 0.8);
        for (const o of ex.opportunities) {
          if (o.category !== 'contest' && o.certainty !== 'fixed') continue; // radar is for events/prizes only
          if (o.deadline && new Date(o.deadline).getTime() < Date.now() - 86_400_000) continue; // already over
          const id = `radar:${crypto.createHash('sha1').update(h.url).digest('hex').slice(0, 10)}`;
          const prev = byId.get(id);
          const audited: Opportunity = { ...o, id, source_id: 'radar', url: h.url, legitimacy: prev?.legitimacy.mode === 'full' ? prev.legitimacy : await auditOpportunity({ ...o, id, source_id: 'radar' }, RADAR_SOURCE, plan) };
          try { audited.localized = { ...(prev?.localized ?? {}), ...(await localizeOpportunity(audited)) }; } catch { /* optional */ }
          byId.set(id, { ...audited, observed: prev?.observed ?? audited.observed });
          prev ? result.updated++ : result.added++;
        }
      } catch (e: any) {
        console.warn(`[radar] extract failed for ${h.url}: ${e.message ?? e}`);
      }
    }
  }

  // Expire past-deadline radar items
  for (const o of byId.values()) {
    if (o.source_id === 'radar' && o.deadline && new Date(o.deadline).getTime() < Date.now() - 86_400_000 && o.status === 'active') {
      byId.set(o.id, { ...o, status: 'closed' });
      result.expired++;
    }
  }

  await store.saveOpportunities([...byId.values()]);
  result.brave_queries_used = braveQueriesUsed();
  console.log(`[radar] ${queries.length} queries, ${result.pages} pages, +${result.added} new, ~${result.updated} updated, ${result.expired} expired, brave ${result.brave_queries_used}`);
  return result;
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
