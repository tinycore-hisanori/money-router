import { structured } from '../server/lib/llm.js';
import type { AuditPlan } from '../server/lib/config.js';
import type { LegitimacyScore, Opportunity, Source } from '../shared/types.js';

/** Legitimacy audit: is this a real, paying, non-predatory opportunity? */
export async function auditOpportunity(o: Opportunity, source: Source, plan: AuditPlan): Promise<LegitimacyScore> {
  const r = await structured<{ score: number; notes: string; red_flags: string[] }>({
    model: plan.model,
    system: `You audit online earning opportunities for independent creators. Score 0-100 how likely this is a legitimate, actually-paying opportunity that is worth a creator's time.
Penalize: upfront fees, "guaranteed income", vague payout terms, no identifiable operating company, payout thresholds designed to be unreachable, payment-method-only pages with no terms, known scam patterns.
Reward: concrete payout terms (amount, cycle, minimum), an identifiable company, long operating history, public payout proof, clear eligibility rules.
Be calibrated: 85+ only for well-known platforms with explicit terms; 60-84 for plausible but less verified; below 60 when a creator should be cautious; below 30 when it looks like a scam.`,
    user: JSON.stringify({ source: { name: source.name, url: source.url, trust_baseline: source.trust_baseline }, opportunity: strip(o) }),
    toolName: 'report_audit',
    description: 'Report the legitimacy verdict.',
    schema: {
      type: 'object',
      required: ['score', 'notes', 'red_flags'],
      properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, notes: { type: 'string' }, red_flags: { type: 'array', items: { type: 'string' } } },
    },
  });
  const notes = r.red_flags.length ? `${r.notes} Red flags: ${r.red_flags.join('; ')}` : r.notes;
  return { score: r.score, notes, scored_by: plan.model, scored_at: new Date().toISOString(), mode: plan.mode };
}

const strip = (o: Opportunity) => {
  const { observed, legitimacy, content_hash, ...rest } = o;
  return rest;
};
