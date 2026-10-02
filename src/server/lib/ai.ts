// AI steps that run inside the API server: payment matching, profile parsing, plan explanation.
import { config } from './config.js';
import { llmAvailable, structured, text } from './llm.js';
import type { Opportunity, Payment, UserProfile, WeeklyPlan } from '../../shared/types.js';

/** Match incoming PayPal payments to opportunities. Falls back to heuristics without an API key. */
export async function matchPayments(payments: Payment[], opportunities: Opportunity[]): Promise<Payment[]> {
  const pending = payments.filter((p) => p.match_status === 'unmatched');
  if (!pending.length) return payments;

  if (!llmAvailable()) return payments.map((p) => (p.match_status === 'unmatched' ? heuristicMatch(p, opportunities) : p));

  const catalog = opportunities.map((o) => ({ id: o.id, name: o.name, provider: o.provider, url: o.url }));
  const result = await structured<{ matches: { transaction_id: string; opportunity_id: string | null; confidence: number; reason: string }[] }>({
    model: config.models.match,
    system:
      'You reconcile incoming PayPal payments with a catalog of earning platforms. Payer names are often legal entities or payment processors that differ from the brand (e.g. "Maxflow Technologies B.V." pays for CrazyGames). Use payer name, email domain, note and subject. Return null when nothing fits. Confidence is 0-1.',
    user: JSON.stringify({ payments: pending.map(({ transaction_id, amount, currency, payer_name, payer_email, note, subject }) => ({ transaction_id, amount, currency, payer_name, payer_email, note, subject })), catalog }),
    toolName: 'report_matches',
    description: 'Report the best opportunity match for each payment.',
    schema: {
      type: 'object',
      required: ['matches'],
      properties: {
        matches: {
          type: 'array',
          items: {
            type: 'object',
            required: ['transaction_id', 'opportunity_id', 'confidence', 'reason'],
            properties: {
              transaction_id: { type: 'string' },
              opportunity_id: { type: ['string', 'null'] },
              confidence: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  });
  const byId = new Map(result.matches.map((m) => [m.transaction_id, m]));
  return payments.map((p) => {
    if (p.match_status !== 'unmatched') return p;
    const m = byId.get(p.transaction_id);
    if (!m || !m.opportunity_id) return p;
    return {
      ...p,
      matched_opportunity_id: m.opportunity_id,
      match_confidence: m.confidence,
      match_reason: m.reason,
      match_status: m.confidence >= 0.7 ? 'auto' : 'unmatched',
    };
  });
}

function heuristicMatch(p: Payment, opportunities: Opportunity[]): Payment {
  const hay = `${p.payer_name} ${p.payer_email} ${p.note} ${p.subject}`.toLowerCase();
  const hit = opportunities.find((o) => hay.includes(o.provider.toLowerCase()) || hay.includes(o.name.toLowerCase()));
  if (!hit) return p;
  return { ...p, matched_opportunity_id: hit.id, match_confidence: 0.6, match_reason: 'keyword match (no LLM)', match_status: 'unmatched' };
}

/** Fill skills / hours from free text. */
export async function enrichProfile(profile: UserProfile): Promise<UserProfile> {
  if (!llmAvailable() || !profile.free_text.trim()) return profile;
  const r = await structured<{ skills: string[]; hours_per_week: number | null }>({
    model: config.models.extract,
    system:
      'Extract a normalized skill list (snake_case tokens such as html5_game_dev, web_dev, security, writing, design, audio, video, 3d, data, english) and weekly available hours from a short self-description. Keep skills the user already listed.',
    user: JSON.stringify({ free_text: profile.free_text, existing_skills: profile.skills, hours_per_week: profile.hours_per_week }),
    toolName: 'set_profile',
    description: 'Set normalized profile fields.',
    schema: {
      type: 'object',
      required: ['skills', 'hours_per_week'],
      properties: { skills: { type: 'array', items: { type: 'string' } }, hours_per_week: { type: ['number', 'null'] } },
    },
  });
  return { ...profile, skills: Array.from(new Set([...profile.skills, ...r.skills])), hours_per_week: r.hours_per_week ?? profile.hours_per_week };
}

/** Write the plan summary and per-item "why / first step" in English. */
export async function explainPlan(plan: WeeklyPlan, profile: UserProfile, opportunities: Opportunity[]): Promise<WeeklyPlan> {
  if (!llmAvailable() || !plan.items.length) return { ...plan, summary: plan.summary || defaultSummary(plan) };
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const r = await structured<{ summary: string; items: { opportunity_id: string; why: string; first_step: string }[] }>({
    model: config.models.explain,
    system:
      'You are a concise financial-ops assistant for independent creators. Given a weekly earning plan, write a 2-sentence summary and, for each item, one sentence on why it fits this user and one concrete first step. Plain English, no hype.',
    user: JSON.stringify({
      profile: { country: profile.country, skills: profile.skills, hours_per_week: profile.hours_per_week, free_text: profile.free_text },
      items: plan.items.map((i) => ({ ...i, opportunity: pick(byId.get(i.opportunity_id)) })),
    }),
    toolName: 'explain_plan',
    description: 'Return explanations for the weekly plan.',
    schema: {
      type: 'object',
      required: ['summary', 'items'],
      properties: {
        summary: { type: 'string' },
        items: {
          type: 'array',
          items: { type: 'object', required: ['opportunity_id', 'why', 'first_step'], properties: { opportunity_id: { type: 'string' }, why: { type: 'string' }, first_step: { type: 'string' } } },
        },
      },
    },
  });
  const m = new Map(r.items.map((i) => [i.opportunity_id, i]));
  return { ...plan, summary: r.summary, items: plan.items.map((i) => ({ ...i, ...(m.get(i.opportunity_id) ?? {}) })) };
}

const pick = (o?: Opportunity) =>
  o && { name: o.name, provider: o.provider, category: o.category, url: o.url, min_payout: o.min_payout, payout_cycle: o.payout_cycle, requirements: o.requirements, skills_required: o.skills_required };

const defaultSummary = (p: WeeklyPlan) =>
  `${p.items.length} opportunities fit your ${p.hours_budget}h/week budget, using ${p.hours_used}h for an expected ~$${p.expected_usd}.`;

/** Format a plan summary for API consumers without an LLM. */
export const planText = (p: WeeklyPlan) => (p.summary ? p.summary : defaultSummary(p));

export { text as _llmText };
