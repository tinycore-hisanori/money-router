import { config } from '../server/lib/config.js';
import { structured } from '../server/lib/llm.js';
import type { Opportunity, Source } from '../shared/types.js';

interface Extracted {
  opportunities: Omit<Opportunity, 'source_id' | 'legitimacy' | 'status' | 'last_checked' | 'observed' | 'id'>[];
  rejected: { name: string; reason: string }[];
}

const CATEGORIES = ['game_portal', 'bug_bounty', 'user_testing', 'survey', 'microtask', 'stock_assets', 'freelance', 'affiliate', 'referral', 'contest', 'licensing', 'localization', 'data_collection', 'other'];

/** Page text -> structured opportunities. Only PayPal-payable ones are kept; the rest are reported as rejected. */
export async function extractOpportunities(source: Source, pageText: string, confidenceCap = 1): Promise<{ opportunities: Opportunity[]; rejected_no_paypal: number; rejected: { name: string; reason: string }[] }> {
  const r = await structured<Extracted>({
    model: config.models.extract,
    maxTokens: 8192,
    system: `You extract earning opportunities for independent creators from a platform's public page.
Rules:
- Only include an opportunity if PayPal is explicitly listed as a payout method. Put anything else in "rejected" with the reason.
- Numbers must come from the page. If a value is not on the page, use your best conservative estimate and lower "confidence".
- countries_allowed/blocked are ISO2 codes; leave empty when unknown or worldwide.
- skills_required are snake_case tokens (html5_game_dev, web_dev, security, writing, design, audio, video, 3d, data, english). Include "english" ONLY when the work itself requires producing or speaking English (transcription, tutoring, English copywriting, voice tests) — not merely because the site is written in English. Leave skills_required empty when anyone can do it.
- ELIGIBILITY IS CRITICAL. Contests, hackathons and promos often restrict by country of residence, age, or tax status in their Official Rules / Terms. Read any rules/terms text included below. Set eligibility_verified=true ONLY if you found an explicit eligibility clause, and quote it in eligibility_note. If the rules are not in the text, set eligibility_verified=false, eligibility_note="rules not found in provided text", and leave countries_allowed empty (do NOT guess).
- countries_allowed: when the rules list eligible countries, fill ISO2 codes. countries_blocked: when the rules exclude countries (e.g. "void where prohibited", sanctioned countries, "residents of X not eligible").
- findings: PAYMENT-RISK findings, separate from scam detection. Add one per signal you can evidence (quote the text):
  first_edition (caution): name contains "#1" / "1st" / "first", or no previous editions are mentioned.
  individual_host (caution): host is an individual or hobby account rather than a company/organization.
  prize_not_locked (warning): prize is a "target", "goal", "TBD", "will be confirmed/locked", "depends on sponsors", or funded by entry fees.
  eligibility_missing (warning): no eligibility clause (country / age) anywhere in the text.
  no_payout_history (caution): no evidence that past winners were paid (new host, no prior events).
  payout_complaints (warning): the COMPLAINT SEARCH section below contains credible reports of non-payment for this host.
  Use severity exactly as listed. Leave findings empty for established platforms with documented payouts.
- deadline: ISO date (YYYY-MM-DD) when submissions/applications close, for contests, hackathons, jams and limited-time promos; null when open-ended. Never invent a date.
- certainty: "fixed" when a defined action yields a defined amount (sign-up bonus, referral bonus, fixed bounty, promo, contest/hackathon prize with a stated amount); "per_task" when each completed task pays a known amount but tasks must be obtained (user tests, transcription, labeling, gigs); "speculative" when income depends on sales or traffic (revenue share, marketplace sales).
- reward_estimate_usd: for per_task = typical payment per task; for rev_share = realistic monthly income for a small creator; for hourly = hourly rate.
- effort_hours_estimate: hours per unit of reward (per task, or per month of upkeep for rev_share).
Hint for this source: ${source.parse_hint ?? 'none'}${source.paypal_confirmed ? '\nIMPORTANT: a real user has verified this source pays via PayPal. Include "PayPal" in payout_methods even if the page does not list payout methods.' : ''}`,
    user: `Source: ${source.name} (${source.url})\nCategory hint: ${source.category}\n\n---\n${pageText}`,
    toolName: 'report_opportunities',
    description: 'Report extracted opportunities and rejected ones.',
    schema: {
      type: 'object',
      required: ['opportunities', 'rejected'],
      properties: {
        opportunities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'provider', 'category', 'url', 'payout_methods', 'payout_currency', 'min_payout', 'payout_cycle', 'payout_days_estimate', 'reward_model', 'certainty', 'reward_estimate_usd', 'effort_hours_estimate', 'skills_required', 'countries_allowed', 'countries_blocked', 'requirements', 'deadline', 'eligibility_verified', 'eligibility_note', 'findings', 'confidence'],
            properties: {
              name: { type: 'string' },
              provider: { type: 'string' },
              category: { type: 'string', enum: CATEGORIES },
              url: { type: 'string' },
              payout_methods: { type: 'array', items: { type: 'string' } },
              payout_currency: { type: 'string' },
              min_payout: { type: 'number' },
              payout_cycle: { type: 'string' },
              payout_days_estimate: { type: 'integer' },
              reward_model: { type: 'string', enum: ['per_task', 'rev_share', 'bounty', 'hourly', 'one_time'] },
              certainty: { type: 'string', enum: ['fixed', 'per_task', 'speculative'] },
              reward_estimate_usd: { type: 'number' },
              effort_hours_estimate: { type: 'number' },
              skills_required: { type: 'array', items: { type: 'string' } },
              countries_allowed: { type: 'array', items: { type: 'string' } },
              countries_blocked: { type: 'array', items: { type: 'string' } },
              requirements: { type: 'array', items: { type: 'string' } },
              deadline: { type: ['string', 'null'] },
              eligibility_verified: { type: 'boolean' },
              eligibility_note: { type: 'string' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', enum: ['first_edition', 'individual_host', 'prize_not_locked', 'eligibility_missing', 'no_payout_history', 'payout_complaints', 'other'] },
                    severity: { type: 'string', enum: ['info', 'caution', 'warning'] },
                    message: { type: 'string' },
                    evidence: { type: 'string' },
                  },
                },
              },
              confidence: { type: 'number' },
            },
          },
        },
        rejected: { type: 'array', items: { type: 'object', required: ['name', 'reason'], properties: { name: { type: 'string' }, reason: { type: 'string' } } } },
      },
    },
  });

  const now = new Date().toISOString();
  const opportunities: Opportunity[] = r.opportunities
    .filter((o) => o.payout_methods.some((m) => /paypal/i.test(m)))
    .map((o, i) => ({
      ...o,
      confidence: Math.min(o.confidence, confidenceCap),
      id: `${source.id}:${slug(o.name)}${i ? `-${i}` : ''}`,
      source_id: source.id,
      legitimacy: { score: source.trust_baseline, notes: 'not yet audited', scored_by: 'baseline', scored_at: now, mode: 'seed' },
      status: 'active',
      last_checked: now,
      observed: { total_received_usd: 0, payments_count: 0, avg_days_to_payout: null, last_payment_at: null },
    }));
  const rejected = [
    ...r.rejected,
    ...r.opportunities.filter((o) => !o.payout_methods.some((m) => /paypal/i.test(m))).map((o) => ({ name: o.name, reason: `payout methods: ${o.payout_methods.join(', ') || 'none found'}` })),
  ];
  return { opportunities, rejected_no_paypal: rejected.length, rejected };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
