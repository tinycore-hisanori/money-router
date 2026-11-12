# Money Router v1.0 Specification
## Money Router — an AI radar for PayPal-payable work, worldwide

> Japanese version: [SPEC_v1.0.ja.md](SPEC_v1.0.ja.md)

- Created: 2026-10-03
- Target: PayPal AI Hackathon (Devpost) — deadline 2026-11-12 12:00 PST (JST 11/13 05:00)
- Previous version: v0.6.0 (monitoring Japanese bank campaigns, PHP/XServer) → rebuilt from scratch. Only the ideas carry over: don't miss opportunities, use money efficiently, show what to do today.
- Prizes aimed at: Overall / Best Use of PayPal + AI / Best Use of Agentic Commerce / Best Use of AG Grid / Best Use of Render

---

## 1. Product definition

### 1.1 In one sentence
A tool where AI collects and vets earning opportunities worldwide that pay out to PayPal, turns them into an action plan that fits the user's country, skills and hours, and keeps verifying their real value against actual PayPal payments.

### 1.2 The problem

**Real example (2026-10-05):** the author did not hear about the MapleStory Worlds Global Creator Challenge (Nexon, entries 6/4–10/7, $65,000 in prizes) until two days before the deadline. It was announced mainly in Korea, was not on Devpost, and had no Japanese coverage. "The information exists, but language and location keep it from reaching you" — the typical problem Money Router's Discover has to solve.

- Side-income opportunities that pay via PayPal (game-portal developer revenue, bug bounties, user testing, surveys, microtasks, stock assets, freelancing, affiliate programs, referral bonuses) are countless but scattered and hard to find.
- Many of them are scams, never pay, or have minimum payouts you will never reach.
- Checking each one for "can I use this from my country", "can I earn with my skills" and "when will I be paid" is expensive.
- Almost nobody knows how much each opportunity actually earned them.

### 1.3 Target users
Individual creators, developers, freelancers and students who collect several small income streams through PayPal. The primary user is the developer himself (an indie game developer paid by CrazyGames, GamePix and others via PayPal).

### 1.4 Three pillars
| Pillar | Role | Where AI is used | Where PayPal is used |
|---|---|---|---|
| Discover | Collect, structure and vet opportunities, **including contests, prizes and hackathons** | Structured extraction from pages, legitimacy score, de-duplication, deadline extraction | — |
| Route | User conditions → action plan | Interpreting a natural-language profile, prioritisation, writing the weekly plan explanation | — |
| Track | Close the loop with real payments | Matching payments to opportunities, re-ranking by observed earnings | Transaction Search API, Invoicing API, Payouts API (for the demo) |

---

## 2. Scope

### 2.1 In v1.0 (submission)
- AI crawler over 20–30 registered sources (source registry), once a day (Render Cron)
- Opportunity data model (§4) and AI legitimacy score
- User profile (country, skills, hours per week, existing accounts, free-text self-description)
- Exclusion checks (country restrictions, missing skills, unrealistic minimum payout, etc.) with the reason shown
- Scoring and a "this week" plan
- Incoming payments via PayPal Transaction Search, matched to opportunities by AI
- Ranking correction from observed earnings (total received per opportunity, days from recommendation to payment)
- Invoice drafts with PayPal Invoicing (for freelance-type work; sent after user confirmation)
- Opportunity table with AG Grid (filter, sort, grouping, observed columns)
- Deployment to Render (Web Service + Cron Job)
- 3-minute demo video, README, English submission text

### 2.2 Out of scope
- Applying or creating accounts automatically
- Discovering new sources by open web search (v1.1+)
- Multi-user and authentication (single local profile; the demo is locked to sandbox)
- Notifications (e-mail / push)

---

## 3. System architecture

```
[Browser SPA (React + AG Grid)]
        |
        v
[API: Node.js / TypeScript (Hono or Express)]  ---- Render Web Service
   ├─ /api/opportunities     ← opportunities.json (or SQLite)
   ├─ /api/profile           ← user profile (server-side JSON, single user)
   ├─ /api/plan              ← Route engine + explanation written by Claude
   ├─ /api/paypal/sync       ← PayPal Transaction Search → AI matching
   ├─ /api/paypal/invoice    ← PayPal Invoicing (draft → user confirm → send)
   └─ /api/status            ← crawl status
        |
        v
[Crawler: Render Cron Job, once a day]
   ├─ walk source_registry.json
   ├─ HTML → text → structured extraction with Claude (JSON schema)
   ├─ legitimacy scoring and de-duplication
   └─ update opportunities.json (tmp + rename)

[PayPal Sandbox]
   ├─ Transaction Search API  (incoming payments)
   ├─ Invoicing API           (invoices)
   └─ Payouts API             (demo: script that generates simulated payments)
```

- Storage: JSON files in v1.0 (mounted on a Render Disk). Switching to SQLite is optional.
- LLM: Claude API (structured extraction enforced with tool use / JSON schema).
- PayPal: REST API called directly (`@paypal/paypal-server-sdk`). Agent Toolkit / MCP Server is used for the agent part and stated in the README.

> As built: hosted on a VPS behind Nginx + Cloudflare with PM2; the crawler runs in-process on a schedule. Per-user data lives under `data/runtime/users/<user>/` (see README).

---

## 4. Data model

### 4.1 Opportunity
| Field | Type | Meaning |
|---|---|---|
| id | string | Unique id |
| source_id | string | id in source_registry |
| name | string | Opportunity name (e.g. CrazyGames Developer Revenue Share) |
| provider | string | Provider |
| category | enum | game_portal / bug_bounty / user_testing / survey / microtask / stock_assets / freelance / affiliate / referral / **contest** / **licensing** / **localization** / **data_collection** / other |
| url | string | Official URL |
| payout_methods | string[] | Payout methods. Only opportunities that include PayPal are kept |
| payout_currency | string | USD etc. |
| min_payout | number | Minimum payout |
| payout_cycle | string | NET30 / weekly / on_request etc. |
| payout_days_estimate | integer | Typical days from work to payment |
| reward_model | enum | per_task / rev_share / bounty / hourly / one_time |
| certainty | enum | fixed (a set amount once conditions are met) / per_task (paid per task, but you need to get the task) / speculative (may or may not sell) |
| reward_estimate_usd | number | Typical amount per unit or per month |
| effort_hours_estimate | number | Typical hours per unit |
| skills_required | string[] | Required skills (html5_game_dev, security, writing, design, ...) |
| countries_allowed | string[] | ISO2. Empty = worldwide |
| countries_blocked | string[] | ISO2 |
| requirements | string[] | Conditions as bullet points (age, portfolio, etc.) |
| deadline | date \| null | Application / submission deadline (contests, hackathons, limited-time promotions). null for open-ended ones. **Carried over from v0.6.0's "application deadline"** |
| eligibility_verified | bool | Whether eligibility (country, residence, age) could be confirmed from the official rules |
| eligibility_note | string | Quote of the eligibility clause, or why it is unverified |
| findings | Finding[] | **Payment-risk findings.** `code` (first_edition / individual_host / prize_not_locked / eligibility_missing / no_payout_history / payout_complaints / other), `severity` (info / caution / warning), `message` (English; translations in localized[lang].findings), `evidence` (quote or URL). Separate from legitimacy_score (scam or not): records, with evidence, why something that is not a scam might still not pay |
| legitimacy_score | number 0-100 | AI audit score |
| legitimacy_notes | string | Reasoning |
| confidence | number 0-1 | Extraction confidence |
| status | enum | active / paused / closed / suspect |
| last_checked | datetime | Last checked |
| observed | object | Observed: total_received_usd, payments_count, avg_days_to_payout, last_payment_at |

### 4.2 Source
| Field | Description |
|---|---|
| id, name, url | The source |
| category | One of the categories above |
| parse_hint | Extraction hint for the AI (e.g. "developer payout terms are in the FAQ") |
| trust_baseline | 0-100. Initial trust set by the operator |
| enabled | bool |

### 4.3 UserProfile
| Field | Description |
|---|---|
| country | ISO2 |
| skills | string[] |
| hours_per_week | number |
| existing_accounts | source_id[] (existing accounts → excluded from referral / new-user bonuses) |
| free_text | Natural language (e.g. "I can make HTML5 games. I can read English. 10 hours a week") → AI fills in skills / hours |
| paypal_email | Sandbox receiving account |

### 4.4 Payment (PayPal)
| Field | Description |
|---|---|
| transaction_id | PayPal transaction_id |
| amount, currency, date | Transaction details |
| payer_name, payer_email, note, subject | Matching input |
| matched_opportunity_id | AI match result (nullable) |
| match_confidence | 0-1 |
| match_status | auto / confirmed / rejected (the user can approve) |

### 4.5 ExecutionStatus (the user's state per opportunity)
todo / applied / active / paid / skipped — carried over from v0.6.0's progress tracking (extended in §6.1.2).

---

## 5. Discover (AI crawler)

1. Walk source_registry and convert HTML to text (Readability + main-content extraction).
2. Force structured extraction with Claude and a JSON schema (all fields of §4.1). Opportunities without PayPal in payout_methods are dropped.
3. Legitimacy scoring (separate prompt): domain age, visible operating entity, concreteness of payout terms, danger signals such as "registration fee", known scam patterns → 0-100.
4. Merge duplicates with existing opportunities (same URL or similar name). Changes are reflected in status as a diff.
5. Update opportunities.json with tmp + rename and record the result in crawl_status.json.

### 5.1 Skipping unchanged pages
Store a hash of each fetched page body; if it matches the previous run, do not call the LLM (terms pages change once or twice a month). This keeps LLM cost minimal on ordinary days.

### 5.2 Model configuration (per stage and per weekday in .env)
Model ids are environment-variable strings, so a new model is a one-line change.

```env
# Default model per stage
MODEL_EXTRACT=claude-sonnet-5-5      # page -> JSON (only on days with a diff)
MODEL_AUDIT=claude-sonnet-5-5        # legitimacy score (only on days with a diff)
MODEL_MATCH=claude-opus-5-5          # PayPal payment matching
MODEL_EXPLAIN=claude-opus-5-5        # "this week" explanations

# Audit schedule per weekday (other days: MODEL_AUDIT, diff only)
# Format: <dow>:<model>:<mode>  mode is full (re-audit all active items) | diff
AUDIT_SCHEDULE=mon:claude-fable-5-1:full,thu:claude-opus-5-5:full
```

- The weekday rotation sets how deep that day's audit goes, not what is sent. On full days every active opportunity is re-audited regardless of page changes, to catch drift toward scams or worse terms.
- Each score records `scored_by` (model id) and `scored_at`. The UI treats the latest full-audit score as authoritative and shows provisional scores from diff days as provisional (scores are not averaged across models, because models score differently).
- Cost estimate: Monday Fable, all items (30 × ~10k input + 1.5k output ≈ $5) × 4 + Thursday Opus, all items (≈ $2) × 4 + daily Sonnet diffs ≈ about $30/month. With Sonnet diffs only: $3–5/month.

Initial source candidates (about 30, refined during implementation):
- game_portal: CrazyGames, GamePix, Poki (to check), Yandex Games, itch.io
- bug_bounty: HackerOne, Bugcrowd, Intigriti, YesWeHack
- user_testing: UserTesting, Userlytics, TryMyUI (Trymata), PlaytestCloud
- survey/microtask: Prolific, Amazon MTurk (dropped if no PayPal), Clickworker, Appen, Remotasks
- stock_assets: Shutterstock, Adobe Stock, Pond5, AudioJungle/Envato
- freelance: Upwork, Fiverr, Freelancer.com, PeoplePerHour
- affiliate/referral: Amazon Associates (dropped if no PayPal), ShareASale, Impact, PayPal Referral
- other: Gumroad, Ko-fi, Buy Me a Coffee, Teespring/Spring

→ Anything where "PayPal payout" cannot be confirmed is dropped automatically by the AI. This is itself a highlight of the demo.

### 5.3 Contests, prizes and hackathons (category: contest)
The typical "information with a deadline and a fixed amount", and the category closest to the product's origin (v0.6.0's bank campaigns).
- Sources: Devpost (prizes can be paid via PayPal through Devpost), itch.io jams (only those with prizes), Japanese contest sites (Tōryūmon / Kōbo Guide), game-company developer contests (Nexon etc.), hackathon announcements.
- **Assume multilingual sources**: Korean, Chinese and European contest sites are included in Discovery searches, and summaries are written in the user's language (the MapleStory lesson).
- Extraction: always get `deadline` and the prize amount. Past-deadline items are excluded as `deadline_passed` and automatically become `closed`.
- **Eligibility checks are mandatory** (MapleStory lesson #2: the rules hid that people in Japan might not be able to enter). For contest / referral items, search for the "Official Rules / eligibility" page, append it to the text, and extract `eligibility_verified` (explicitly confirmed by the rules) and `eligibility_note` (quote). If it cannot be confirmed, do not guess `countries_allowed`; show an "Eligibility unverified (check the rules)" warning in the UI and summary, and give no deadline boost.
- Routing: the nearer the deadline, the higher the priority (within 7 days ×1.5, within 30 days ×1.25). certainty is `fixed` (prize amount stated).
- **Event Radar (one-off event search)**: separately from registered platforms, search for "recently announced one-off events" by vocabulary rather than event names (prize / deadline / 賞金 / 募集 / 공모전 / 상금 / 奖金 …) in English, Japanese, Korean and Chinese (Brave freshness = 1 month), extract with the rules page attached, and register the result directly as an opportunity with deadline, prize and eligibility (source_id = radar). No approval gate (the user pays nothing, so the legitimacy score and eligibility warning are enough). Auto-closed after the deadline. Runs weekly (RADAR_DOW) and on demand. The key feature for catching MapleStory-type events.

### 5.4 Payment-risk findings — contest / referral
**Real example (2026-10-07):** Overpowered Studios Game Jam #1 (itch.io, $415 prize paid in cash via PayPal). Not a scam, but the prize amount is a "target" and not locked, the host is an individual running a first edition, and there are no eligibility rules. A single legitimacy_score cannot show this grey zone.

| Signal | How it is detected | severity |
|---|---|---|
| First edition | #1 / 1st / first in the name, or no mention of past editions | caution |
| Individual host | The host is a personal account, not a company or organisation | caution |
| Prize not locked | target / goal / TBD / will lock / depends on sponsors etc. | warning |
| No eligibility rules | eligibility_verified = false | warning |
| No payout history | No reports of past winners receiving prizes | caution |
| Payout complaints | Credible reports from a search for host name × never paid / not received / 未払い (passed to the extractor as a COMPLAINT SEARCH section) | warning |

Effects:
- One or more warnings → `effective_certainty = speculative` (weight 0.4). **Counted in speculative_usd, not certain_usd.**
- A "Risk" column in the list (⚠ number of warnings / △ number of cautions, tooltip with the findings). Findings are shown in the user's language in the brief panel and on weekly-plan cards.
- When Track confirms a payment, that opportunity's `no_payout_history` is cleared (future: carry trust over to the same host's next edition).
- `overpowered-jam` is registered in the registry as a test case (the typical item Event Radar should catch: PayPal prize, not on Devpost, announced on Discord).

- Note: entering a contest does not guarantee a prize, so the weekly plan's expected value uses `reward × a conservative acceptance-rate estimate` (to be tuned in v1.1).

---

## 6. Route (action plan)

### 6.1 Exclusion checks
- countries_allowed/blocked vs. the user's country
- skills_required ⊄ user skills (AI absorbs synonyms)
- min_payout higher than reward_estimate × expected number of runs (you would never reach the payout)
- legitimacy_score < threshold (default 60)
- in existing_accounts and the bonus is new-users-only

The exclusion reason is always shown (carried over from v0.6.0).

### 6.2 Score
```
expected_hourly = reward_estimate_usd / effort_hours_estimate
score = expected_hourly
        × certainty_weight (fixed 1.0 / per_task 0.9 / speculative 0.4)   // "might sell if you build it" is heavily discounted
        × deadline_urgency (within 7 days 1.5 / within 30 days 1.25 / otherwise 1.0)  // nearer deadlines first
        × legitimacy_score/100
        × time_discount(payout_days_estimate)      // the later the payment, the lower
        × observed_boost                           // boosted by real payments, lowered if nothing arrived N days after recommendation
```
Opportunities are chosen greedily within the time budget (hours_per_week) → "this week". For items with a deadline, the effort is divided by the number of weeks until the deadline, and no single item may take more than half of the weekly budget (no all-in bets). Eligible items that did not fit are listed as "next in line". The plan shows **certain_usd (fixed + per_task: money you can count on)** and **speculative_usd (if it sells / wins)** separately. Design principle: don't sell dreams; show what will reliably come in this week first.

#### 6.1.0 Prizes are not counted as expected income
Contest, hackathon and jam prizes only arrive if you win, so regardless of extraction they get **effective_certainty = speculative (depends on the result)** and are not included in the weekly expected amount (certain_usd), except for items with a payment confirmed in PayPal. The wording is "about $X is expected" rather than "you can count on", and prizes are shown separately as "if it works out (prizes, sales)".

#### 6.1.1 Contest fields (aligned with the prize-hunter board)
Fields actually used in the author's prize-hunter board (Artifact) are added to opportunities: **start date starts / deadline / period text period / result date result_date / result note result_note**. Period text in listings ("Sep 24 - Nov 18, 2026") is converted to ISO deterministically before being passed to the AI (the AI only copies it). The UI shows "N days left" for deadlines (≤7 days red, ≤21 days orange) and "results in N days / results may be out" for results.

#### 6.1.2 Status and notes
Status (execution): to do todo / applied / in progress active / **submitted, waiting for results submitted** / paid / **won** / **lost** / skipped. submitted, won, lost, paid and skipped drop out of the weekly plan; submitted and applied are listed in the dashboard's "Submitted — waiting for results" with their result date.
Notes (notes.json): **what to submit (idea)** and a **note**, edited in the detail modal.

#### 6.1.3 Main and secondary: "My picks" first, "Suggestions" second
The dashboard centres on **My picks** (to do / applied / in progress items chosen with "+ Pick"). They are sorted by nearest deadline and show this week's hours (picked hours / weekly hours, red when over), each item's deadline, what to submit, first step and status, and the expected total (prizes counted separately).
**Suggestions** (not-yet-picked items fitted into the remaining hours) sit in a side column and move to My picks with "+ Pick". Only while nothing is picked does the suggested route take the main column. The opportunity list has a "My picks" tab (grouped by status). The weekly plan puts picked items first.

#### 6.1.4 Management features from the prize-hunter board
- **Summary strip**: N in progress / M joined (won, waiting, lost) / next deadline (days left, name) / next result date.
- **Current game plan**: one board-wide note (`_board` in notes.json, saved on blur).
- **What to submit**: editable inline on each pick (saved on Enter or blur).
- **✓ Submitted**: one click moves the item to "submitted — waiting for results", listed with its result date.
- Not yet built: manually adding opportunities the crawler did not find.

#### 6.1.5 The public demo is view-only
Everyone sees the same public demo, so visitors without a key (public) are read-only and see a demo user. Saving the profile, "+ Pick" / status changes, notes, crawl now, event search, and PayPal sync / match / invoice need a judge key or the admin key (403 `key_required` → a notice at the top of the screen). Without a key you can browse, generate briefs (50/day) and run AI Discovery (3/day, results wait for approval). Opening a URL with `?key=<key>` stores the key and removes it from the URL (one click for judges). Each judge key is its own user with separate server-side data. A local install with no keys configured is fully open.

#### 6.1.6 Opportunity lifecycle (user actions)
```
Browse ─"+ Pick"→ To do ─(select)→ In progress ─┬─ Contest: "✓ Submitted"→ Submitted ─┬─"🏆 Won"→ Won, waiting for payout ─(PayPal match or "Mark as paid")→ Paid
                                                │                                     └─"Lost"→ Lost
                                                └─ Other: "✓ Work done"→ Done, waiting for payout ─(PayPal match or "Mark as paid")→ Paid ─"Do it again"→ In progress
From anywhere: "Give up"→ Skipped / "Back to in progress" / the last change can be undone from the bar at the top
Skipped, Lost ─"Pick again"→ To do
```
- When a PayPal payment is matched, a won or submitted item automatically becomes Paid (items waiting for payment are passed to the AI as preferred candidates during matching).
- Status, notes and payment matches are keyed by opportunity id. So that they survive the AI renaming an item on re-crawl: (1) items with their own URL get a stable id derived from the URL; (2) when an id still changes, a successor is found by same URL / only item from the same source / similar name, and the state is moved; (3) items with state and no successor (e.g. hackathons that left the listing after their deadline) are kept as "closed".

#### 6.2.1 ★ ratings (two human-facing axes, 1–5 each)
The score is for machines. So that people can choose at a glance, each item gets **Easy** and **Payoff** stars (no LLM, deterministic).
```
Easy   = (small effort 0.4 + few conditions/skills 0.2 + fast payout 0.2 + low minimum payout 0.2)
         × has deadline 0.6 × has warnings 0.7
Payoff = (hourly rate, log-normalised 0–$100/h, 0.6 + reward, log-normalised 0–$1000, 0.4)
         × certainty_weight × legitimacy/100 × √time_discount
→ round 0–1 to 1–5 ★
```
Examples: PayPal referral bonus Easy 5 / Payoff 4, Devpost hackathon Easy 2 / Payoff 4, scam sample Payoff 1, Overpowered (with warnings) Easy 2 / Payoff 2.

### 6.3 What the AI does
- Fills in the profile from free_text
- Writes one or two sentences per recommendation: "why it suits you / first step" (English / Japanese)
- Summarises the whole weekly plan

---

## 7. Track (PayPal integration)

### 7.1 Payment sync
- Fetch received transactions for the last N days with `GET /v1/reporting/transactions` (Transaction Search API, sandbox).
- Pass each transaction's payer_name / email / note / subject / amount, plus active opportunities and the user's execution state, to Claude and match to the most likely opportunity (with confidence).
- confidence < 0.7 is shown to the user as "needs review" and becomes final when confirmed.
- Confirmed payments are aggregated into opportunity.observed → reflected in §6.2 observed_boost.

### 7.2 Invoices (Invoicing API)
- For freelance / hourly opportunities, pressing "Invoice" lets the AI draft an invoice from the work description.
- Create a draft with `POST /v2/invoicing/invoices` → preview → user confirmation → `send`.
- This is where the agent creates a transaction, aimed at the Agentic Commerce prize.

### 7.3 Simulated payments for the demo
- `scripts/seed-payments.ts` uses the Payouts API (sandbox) to send money from another sandbox account to the user's receiving account with notes such as "CrazyGames Revenue Share August".
- The video shows Discover → Route → seed → sync → matching → ranking change end to end.

### 7.4 Agent execution (optional, if time allows)
- Using PayPal Agent Toolkit / MCP Server, add a chat box that can run "sync last week's payments and draft invoices for anything not yet billed" in natural language.

---

## 8. Screens

1. **Dashboard**: this week's tasks (cards), expected earnings this week, observed earnings, crawl status
2. **Opportunities** (AG Grid Community): toggle All / For you; columns: opportunity, category, expected hourly rate, minimum payout, days to payout, legitimacy (with scored_by), observed amount received, status. Exclusion reasons as tooltips. Row grouping is an Enterprise feature, so category tabs and filters are used instead.
3. **Profile**: country, skills, hours, existing accounts, free text
4. **Payments**: PayPal sync button, payment list (AG Grid), AI match results and confirmation UI
5. **Invoices**: draft list, preview, send

Language: the UI is in English (for judges), with a Japanese switch.

---

## 9. Security and privacy
- PayPal credentials only in environment variables, never in the repository (an .env.example is provided).
- Sandbox only. Production credentials are refused (`PAYPAL_ENV=sandbox` is fixed by environment variable).
- Names, addresses and account numbers are not stored. Payer details can be hashed after matching.
- Opportunity URLs always point to the official page so the user can check the primary source.
- Disclaimer: earnings estimates are for reference only. Always check the official terms before deciding.

---

## 10. Deployment and repository
- Public GitHub repository `money-router`, MIT License (shown in the About box).
- Render: Web Service (API + static SPA), Cron Job (crawler, daily), Disk (JSON persistence). *As built: VPS + Nginx + Cloudflare + PM2.*
- README: overview, architecture diagram, setup (create a PayPal sandbox app → env → `npm run dev`), how to use `scripts/seed-payments.ts`, tools used (PayPal APIs, Claude, AG Grid, hosting).
- The commit history shows progress during the hackathon (the "meaningful progress" requirement for existing projects).

---

## 11. Submission checklist
- [ ] Working hosted demo URL
- [ ] Public GitHub repository with a license
- [ ] YouTube video under 3 minutes (no trademarked logos or copyrighted music; check the rules on PayPal logos)
- [ ] English description (problem, audience, how PayPal and AI are used, tools used)
- [ ] Tools used stated (PayPal Transaction Search / Invoicing / Payouts, Claude API, AG Grid, hosting)

---

## 12. Acceptance criteria
1. After a crawl, opportunities.json contains only PayPal-payable opportunities, structured.
2. Sources without PayPal are excluded automatically and the reason is recorded in status.
3. Every opportunity has a legitimacy score; those below the threshold are excluded from "For you".
4. Changing the profile updates exclusions, scores and "this week".
5. After seed-payments, PayPal sync fetches the payments and matches them to opportunities.
6. After a payment is confirmed, the observed columns and ranking of that opportunity change.
7. An invoice draft is created in the PayPal sandbox and can be sent.
8. API, SPA and scheduled crawl run on the host, and a third party can reproduce the setup from the README.

---

## 13. Schedule (deadline 11/12 PST)
| Week | Work |
|---|---|
| 10/3–10/6 | Repository, PayPal sandbox app, skeleton (API/SPA/hosting), data model |
| 10/7–10/13 | Discover: crawler + AI extraction + legitimacy score, first 30 sources |
| 10/14–10/20 | Route: exclusions, score, "this week", AG Grid screens |
| 10/21–10/27 | Track: Transaction Search sync + AI matching, seed script, Invoicing |
| 10/28–11/3 | Finishing: Agent Toolkit chat (optional), README, English submission text |
| 11/4–11/9 | Video recording and editing, third-party reproduction test, submission |
| 11/10–11/12 | Buffer |

Note: this ran in parallel with another hackathon (deadline 10/30), so 10/21–10/30 was expected to be light.

---

## 14. v1.1 and later
- Discovering new sources by open search (search API + AI audit)
- Multi-user accounts with Log In with PayPal (Connect with PayPal)
- Notifications (deadlines, new high-value opportunities, late payments)
- Bring back Japanese bank campaigns (v0.6.0's domain) as a Discover category (with AI extraction)
- Contest expected-value correction (acceptance rate), deadline reminders, regular crawling of multilingual contest sites (Korea, China, Europe)
