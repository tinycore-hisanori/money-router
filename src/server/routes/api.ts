import { Hono } from 'hono';
import { store, userStore } from '../lib/storage.js';
import { buildWeeklyPlan, routeAll } from '../lib/route-engine.js';
import { enrichProfile, explainPlan, matchPayments } from '../lib/ai.js';
import { createInvoiceDraft, getInvoice, listIncomingTransactions, paypalAvailable, sendInvoice } from '../lib/paypal.js';
import { llmAvailable } from '../lib/llm.js';
import { config } from '../lib/config.js';
import { canCurate, canWrite, consume, isAdmin, remaining, tierOf, userOf } from '../lib/guard.js';

/** The caller's own profile / picks / notes. */
const us = (c: any) => userStore(userOf(c));
import { getJob, runningJobs, startJob } from '../lib/jobs.js';
import VERSION from '../../shared/version.json' with { type: 'json' };
import type { ExecutionStatus, Opportunity, OpportunityNote, Payment, UserProfile } from '../../shared/types.js';

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
    admin: isAdmin(c),
    tier: tierOf(c),
    user: userOf(c),
    can_write: canWrite(c),
    demo: { discovery: await remaining(c, 'discovery'), briefs: await remaining(c, 'briefs'), crawls: await remaining(c, 'crawls') },
    models: config.models,
    audit_schedule: config.auditSchedule,
    running: runningJobs(),
    version: VERSION,
  });
});

// ---- opportunities (raw, with execution state merged)
api.get('/opportunities', async (c) => {
  const [list, exec] = await Promise.all([store.getOpportunities(), us(c).getExecution()]);
  return c.json(list.map((o) => ({ ...o, execution: exec[o.id] ?? null })));
});

// ---- routed view for the current profile
api.get('/route', async (c) => {
  const [list, profile, exec, notes] = await Promise.all([store.getOpportunities(), us(c).getProfile(), us(c).getExecution(), us(c).getNotes()]);
  return c.json(routeAll(list, profile, exec).map((r) => ({ ...r, execution: exec[r.opportunity.id] ?? null, note: notes[r.opportunity.id] ?? null })));
});

// ---- per-opportunity memo (idea = what to submit, note = free text)
api.get('/notes/:id', async (c) => c.json((await us(c).getNotes())[c.req.param('id')] ?? null));
api.put('/notes/:id', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const id = c.req.param('id');
  const body = (await c.req.json()) as Partial<OpportunityNote>;
  const notes = await us(c).getNotes();
  const next: OpportunityNote = { idea: (body.idea ?? notes[id]?.idea ?? '').trim(), note: (body.note ?? notes[id]?.note ?? '').trim(), updated_at: new Date().toISOString() };
  if (!next.idea && !next.note) delete notes[id];
  else notes[id] = next;
  await us(c).saveNotes(notes);
  return c.json(notes[id] ?? null);
});

// ---- weekly plan
api.get('/plan', async (c) => {
  const explain = c.req.query('explain') === '1';
  const [list, profile, exec] = await Promise.all([store.getOpportunities(), us(c).getProfile(), us(c).getExecution()]);
  let plan = buildWeeklyPlan(routeAll(list, profile, exec), profile, exec);
  if (explain) plan = await explainPlan(plan, profile, list);
  return c.json(plan);
});

// ---- profile
api.get('/profile', async (c) => c.json(await us(c).getProfile()));
api.put('/profile', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const body = (await c.req.json()) as Partial<UserProfile> & { enrich?: boolean };
  const current = await us(c).getProfile();
  let next: UserProfile = {
    ...current,
    ...body,
    country: (body.country ?? current.country).toUpperCase(),
    language: (body.language ?? current.language ?? 'ja').toLowerCase(),
    skills: (body.skills ?? current.skills).map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
  delete (next as any).enrich;
  if (body.enrich) next = await enrichProfile(next);
  await us(c).saveProfile(next);
  return c.json(next);
});

// ---- execution status per opportunity
api.put('/execution/:id', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const id = c.req.param('id');
  const { status } = (await c.req.json()) as { status: ExecutionStatus | null };
  const exec = await us(c).getExecution();
  if (status) exec[id] = status;
  else delete exec[id];
  await us(c).saveExecution(exec);
  return c.json({ id, status: exec[id] ?? null });
});

// ---- PayPal: sync incoming payments and match to opportunities
api.post('/paypal/sync', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const days = Number(c.req.query('days') ?? 30);
  const [existing, list, exec] = await Promise.all([store.getPayments(), store.getOpportunities(), us(c).getExecution()]);
  const known = new Map(existing.map((p) => [p.transaction_id, p]));
  const fresh = await listIncomingTransactions(days);
  for (const p of fresh) if (!known.has(p.transaction_id)) known.set(p.transaction_id, p);
  const awaiting = new Set(Object.entries(exec).filter(([, s]) => s === 'won' || s === 'submitted').map(([id]) => id));
  const matched = await matchPayments([...known.values()], list, awaiting);
  await store.savePayments(matched);
  await store.saveOpportunities(applyObserved(list, matched));
  const paid_marked = await markPaid(c, matched);
  return c.json({ fetched: fresh.length, total: matched.length, matched: matched.filter((p) => p.matched_opportunity_id).length, paid_marked });
});

api.get('/payments', async (c) => c.json(await store.getPayments()));

// confirm / reject / set a match manually
api.put('/payments/:tx', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
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
  await markPaid(c, next);
  return c.json(next.find((p) => p.transaction_id === tx));
});

// ---- PayPal Invoicing
api.post('/paypal/invoice', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const body = await c.req.json();
  const draft = await createInvoiceDraft(body);
  return c.json(draft);
});
api.post('/paypal/invoice/:id/send', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  await sendInvoice(c.req.param('id'));
  return c.json({ ok: true });
});
api.get('/paypal/invoice/:id', async (c) => c.json(await getInvoice(c.req.param('id'))));

/** A PayPal payment matched to something you won or submitted means it was paid: move it to "paid". */
async function markPaid(c: any, payments: Payment[]): Promise<number> {
  const exec = await us(c).getExecution();
  let n = 0;
  for (const p of payments) {
    const id = p.matched_opportunity_id;
    if (!id || p.match_status === 'rejected') continue;
    if (exec[id] === 'won' || exec[id] === 'submitted') { exec[id] = 'paid'; n++; }
  }
  if (n) await us(c).saveExecution(exec);
  return n;
}

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
      // Verified money resolves the "no payout history" doubt for this opportunity.
      findings: (o.findings ?? []).filter((f) => f.code !== 'no_payout_history'),
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
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  if (config.crawler.token && c.req.query('token') !== config.crawler.token && !isAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const denied = await consume(c, 'crawls');
  if (denied) return c.json(denied, 429);
  const { runCrawl } = await import('../../crawler/index.js');
  if (c.req.query('wait') === '1') return c.json(await runCrawl());
  return c.json(startJob('crawl', runCrawl), 202);
});

// ---- job polling (long-running actions return 202 + job; UI polls here)
api.get('/jobs/:id', (c) => {
  const j = getJob(c.req.param('id'));
  return j ? c.json(j) : c.json({ error: 'not found' }, 404);
});

// ---- on-demand localized brief for one opportunity (for languages not pre-generated)
api.post('/opportunities/:id/localize', async (c) => {
  const id = c.req.param('id');
  const lang = (c.req.query('lang') ?? 'ja').toLowerCase();
  const list = await store.getOpportunities();
  const o = list.find((x) => x.id === id);
  if (!o) return c.json({ error: 'not found' }, 404);
  if (o.localized?.[lang]) return c.json(o.localized[lang]);
  const denied = await consume(c, 'briefs');
  if (denied) return c.json(denied, 429);
  const { localizeOpportunity } = await import('../../crawler/localize.js');
  const l = await localizeOpportunity(o, [lang]);
  await store.saveOpportunities(list.map((x) => (x.id === id ? { ...x, localized: { ...(x.localized ?? {}), ...l } } : x)));
  return c.json(l[lang] ?? null);
});

// ---- Source Discovery (AI finds new PayPal-paying sources for this profile; human approves)
api.post('/discover', async (c) => {
  const denied = await consume(c, 'discovery');
  if (denied) return c.json(denied, 429);
  const { runDiscovery } = await import('../../crawler/discover.js');
  const max = Number(c.req.query('max') ?? 12);
  return c.json(startJob('discover', () => runDiscovery({ maxQueries: max })), 202);
});
api.post('/radar', async (c) => {
  if (!canWrite(c)) return c.json({ error: 'key_required' }, 403);
  const denied = await consume(c, 'discovery');
  if (denied) return c.json(denied, 429);
  const { runRadar } = await import('../../crawler/radar.js');
  const max = Number(c.req.query('max') ?? 10);
  return c.json(startJob('radar', () => runRadar({ maxQueries: max })), 202);
});
api.get('/candidates', async (c) => c.json(await store.getCandidates()));
api.post('/candidates/:id/approve', async (c) => {
  if (!canCurate(c)) return c.json({ error: 'admin_only' }, 403);
  const { approveCandidate } = await import('../../crawler/discover.js');
  const src = await approveCandidate(c.req.param('id'));
  return src ? c.json(src) : c.json({ error: 'not found' }, 404);
});
api.post('/candidates/:id/reject', async (c) => {
  if (!canCurate(c)) return c.json({ error: 'admin_only' }, 403);
  const { rejectCandidate } = await import('../../crawler/discover.js');
  await rejectCandidate(c.req.param('id'));
  return c.json({ ok: true });
});
api.get('/sources', async (c) => c.json(await store.getSources()));
