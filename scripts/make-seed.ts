// Generates data/opportunities.seed.json — mock data for CRAWLER_MODE=mock and first boot.
// Values are illustrative placeholders; the live crawler replaces them with extracted terms.
import fs from 'node:fs';
import type { Opportunity } from '../src/shared/types.js';

const now = '2026-10-03T00:00:00.000Z';
const seed = (
  id: string, source_id: string, name: string, provider: string, category: Opportunity['category'], url: string,
  o: Partial<Opportunity>,
): Opportunity => ({
  id, source_id, name, provider, category, url,
  payout_methods: ['PayPal'], payout_currency: 'USD', min_payout: 0, payout_cycle: 'monthly', payout_days_estimate: 30,
  reward_model: 'per_task', certainty: 'per_task', reward_estimate_usd: 10, effort_hours_estimate: 1,
  skills_required: [], countries_allowed: [], countries_blocked: [], requirements: [], deadline: null, eligibility_verified: true, eligibility_note: 'seed data',
  legitimacy: { score: 70, notes: 'seed data — not yet audited', scored_by: 'seed', scored_at: now, mode: 'seed' },
  confidence: 0.5, status: 'active', last_checked: now,
  observed: { total_received_usd: 0, payments_count: 0, avg_days_to_payout: null, last_payment_at: null },
  ...o,
});

const list: Opportunity[] = [
  seed('crazygames:revenue-share', 'crazygames', 'CrazyGames Revenue Share', 'CrazyGames', 'game_portal', 'https://developer.crazygames.com/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 150, effort_hours_estimate: 20, min_payout: 100, payout_cycle: 'NET30', payout_days_estimate: 45,
    skills_required: ['html5_game_dev'], requirements: ['Exclusive or non-exclusive HTML5 game submission', 'Integrate CrazyGames SDK'],
    legitimacy: { score: 92, notes: 'Established portal with public developer terms', scored_by: 'seed', scored_at: now, mode: 'seed' }, confidence: 0.8,
  }),
  seed('gamepix:revenue-share', 'gamepix', 'GamePix Revenue Share', 'GamePix', 'game_portal', 'https://developers.gamepix.com/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 40, effort_hours_estimate: 10, min_payout: 100, payout_cycle: 'NET60', payout_days_estimate: 70,
    skills_required: ['html5_game_dev'], requirements: ['Submit HTML5 games via developer portal'],
    legitimacy: { score: 78, notes: 'Legitimate but lower traffic; long payout cycle', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('itchio:sales', 'itchio', 'itch.io Game & Asset Sales', 'itch.io', 'stock_assets', 'https://itch.io/docs/creators/payments', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 60, effort_hours_estimate: 8, min_payout: 0, payout_cycle: 'on_request', payout_days_estimate: 14,
    skills_required: ['html5_game_dev'], requirements: ['Upload games, templates or assets', 'Set your own revenue share (default 10% to itch)'],
    legitimacy: { score: 94, notes: 'Creator-friendly marketplace, direct-to-PayPal payouts', scored_by: 'seed', scored_at: now, mode: 'seed' }, confidence: 0.9,
  }),
  seed('hackerone:bounties', 'hackerone', 'HackerOne Bug Bounties', 'HackerOne', 'bug_bounty', 'https://hackerone.com/', {
    reward_model: 'bounty', certainty: 'per_task', reward_estimate_usd: 500, effort_hours_estimate: 25, min_payout: 0, payout_cycle: 'per_bounty', payout_days_estimate: 21,
    skills_required: ['security'], requirements: ['Valid, in-scope vulnerability report accepted by the program'],
    legitimacy: { score: 96, notes: 'Industry-standard platform, PayPal payout option', scored_by: 'seed', scored_at: now, mode: 'seed' }, confidence: 0.9,
  }),
  seed('usertesting:tests', 'usertesting', 'UserTesting Paid Tests', 'UserTesting', 'user_testing', 'https://www.usertesting.com/get-paid-to-test', {
    reward_model: 'per_task', reward_estimate_usd: 10, effort_hours_estimate: 0.33, min_payout: 0, payout_cycle: '7_days', payout_days_estimate: 7,
    skills_required: ['english'], countries_allowed: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP'], requirements: ['Pass a sample test', 'Microphone and screen recording'],
    legitimacy: { score: 90, notes: 'Well-known; test availability varies a lot by country', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('playtestcloud:playtests', 'playtestcloud', 'PlaytestCloud Mobile Playtests', 'PlaytestCloud', 'user_testing', 'https://www.playtestcloud.com/playtesters', {
    reward_model: 'per_task', reward_estimate_usd: 9, effort_hours_estimate: 0.25, min_payout: 0, payout_cycle: 'weekly', payout_days_estimate: 10,
    skills_required: [], requirements: ['Android or iOS device', 'Record gameplay with voice'],
    legitimacy: { score: 84, notes: 'Legit; invitations are sporadic', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('prolific:studies', 'prolific', 'Prolific Research Studies', 'Prolific', 'survey', 'https://www.prolific.com/participants', {
    reward_model: 'per_task', reward_estimate_usd: 8, effort_hours_estimate: 0.5, min_payout: 5, payout_cycle: 'on_request', payout_days_estimate: 5,
    skills_required: ['english'], countries_allowed: ['US', 'GB', 'CA', 'AU', 'IE', 'DE', 'NL', 'FR', 'ES', 'IT', 'PL'], requirements: ['Waitlist / limited sign-ups in many countries'],
    legitimacy: { score: 92, notes: 'Academic research platform, pays reliably', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('shutterstock:contributor', 'shutterstock', 'Shutterstock Contributor Earnings', 'Shutterstock', 'stock_assets', 'https://submit.shutterstock.com/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 30, effort_hours_estimate: 10, min_payout: 35, payout_cycle: 'monthly', payout_days_estimate: 40,
    skills_required: ['design'], requirements: ['Original photos, vectors, video or music'],
    legitimacy: { score: 90, notes: 'Established; per-download rates are low', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('envato:codecanyon', 'envato', 'Envato (CodeCanyon) Author Sales', 'Envato', 'stock_assets', 'https://codecanyon.net/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 120, effort_hours_estimate: 15, min_payout: 50, payout_cycle: 'monthly', payout_days_estimate: 35,
    skills_required: ['web_dev'], requirements: ['Items pass review', 'HTML5 game templates and JS plugins sell well'],
    legitimacy: { score: 91, notes: 'Large marketplace, PayPal payout supported', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('upwork:freelance', 'upwork', 'Upwork Freelance Contracts', 'Upwork', 'freelance', 'https://www.upwork.com/', {
    reward_model: 'hourly', certainty: 'per_task', reward_estimate_usd: 35, effort_hours_estimate: 1, min_payout: 0, payout_cycle: 'weekly', payout_days_estimate: 10,
    skills_required: ['web_dev', 'english'], requirements: ['Profile approval', '10% service fee'],
    legitimacy: { score: 93, notes: 'Escrow-backed, PayPal withdrawal available', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('fiverr:gigs', 'fiverr', 'Fiverr Gigs', 'Fiverr', 'freelance', 'https://www.fiverr.com/', {
    reward_model: 'per_task', reward_estimate_usd: 60, effort_hours_estimate: 3, min_payout: 0, payout_cycle: '14_days_after_completion', payout_days_estimate: 16,
    skills_required: ['web_dev'], requirements: ['20% platform fee', 'Gig description and samples'],
    legitimacy: { score: 92, notes: 'Established; competitive pricing', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('gumroad:products', 'gumroad', 'Gumroad Digital Products', 'Gumroad', 'stock_assets', 'https://gumroad.com/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 50, effort_hours_estimate: 6, min_payout: 10, payout_cycle: 'weekly', payout_days_estimate: 10,
    skills_required: [], requirements: ['Sell tools, templates, source code or art', '10% flat fee'],
    legitimacy: { score: 93, notes: 'Simple creator storefront, PayPal payouts', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('kofi:tips', 'kofi', 'Ko-fi Tips & Shop', 'Ko-fi', 'other', 'https://ko-fi.com/', {
    reward_model: 'rev_share', certainty: 'speculative', reward_estimate_usd: 15, effort_hours_estimate: 2, min_payout: 0, payout_cycle: 'instant', payout_days_estimate: 1,
    skills_required: [], requirements: ['Audience to share the page with'],
    legitimacy: { score: 90, notes: '0% fee on tips, PayPal direct', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('paypal-referral:invite', 'paypal-referral', 'PayPal Refer a Friend', 'PayPal', 'referral', 'https://www.paypal.com/us/webapps/mpp/invite', {
    reward_model: 'one_time', certainty: 'fixed', reward_estimate_usd: 10, effort_hours_estimate: 0.1, min_payout: 0, payout_cycle: 'on_qualification', payout_days_estimate: 14,
    countries_allowed: ['US'], requirements: ['Friend must make a qualifying purchase'],
    legitimacy: { score: 100, notes: 'First-party PayPal promotion; US only', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('swagbucks:signup', 'swagbucks', 'Swagbucks Sign-up Bonus', 'Swagbucks', 'referral', 'https://www.swagbucks.com/', {
    reward_model: 'one_time', certainty: 'fixed', reward_estimate_usd: 10, effort_hours_estimate: 0.5, min_payout: 5, payout_cycle: 'on_request', payout_days_estimate: 10,
    countries_allowed: ['US', 'CA', 'GB', 'AU', 'IE', 'DE', 'FR', 'ES', 'IN', 'PT'], requirements: ['New account', 'Earn first 2,500 SB within 60 days'],
    legitimacy: { score: 86, notes: 'Long-running rewards site; PayPal cash-out', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('rev:transcription', 'rev', 'Rev Transcription (per audio minute)', 'Rev', 'microtask', 'https://www.rev.com/freelancers', {
    reward_model: 'per_task', certainty: 'per_task', reward_estimate_usd: 12, effort_hours_estimate: 1, min_payout: 0, payout_cycle: 'weekly', payout_days_estimate: 7,
    skills_required: ['english'], requirements: ['Pass transcription test', 'Pays per audio minute, ~$0.30-1.10'],
    legitimacy: { score: 88, notes: 'Established; weekly PayPal payouts', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('gengo:translation', 'gengo', 'Gengo Translation Jobs', 'Gengo', 'freelance', 'https://gengo.com/translators/', {
    reward_model: 'per_task', certainty: 'per_task', reward_estimate_usd: 15, effort_hours_estimate: 1, min_payout: 0, payout_cycle: 'on_request', payout_days_estimate: 5,
    skills_required: ['english', 'japanese'], requirements: ['Pass language pair test (EN↔JA available)'],
    legitimacy: { score: 87, notes: 'Crowd translation, PayPal payouts; EN↔JA demand is steady', scored_by: 'seed', scored_at: now, mode: 'seed' },
  }),
  seed('devpost:paypal-ai-hackathon', 'devpost', 'PayPal AI Hackathon (Devpost) — prizes', 'Devpost / PayPal', 'contest', 'https://paypalaihackathon.devpost.com/', {
    reward_model: 'one_time', certainty: 'fixed', reward_estimate_usd: 5000, effort_hours_estimate: 80, min_payout: 0, payout_cycle: 'after_judging', payout_days_estimate: 60,
    skills_required: ['web_dev'], requirements: ['Public GitHub repo with license', 'Demo video under 3 minutes', 'Meaningful use of PayPal + AI'], deadline: '2026-11-12',
    legitimacy: { score: 95, notes: 'Devpost-managed hackathon; prizes paid by Devpost (PayPal available)', scored_by: 'seed', scored_at: now, mode: 'seed' }, confidence: 0.8,
  }),
  seed('shady:crypto-tasks', 'other', 'EasyPayDaily Crypto Micro Tasks', 'EasyPayDaily', 'microtask', 'https://example.com/easypaydaily', {
    reward_model: 'per_task', reward_estimate_usd: 50, effort_hours_estimate: 0.2, min_payout: 500, payout_cycle: 'unspecified', payout_days_estimate: 90,
    requirements: ['$29 activation fee', 'Guaranteed $500/day'],
    legitimacy: { score: 12, notes: 'Upfront fee, guaranteed-income claims, unreachable payout threshold — scam pattern', scored_by: 'seed', scored_at: now, mode: 'seed' },
    status: 'suspect', confidence: 0.9,
  }),
];

fs.writeFileSync('data/opportunities.seed.json', JSON.stringify(list, null, 2));
console.log(`wrote ${list.length} seed opportunities`);
