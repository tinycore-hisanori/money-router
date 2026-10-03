import { config } from '../server/lib/config.js';
import { structured } from '../server/lib/llm.js';
import type { LocalizedSummary, Opportunity } from '../shared/types.js';

const LANG_NAMES: Record<string, string> = { ja: 'Japanese', en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German', fr: 'French', ko: 'Korean', zh: 'Chinese', id: 'Indonesian', hi: 'Hindi' };

/** Generate "what / how / payout" summaries for every configured locale in one call. */
export async function localizeOpportunity(o: Opportunity, locales = config.locales): Promise<Record<string, LocalizedSummary>> {
  if (!locales.length) return {};
  const r = await structured<{ translations: { lang: string; summary: string; how_to: string[]; payout: string }[] }>({
    model: config.models.localize,
    maxTokens: 2048,
    system: `You write short, practical briefs for independent creators about an earning opportunity, in several languages.
For each requested language produce:
- summary: one sentence — what this is and who it suits (plain, no hype).
- how_to: 3 concrete steps to start earning (imperative, each under 15 words).
- payout: one sentence — how much, how often, minimum, and that it pays via PayPal. Include concrete numbers from the data.
Write natively in each language (not a literal translation). Keep platform names in English.`,
    user: JSON.stringify({
      languages: locales.map((l) => ({ code: l, name: LANG_NAMES[l] ?? l })),
      opportunity: {
        name: o.name, provider: o.provider, category: o.category, url: o.url, certainty: o.certainty, reward_model: o.reward_model,
        reward_estimate_usd: o.reward_estimate_usd, effort_hours_estimate: o.effort_hours_estimate, min_payout: o.min_payout,
        payout_cycle: o.payout_cycle, payout_days_estimate: o.payout_days_estimate, countries_allowed: o.countries_allowed,
        skills_required: o.skills_required, requirements: o.requirements, legitimacy_notes: o.legitimacy.notes,
      },
    }),
    schema: {
      type: 'object',
      properties: {
        translations: {
          type: 'array',
          items: { type: 'object', properties: { lang: { type: 'string' }, summary: { type: 'string' }, how_to: { type: 'array', items: { type: 'string' } }, payout: { type: 'string' } } },
        },
      },
    },
  });
  const now = new Date().toISOString();
  const out: Record<string, LocalizedSummary> = {};
  for (const t of r.translations) out[t.lang] = { summary: t.summary, how_to: t.how_to, payout: t.payout, generated_by: config.models.localize, generated_at: now };
  return out;
}
