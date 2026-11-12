// Crawler pipeline. Invoked by `npm run crawl` (CLI), the in-process daily scheduler, or POST /api/crawl.
// Pipeline per source: fetch -> hash diff -> extract (LLM) -> audit (LLM, per AUDIT_SCHEDULE) -> merge.
import crypto from 'node:crypto';
import { auditPlanFor, config } from '../server/lib/config.js';
import { store } from '../server/lib/storage.js';
import { llmAvailable } from '../server/lib/llm.js';
import { acquireSourceText } from './fetch.js';
import { braveQueriesUsed, resetBraveBudget } from './search.js';
import { extractOpportunities, normUrl } from './extract.js';
import { auditOpportunity } from './audit.js';
import { localizeOpportunity } from './localize.js';
import type { CrawlStatus, Opportunity, Source } from '../shared/types.js';

export async function runCrawl(): Promise<CrawlStatus> {
  const started = new Date();
  const plan = auditPlanFor(started);
  const sources = (await store.getSources()).filter((s) => s.enabled);
  const existing = await store.getOpportunities();
  const hashes = await store.getPageHashes();
  // User state keyed by opportunity id: must follow an opportunity when the crawler re-keys it.
  const exec = await store.getExecution();
  const notes = await store.getNotes();
  const payments = await store.getPayments();
  let stateMoved = false;
  const status: CrawlStatus = {
    last_run: started.toISOString(),
    mode: config.crawler.mode,
    audit_model: plan.model,
    audit_mode: plan.mode,
    sources: {},
    totals: { opportunities: 0, active: 0, rejected_no_paypal: 0 },
  };

  console.log(`[crawl] ${sources.length} sources, mode=${config.crawler.mode}, audit=${plan.model}/${plan.mode}`);
  resetBraveBudget();

  if (config.crawler.mode === 'mock' || !llmAvailable()) {
    if (config.crawler.mode !== 'mock') console.warn('[crawl] ANTHROPIC_API_KEY missing -> falling back to mock');
    // Mock: keep seed data, just refresh timestamps so the UI shows a run.
    const list = existing.map((o) => ({ ...o, last_checked: started.toISOString() }));
    for (const s of sources)
      status.sources[s.id] = { ok: true, fetched_at: started.toISOString(), changed: false, opportunities: list.filter((o) => o.source_id === s.id).length };
    await finish(list, status, hashes);
    return status;
  }

  const byId = new Map(existing.map((o) => [o.id, o]));

  for (const s of sources) {
    const fetched_at = new Date().toISOString();
    try {
      const page = await acquireSourceText(s);
      const textBody = page.text;
      const hash = crypto.createHash('sha256').update(textBody).digest('hex');
      let fromSource = existing.filter((o) => o.source_id === s.id);
      let rejected: { name: string; reason: string }[] = [];
      // Re-extract when the page changed, or when we have nothing for this source yet
      // (a source with zero kept rows must never be skipped on a stale hash).
      const changed = hashes[s.id] !== hash || fromSource.length === 0;

      if (changed) {
        const extracted = await extractOpportunities(s, textBody, page.via === 'search_snippets' ? 0.5 : 1);
        status.totals.rejected_no_paypal += extracted.rejected_no_paypal;
        rejected = extracted.rejected;
        fromSource = extracted.opportunities.map((o) => mergeWithExisting(o, byId.get(o.id), fetched_at));
        // Live data supersedes seed/mock rows and stale rows for this source. Rows with verified
        // payments are kept but marked closed so their history survives.
        const keep = new Set(fromSource.map((o) => o.id));
        const claimed = new Set<string>();
        for (const old of existing.filter((o) => o.source_id === s.id && !keep.has(o.id))) {
          const hasState = !!exec[old.id] || !!notes[old.id] || old.observed.payments_count > 0;
          if (!hasState) { byId.delete(old.id); continue; }
          // Same opportunity under a new id (reworded name)? Move the user's state onto it.
          const free = fromSource.filter((n) => !claimed.has(n.id) && !exec[n.id] && !notes[n.id]);
          const succ = successor(old, free, fromSource.length);
          if (succ) {
            claimed.add(succ.id);
            if (exec[old.id]) { exec[succ.id] = exec[old.id]; delete exec[old.id]; }
            if (notes[old.id]) { notes[succ.id] = notes[old.id]; delete notes[old.id]; }
            for (const p of payments) if (p.matched_opportunity_id === old.id) p.matched_opportunity_id = succ.id;
            const i = fromSource.findIndex((n) => n.id === succ.id);
            if (old.observed.payments_count > 0 && fromSource[i].observed.payments_count === 0) fromSource[i] = { ...fromSource[i], observed: old.observed };
            byId.delete(old.id);
            stateMoved = true;
            console.log(`[crawl] ${s.id}: kept your status/notes: ${old.id} -> ${succ.id}`);
          } else {
            // Gone from the source (e.g. a closed hackathon) but you picked / submitted / were paid for it: keep it.
            byId.set(old.id, { ...old, status: 'closed' });
          }
        }
      } else if (fromSource.some((o) => o.legitimacy.mode !== 'seed')) {
        // Unchanged page but leftover seed rows from before the first live run: drop them.
        for (const o of fromSource.filter((o) => o.legitimacy.mode === 'seed')) byId.delete(o.id);
        fromSource = fromSource.filter((o) => o.legitimacy.mode !== 'seed');
      }

      // Audit: full mode re-scores everything; diff mode only what changed / never scored.
      for (let i = 0; i < fromSource.length; i++) {
        const o = fromSource[i];
        const needs = plan.mode === 'full' || changed || o.legitimacy.mode === 'seed';
        if (!needs) continue;
        fromSource[i] = { ...o, legitimacy: await auditOpportunity(o, s, plan) };
      }

      // Localized briefs for anything new/changed or missing a configured locale.
      for (let i = 0; i < fromSource.length; i++) {
        const o = fromSource[i];
        const missing = config.locales.some((l) => !o.localized?.[l]);
        if (!changed && !missing) continue;
        try {
          fromSource[i] = { ...o, localized: { ...(o.localized ?? {}), ...(await localizeOpportunity(o)) } };
        } catch (e: any) {
          console.warn(`[crawl] localize failed for ${o.id}: ${e.message ?? e}`);
        }
      }

      for (const o of fromSource) byId.set(o.id, { ...o, last_checked: fetched_at, content_hash: hash });
      hashes[s.id] = hash; // commit only after extraction + audit succeeded
      status.sources[s.id] = { ok: true, fetched_at, changed, opportunities: fromSource.length, via: page.via, url: page.url, rejected };
      console.log(`[crawl] ${s.id}: ${changed ? 'changed' : 'unchanged'} (${page.via}), ${fromSource.length} opportunities`);
    } catch (e: any) {
      status.sources[s.id] = { ok: false, fetched_at, changed: false, opportunities: 0, error: String(e.message ?? e) };
      console.error(`[crawl] ${s.id} failed:`, e.message ?? e);
    }
  }

  if (stateMoved) await Promise.all([store.saveExecution(exec), store.saveNotes(notes), store.savePayments(payments)]);
  await finish([...byId.values()], status, hashes);
  return status;
}

/** Find the re-keyed version of an opportunity: same URL, the only item of a one-item source, or a close name. */
export function successor(old: Opportunity, candidates: Opportunity[], sourceSize: number): Opportunity | undefined {
  const u = normUrl(old.url);
  const byUrl = candidates.filter((n) => normUrl(n.url) === u);
  if (byUrl.length === 1) return byUrl[0];
  if (sourceSize === 1 && candidates.length === 1) return candidates[0];
  const tok = (x: string) => new Set(x.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const a = tok(old.name);
  let best: Opportunity | undefined, bestScore = 0;
  for (const n of byUrl.length ? byUrl : candidates) {
    const b = tok(n.name);
    const inter = [...a].filter((w) => b.has(w)).length;
    const score = inter / Math.max(1, new Set([...a, ...b]).size);
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return bestScore >= 0.5 ? best : undefined;
}

function mergeWithExisting(fresh: Opportunity, prev: Opportunity | undefined, now: string): Opportunity {
  if (!prev) return { ...fresh, last_checked: now };
  // Keep observed stats and the last legitimacy verdict; take new terms from the page.
  return { ...fresh, observed: prev.observed, legitimacy: prev.legitimacy, last_checked: now };
}

async function finish(list: Opportunity[], status: CrawlStatus, hashes: Record<string, string>) {
  status.totals.opportunities = list.length;
  status.totals.active = list.filter((o) => o.status === 'active').length;
  await store.saveOpportunities(list);
  await store.savePageHashes(hashes);
  await store.saveCrawlStatus(status);
  console.log(`[crawl] done: ${status.totals.active}/${status.totals.opportunities} active, brave queries used: ${braveQueriesUsed()}`);
}

export type { Source };
