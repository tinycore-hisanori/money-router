import { Hono } from 'hono';
import { store } from '../lib/storage.js';
import { buildWeeklyPlan, routeAll } from '../lib/route-engine.js';
import { enrichProfile, explainPlan, matchPayments } from '../lib/ai.js';
import { createInvoiceDraft, getInvoice, listIncomingTransactions, paypalAvailable, sendInvoice } from '../lib/paypal.js';
import { llmAvailable } from '../lib/llm.js';
import { config } from '../lib/config.js';
import type { ExecutionStatus, Opportunity, Payment, UserProfile } from '../../shared/types.js';

export const api = new Hono();

api.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

// ---- status / capabilities
api.get('/status', async (c) => {
  const crawl = await store.getCrawlStatus();
  return c.json({
    crawl,
    capabilities: { llm: llmAvailable(), paypal: paypalAvailable() },
    models: config.models,
    audit_schedule: config.auditSchedule,
  });
});

// ---- opportunities (raw, with execution state merged)
api.get('/opportunities', async (c) => {
  const [list, exec] = await Promise.all([store.getOpportunities(), store.getExecution()]);
  return c.json(list.map((o) => ({ ...o, execution: exec[o.id] ?? null })));
});

// ---- routed view for the current profile
api.get('/route', async (c) => {
  const [list, profile, exec] = await Promise.all([store.getOpportunities(), store.getProfile(), store.getExecution()]);
  return c.json(routeAll(list, profile, exec).map((r) => ({ ...r, execution: exec[r.opportunity.id] ?? null })));
});

// ---- weekly plan
api.get('/plan', async (c) => {
  const explain = c.req.query('explain') === '1';
  const [list, profile, exec] = await Promise.all([store.getOpportunities(), store.getProfile(), store.getExecution()]);
  let plan = buildWeeklyPlan(routeAll(list, profile, exec), profile, exec);
  if (explain) plan = await explainPlan(plan, profile, list);
  return c.json(plan);
});

// ---- profile
api.get('/profile', async (c) => c.json(await store.getProfile()));
api.put('/profile', async (c) => {
  const body = (await c.req.json()) as Partial<UserProfile> & { enrich?: boolean };
  const current = await store.getProfile();
  let next: UserProfile = {
    ...current,
    ...body,
    country: (body.country ?? current.country).toUpperCase(),
    skills: (body.skills ?? current.skills).map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
  delete (next as any).enrich;
  if (body.enrich) next = await enrichProfile(next);
  await store.saveProfile(next);
  return c.json(next);
});

// ---- execution status per opportunity
api.put('/execution/:id', async (c) => {
  const id = c.req.param('id');
  const { status } = (await c.req.json()) as { status: ExecutionStatus | null };
  const exec = await store.getExecution();
  if (status) exec[id] = status;
  else delete exec[id];
  await store.saveExecution(exec);
  return c.json({ id, status: exec[id] ?? null });
});

// ---- PayPal: sync incoming payments and match to opportunities
api.post('/paypal/sync', async (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const [existing, list] = await Promise.all([store.getPayments(), store.getOpportunities()]);
  const known = new Map(existing.map((p) => [p.transaction_id, p]));
  const fresh = await listIncomingTransactions(days);
  for (const p of fresh) if (!known.has(p.transaction_id)) known.set(p.transaction_id, p);
  const matched = await matchPayments([...known.values()], list);
  await store.savePayments(matched);
  await store.saveOpportunities(applyObserved(list, matched));
  return c.json({ fetched: fresh.length, total: matched.length, matched: matched.filter((p) => p.matched_opportunity_id).length });
});

api.get('/payments', async (c) => c.json(await store.getPayments()));

// confirm / reject / set a match manually
api.put('/payments/:tx', async (c) => {
  const tx = c.req.param('tx');
  const { opportunity_id, status } = (await c.req.json()) as { opportunity_id?: string | null; status: 'confirmed' | 'rejected' };
  const [payments, list] = await Promise.all([store.getPayments(), store.getOpportunities()]);
  const next = payments.map((p) => {
    if (p.transaction_id !== tx) return p;
    if (status === 'rejected') return { ...p, matched_opportunity_id: null, match_status: 'rejected' as const };
    return { ...p, matched_opportunity_id: opportunity_id ?? p.matched_opportunity_id, match_status: 'confirmed' as const, match_confidence: 1 };
  });
  await store.savePayments(next);
  await store.saveOpportunities(applyObserved(list, next));
  return c.json(next.find((p) => p.transaction_id === tx));
});

// ---- PayPal Invoicing
api.post('/paypal/invoice', async (c) => {
  const body = await c.req.json();
  const draft = await createInvoiceDraft(body);
  return c.json(draft);
});
api.post('/paypal/invoice/:id/send', async (c) => {
  await sendInvoice(c.req.param('id'));
  return c.json({ ok: true });
});
api.get('/paypal/invoice/:id', async (c) => c.json(await getInvoice(c.req.param('id'))));

/** Recompute observed stats from confirmed/auto matches. */
function applyObserved(list: Opportunity[], payments: Payment[]): Opportunity[] {
  const agg = new Map<string, Payment[]>();
  for (const p of payments) {
    if (!p.matched_opportunity_id || p.match_status === 'rejected') continue;
    agg.set(p.matched_opportunity_id, [...(agg.get(p.matched_opportunity_id) ?? []), p]);
  }
  return list.map((o) => {
    const ps = agg.get(o.id) ?? [];
    if (!ps.length) return { ...o, observed: { total_received_usd: 0, payments_count: 0, avg_days_to_payout: null, last_payment_at: null } };
    const last = ps.map((p) => p.date).sort().at(-1) ?? null;
    return {
      ...o,
      observed: {
        total_received_usd: Math.round(ps.reduce((s, p) => s + p.amount, 0) * 100) / 100,
        payments_count: ps.length,
        avg_days_to_payout: o.observed.avg_days_to_payout,
        last_payment_at: last,
      },
    };
  });
}

// ---- manual crawl trigger (protected by CRAWL_TOKEN when set)
api.post('/crawl', async (c) => {
  if (config.crawler.token && c.req.query('token') !== config.crawler.token) return c.json({ error: 'forbidden' }, 403);
  const { runCrawl } = await import('../../crawler/index.js');
  return c.json(await runCrawl());
});
