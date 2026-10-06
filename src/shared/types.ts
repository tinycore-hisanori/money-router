// Shared data model for Money Router (see docs/SPEC_v1.0.md §4)

export type Category =
  | 'game_portal'
  | 'bug_bounty'
  | 'user_testing'
  | 'survey'
  | 'microtask'
  | 'stock_assets'
  | 'freelance'
  | 'affiliate'
  | 'referral'
  | 'contest'
  | 'licensing'
  | 'localization'
  | 'data_collection'
  | 'other';

export type RewardModel = 'per_task' | 'rev_share' | 'bounty' | 'hourly' | 'one_time';
/** How certain the payout is once you do the work. fixed > per_task > speculative. */
export type Certainty = 'fixed' | 'per_task' | 'speculative';
export type OpportunityStatus = 'active' | 'paused' | 'closed' | 'suspect';
export type ExecutionStatus = 'todo' | 'applied' | 'active' | 'paid' | 'skipped';

export interface LegitimacyScore {
  score: number; // 0-100
  notes: string;
  scored_by: string; // model id
  scored_at: string; // ISO
  mode: 'full' | 'diff' | 'seed';
}

export type FindingCode =
  | 'first_edition'
  | 'individual_host'
  | 'prize_not_locked'
  | 'eligibility_missing'
  | 'no_payout_history'
  | 'payout_complaints'
  | 'other';
export type FindingSeverity = 'info' | 'caution' | 'warning';

/** Payment-risk finding: a reason, with evidence, that money might not arrive even if the offer is not a scam. */
export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  message: string; // English; localized copies live in LocalizedSummary.findings
  evidence: string; // quote or URL
}

/** AI-written summary in one language: what it is, what to do, how you get paid. */
export interface LocalizedSummary {
  summary: string;
  how_to: string[];
  payout: string;
  /** Findings translated into this language, same order as Opportunity.findings. */
  findings?: string[];
  generated_by: string;
  generated_at: string;
}

export interface ObservedStats {
  total_received_usd: number;
  payments_count: number;
  avg_days_to_payout: number | null;
  last_payment_at: string | null;
}

export interface Opportunity {
  id: string;
  source_id: string;
  name: string;
  provider: string;
  category: Category;
  url: string;
  payout_methods: string[];
  payout_currency: string;
  min_payout: number;
  payout_cycle: string;
  payout_days_estimate: number;
  reward_model: RewardModel;
  certainty: Certainty;
  reward_estimate_usd: number;
  effort_hours_estimate: number;
  skills_required: string[];
  countries_allowed: string[]; // ISO2, empty = worldwide
  countries_blocked: string[];
  requirements: string[];
  /** ISO date when applications/submissions close (contests, hackathons, limited promos). null = open-ended. */
  deadline: string | null;
  /** True only when eligibility (countries / residency / age) was read from official rules or terms. */
  eligibility_verified: boolean;
  /** Quoted or paraphrased eligibility clause, or why it could not be verified. */
  eligibility_note: string;
  /** Payment-risk findings (separate from the 0-100 legitimacy score). */
  findings: Finding[];
  legitimacy: LegitimacyScore;
  confidence: number; // 0-1 extraction confidence
  status: OpportunityStatus;
  last_checked: string;
  content_hash?: string;
  observed: ObservedStats;
  localized?: Record<string, LocalizedSummary>;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  category: Category;
  parse_hint?: string;
  trust_baseline: number;
  enabled: boolean;
  /** Set when a real user has verified that this source pays via PayPal; the extractor must not reject it for a missing mention. */
  paypal_confirmed?: boolean;
}

export interface UserProfile {
  country: string; // ISO2
  language: string; // BCP-47-ish: ja, en, ...
  skills: string[];
  hours_per_week: number;
  existing_accounts: string[]; // source_id[]
  free_text: string;
  paypal_email: string;
}

export interface Payment {
  transaction_id: string;
  amount: number;
  currency: string;
  date: string;
  payer_name: string;
  payer_email: string;
  note: string;
  subject: string;
  matched_opportunity_id: string | null;
  match_confidence: number;
  match_status: 'auto' | 'confirmed' | 'rejected' | 'unmatched';
  match_reason?: string;
}

export interface ExclusionReason {
  code:
    | 'deadline_passed'
    | 'country'
    | 'skills'
    | 'min_payout_unreachable'
    | 'legitimacy'
    | 'existing_account'
    | 'status';
  detail: string;
}

export interface RoutedOpportunity {
  opportunity: Opportunity;
  eligible: boolean;
  exclusions: ExclusionReason[];
  /** Soft flags that do not exclude but must be shown (e.g. eligibility not verified). */
  warnings: string[];
  /** Certainty after findings: any 'warning' finding demotes fixed/per_task to speculative. */
  effective_certainty: Certainty;
  expected_hourly: number;
  score: number;
  explanation?: string;
}

export interface WeeklyPlanItem {
  opportunity_id: string;
  name: string;
  certainty: Certainty;
  hours: number;
  expected_usd: number;
  first_step: string;
  why: string;
}

export interface WeeklyPlan {
  generated_at: string;
  hours_budget: number;
  hours_used: number;
  expected_usd: number;
  /** Portion of expected_usd from fixed + per_task items (money you can count on). */
  certain_usd: number;
  speculative_usd: number;
  items: WeeklyPlanItem[];
  summary: string;
}

export interface CrawlStatus {
  last_run: string | null;
  mode: string;
  audit_model: string | null;
  audit_mode: 'full' | 'diff' | null;
  sources: Record<
    string,
    { ok: boolean; fetched_at: string; changed: boolean; opportunities: number; error?: string; via?: 'direct' | 'search_page' | 'search_snippets'; url?: string; rejected?: { name: string; reason: string }[] }
  >;
  totals: { opportunities: number; active: number; rejected_no_paypal: number };
}
