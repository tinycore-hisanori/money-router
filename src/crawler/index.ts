// Crawler pipeline. Invoked by `npm run crawl` (CLI), the in-process daily scheduler, or POST /api/crawl.
// Pipeline per source: fetch -> hash diff -> extract (LLM) -> audit (LLM, per AUDIT_SCHEDULE) -> merge.
import crypto from 'node:crypto';
import { auditPlanFor, config } from '../server/lib/config.js';
import { store } from '../server/lib/storage.js';
import { llmAvailable } from '../server/lib/llm.js';
import { acquireSourceText } from './fetch.js';
import { braveQueriesUsed, resetBraveBudget } from './search.js';
import { extractOpportunities } from './extract.js';
import { auditOpportunity } from './audit.js';
import type { CrawlStatus, Opportunity, Source } from '../shared/types.js';

export async function runCrawl(): Promise<CrawlStatus> {
  const started = new Date();
  const plan = auditPlanFor(started);
  const sources = (await store.getSources()).filter((s) => s.enabled);
  const existing = await store.getOpportunities();
  const hashes = await store.getPageHashes();
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
      const changed = hashes[s.id] !== hash;
      hashes[s.id] = hash;

      let fromSource = existing.filter((o) => o.source_id === s.id);

      if (changed) {
        const extracted = await extractOpportunities(s, textBody, page.via === 'search_snippets' ? 0.5 : 1);
        status.totals.rejected_no_paypal += extracted.rejected_no_paypal;
        fromSource = extracted.opportunities.map((o) => mergeWithExisting(o, byId.get(o.id), fetched_at));
      }

      // Audit: full mode re-scores everything; diff mode only what changed / never scored.
      for (let i = 0; i < fromSource.length; i++) {
        const o = fromSource[i];
        const needs = plan.mode === 'full' || changed || o.legitimacy.mode === 'seed';
        if (!needs) continue;
        fromSource[i] = { ...o, legitimacy: await auditOpportunity(o, s, plan) };
      }

      for (const o of fromSource) byId.set(o.id, { ...o, last_checked: fetched_at, content_hash: hash });
      status.sources[s.id] = { ok: true, fetched_at, changed, opportunities: fromSource.length, via: page.via, url: page.url };
      console.log(`[crawl] ${s.id}: ${changed ? 'changed' : 'unchanged'} (${page.via}), ${fromSource.length} opportunities`);
    } catch (e: any) {
      status.sources[s.id] = { ok: false, fetched_at, changed: false, opportunities: 0, error: String(e.message ?? e) };
      console.error(`[crawl] ${s.id} failed:`, e.message ?? e);
    }
  }

  await finish([...byId.values()], status, hashes);
  return status;
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
