import type {
  ExclusionReason,
  ExecutionStatus,
  Opportunity,
  RoutedOpportunity,
  UserProfile,
  WeeklyPlan,
  WeeklyPlanItem,
} from '../../shared/types.js';

export const LEGITIMACY_THRESHOLD = 60;

/** Prefer money you can count on. Speculative (make it and hope it sells) is heavily discounted. */
export const CERTAINTY_WEIGHT: Record<Opportunity['certainty'], number> = { fixed: 1, per_task: 0.9, speculative: 0.4 };

/** Skill synonyms so "javascript" matches "html5_game_dev"-style requirements loosely. */
const SKILL_ALIASES: Record<string, string[]> = {
  html5_game_dev: ['javascript', 'typescript', 'game_dev', 'phaser', 'godot', 'unity', 'webgl'],
  web_dev: ['javascript', 'typescript', 'react', 'html', 'css', 'node'],
  security: ['pentest', 'bug_bounty', 'appsec', 'ctf'],
  writing: ['copywriting', 'blogging', 'english'],
  design: ['illustration', 'ui', 'ux', 'graphic_design'],
  audio: ['music', 'sound_design'],
  video: ['video_editing', 'motion_graphics'],
  '3d': ['blender', 'modeling'],
};

function hasSkill(user: string[], required: string): boolean {
  const u = new Set(user.map((s) => s.toLowerCase()));
  if (u.has(required)) return true;
  return (SKILL_ALIASES[required] ?? []).some((a) => u.has(a));
}

/** Discount for money that arrives late: 1.0 at <=7 days, decays toward 0.5 at ~90 days. */
export function timeDiscount(days: number): number {
  if (days <= 7) return 1;
  return Math.max(0.5, 1 - (days - 7) / 170);
}

/** Boost/penalty from observed PayPal payments. */
export function observedBoost(o: Opportunity, exec: ExecutionStatus | undefined, now: Date): number {
  const obs = o.observed;
  if (obs.payments_count > 0) return Math.min(1.5, 1 + 0.1 * obs.payments_count);
  // Recommended and acted on, but no money yet past the expected window -> penalty
  if (exec === 'active' || exec === 'applied') {
    const expected = o.payout_days_estimate;
    const since = (now.getTime() - new Date(o.last_checked).getTime()) / 86_400_000;
    if (since > expected * 1.5) return 0.7;
  }
  return 1;
}

export function routeOne(
  o: Opportunity,
  profile: UserProfile,
  exec: ExecutionStatus | undefined,
  now = new Date(),
): RoutedOpportunity {
  const exclusions: ExclusionReason[] = [];

  if (o.status !== 'active') exclusions.push({ code: 'status', detail: `status is ${o.status}` });

  if (o.countries_allowed.length && !o.countries_allowed.includes(profile.country))
    exclusions.push({ code: 'country', detail: `not available in ${profile.country}` });
  if (o.countries_blocked.includes(profile.country))
    exclusions.push({ code: 'country', detail: `blocked in ${profile.country}` });

  const missing = o.skills_required.filter((s) => !hasSkill(profile.skills, s));
  if (missing.length) exclusions.push({ code: 'skills', detail: `missing: ${missing.join(', ')}` });

  if (o.legitimacy.score < LEGITIMACY_THRESHOLD)
    exclusions.push({ code: 'legitimacy', detail: `score ${o.legitimacy.score} < ${LEGITIMACY_THRESHOLD}` });

  if (profile.existing_accounts.includes(o.source_id) && (o.category === 'referral' || o.category === 'affiliate'))
    exclusions.push({ code: 'existing_account', detail: 'new-account bonus; you already have an account' });

  // Can the user realistically reach min_payout within ~a month at their hours?
  const unitsPerMonth = o.effort_hours_estimate > 0 ? (profile.hours_per_week * 4) / o.effort_hours_estimate : 1;
  const monthlyUsd = o.reward_model === 'rev_share' ? o.reward_estimate_usd : unitsPerMonth * o.reward_estimate_usd;
  if (o.min_payout > 0 && monthlyUsd < o.min_payout)
    exclusions.push({
      code: 'min_payout_unreachable',
      detail: `~$${monthlyUsd.toFixed(0)}/mo at your hours < min payout $${o.min_payout}`,
    });

  const expected_hourly = o.effort_hours_estimate > 0 ? o.reward_estimate_usd / o.effort_hours_estimate : 0;
  const score =
    expected_hourly *
    CERTAINTY_WEIGHT[o.certainty] *
    (o.legitimacy.score / 100) *
    timeDiscount(o.payout_days_estimate) *
    observedBoost(o, exec, now);

  return { opportunity: o, eligible: exclusions.length === 0, exclusions, expected_hourly, score };
}

export function routeAll(
  list: Opportunity[],
  profile: UserProfile,
  execution: Record<string, ExecutionStatus>,
): RoutedOpportunity[] {
  return list
    .map((o) => routeOne(o, profile, execution[o.id]))
    .sort((a, b) => b.score - a.score);
}

/** Greedy weekly plan within the hours budget (skips 'skipped'/'paid' items). */
export function buildWeeklyPlan(
  routed: RoutedOpportunity[],
  profile: UserProfile,
  execution: Record<string, ExecutionStatus>,
): WeeklyPlan {
  const items: WeeklyPlanItem[] = [];
  let hours = 0;
  for (const r of routed) {
    if (!r.eligible) continue;
    const ex = execution[r.opportunity.id];
    if (ex === 'skipped' || ex === 'paid') continue;
    const o = r.opportunity;
    const slot = Math.min(o.effort_hours_estimate || 1, profile.hours_per_week - hours);
    if (slot <= 0) break;
    const expected = o.reward_model === 'rev_share' ? o.reward_estimate_usd / 4 : r.expected_hourly * slot;
    items.push({
      opportunity_id: o.id,
      name: o.name,
      certainty: o.certainty,
      hours: slot,
      expected_usd: Math.round(expected * 100) / 100,
      first_step: o.requirements[0] ? `Check: ${o.requirements[0]}` : `Sign up at ${o.url}`,
      why: `~$${r.expected_hourly.toFixed(0)}/h, pays in ~${o.payout_days_estimate}d, legitimacy ${o.legitimacy.score}`,
    });
    hours += slot;
    if (hours >= profile.hours_per_week) break;
  }
  const sum = (xs: WeeklyPlanItem[]) => Math.round(xs.reduce((s, i) => s + i.expected_usd, 0) * 100) / 100;
  return {
    generated_at: new Date().toISOString(),
    hours_budget: profile.hours_per_week,
    hours_used: hours,
    expected_usd: sum(items),
    certain_usd: sum(items.filter((i) => i.certainty !== 'speculative')),
    speculative_usd: sum(items.filter((i) => i.certainty === 'speculative')),
    items,
    summary: '',
  };
}
