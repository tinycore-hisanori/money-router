# Money Router

**AI-curated global earning opportunities, paid out via PayPal — discovered, routed to you, and verified against your real PayPal transactions.**

> Entry for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) (Devpost, 2026). Status: **alpha** — skeleton with mock data; live crawler, PayPal sync and invoicing are wired but need credentials.

## The problem

Independent creators, developers and freelancers get paid through dozens of small channels — game portals, bounty programs, marketplaces, testing panels. Many of them pay out via PayPal, but:

- they are scattered and hard to compare (payout minimums, cycles, country rules, required skills),
- the space is full of scams and "never actually pays" offers,
- nobody tracks which channel really paid how much, so the next decision is a guess.

## What Money Router does

| Pillar | What happens | AI | PayPal |
|---|---|---|---|
| **Discover** | A daily crawler reads each registered platform's public payout page, extracts structured terms, and keeps **only PayPal-payable** opportunities. Each one gets a calibrated **legitimacy score** with notes. | Structured extraction (tool-use JSON schema) + legitimacy audit, with per-weekday model rotation | — |
| **Route** | Your country, skills, weekly hours and existing accounts turn the catalog into a ranked list with explicit *why-not* reasons, and a greedy **"this week" plan** within your hours budget. | Profile parsing from free text; plain-English "why / first step" per item | — |
| **Track** | Pull incoming payments with the **Transaction Search API**, let AI match them to opportunities (payer names rarely equal brand names), and feed **verified income** back into the ranking. Draft and send invoices via the **Invoicing API**. | Payment ↔ opportunity reconciliation | Transaction Search, Invoicing, Payouts (demo seeding) |

Opportunities that were recommended but never paid sink in the ranking. The tool measures its own usefulness.

## Architecture

```
Browser SPA (React + AG Grid Community)
        │
        ▼
Hono API (Node/TypeScript)                       PayPal Sandbox
  /api/route, /api/plan, /api/profile     ◄────► Transaction Search v1
  /api/paypal/sync, /api/paypal/invoice   ◄────► Invoicing v2, Payouts v1
  /api/crawl (+ in-process daily scheduler)
        │
        ▼
Crawler: fetch → sha256 diff → extract (Claude) → audit (Claude, AUDIT_SCHEDULE) → merge
        │
        ▼
data/runtime/*.json  (tmp+rename writes; Render Disk in production)
```

### Model routing (`.env`)

Every AI step is a model ID string, so swapping in a newer model is a one-line change.

```env
MODEL_EXTRACT=claude-sonnet-5-5      # page -> structured JSON (only when a page changed)
MODEL_AUDIT=claude-sonnet-5-5        # legitimacy score (only when a page changed)
MODEL_MATCH=claude-opus-5-5          # PayPal payment <-> opportunity matching
MODEL_EXPLAIN=claude-opus-5-5        # weekly plan explanations
# Weekday audit schedule: <dow>:<model>:<full|diff>. "full" re-audits every active
# opportunity regardless of page changes (catches drift toward scam / worse terms).
AUDIT_SCHEDULE=mon:claude-fable-5-1:full,thu:claude-opus-5-5:full
```

Scores record `scored_by` / `scored_at` / `mode`; the UI marks diff-mode and seed scores as provisional (`*`) rather than averaging across models.

## Run it

Requirements: Node 20+.

```bash
git clone https://github.com/tinycore-hisanori/money-router
cd money-router
npm install            # also installs client/
cp .env.example .env   # fill in keys below (optional for mock mode)
npm run dev            # API on :3000, Vite dev server on :5173 (proxies /api)
```

Open http://localhost:5173. With no keys set, the app runs on **mock data** (`data/opportunities.seed.json`); routing, plans, exclusions and execution tracking all work. The header shows which capabilities are live.

### Enable AI (Claude)

Set `ANTHROPIC_API_KEY` and `CRAWLER_MODE=live`, then:

```bash
npm run crawl          # or click "Run crawler now" in Opportunities
```

### Enable PayPal (sandbox only)

Two sandbox Business accounts play two roles:

| | Role | App | `.env` |
|---|---|---|---|
| **A** | The Money Router user (receives money) | `Money Router` | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_RECEIVER_EMAIL` = A's email |
| **B** | Demo payer pretending to be CrazyGames, itch.io… | `Money Router Seeder` | `PAYPAL_SEED_CLIENT_ID`, `PAYPAL_SEED_CLIENT_SECRET` |

1. https://developer.paypal.com → Apps & Credentials (Sandbox) → Create App `Money Router`, type Merchant, owned by account A (the auto-created Business account is fine).
2. Testing Tools → Sandbox Accounts → Create a second **Business** account (US). Create App `Money Router Seeder` owned by it.
3. Seed demo payouts from B to A, then sync:

```bash
npm run seed:payments   # Payouts API: simulated platform payments into the receiver account
# wait a minute, then in the UI: Payments -> "Sync PayPal"
```

`PAYPAL_ENV` is hard-locked to `sandbox`; the server refuses to start otherwise.

### Production build

```bash
npm run build && npm start   # serves API + built SPA from one process
```

`render.yaml` deploys this as a single Render web service with a persistent disk; the crawler runs in-process daily at `CRAWL_HOUR_UTC`.

## Repository layout

```
src/shared/types.ts          data model (Opportunity, Source, UserProfile, Payment, …)
src/server/                  Hono API, route engine, PayPal client, AI steps
src/crawler/                 fetch / extract / audit pipeline
client/                      React + AG Grid SPA
data/source_registry.json    the ~30 platforms the crawler reads
data/opportunities.seed.json mock catalog (generated by scripts/make-seed.ts)
scripts/seed-payments.ts     PayPal Payouts demo seeding
docs/SPEC_v1.0.md            full specification (Japanese)
```

## Tools used

- **PayPal Developer Platform** — Transaction Search API, Invoicing API v2, Payouts API (sandbox)
- **Claude API** (Anthropic) — structured extraction, legitimacy audits, payment matching, plan explanations
- **AG Grid Community** — opportunity and payment grids
- **Render** — hosting (web service + disk)
- Hono, React, Vite, TypeScript

## Who pays for the AI?

The operator does, so costly actions are guarded:

- **Admin key** (`ADMIN_TOKEN`): entered once in the UI (🔑 in the header) — unlimited Discovery, crawls and briefs; may approve/reject discovered sources.
- **Judge key** (`JUDGE_TOKEN`, shared privately with hackathon judges): its own daily pool (`JUDGE_DAILY_DISCOVERY=10`, `JUDGE_DAILY_BRIEFS=200`, `JUDGE_DAILY_CRAWLS=5`) and may approve/reject, so the full discover → approve → crawl loop can be exercised.
- **Public allowance** per day (`DEMO_DAILY_DISCOVERY=3`, `DEMO_DAILY_BRIEFS=50`, `DEMO_DAILY_CRAWLS=1`): anyone can try a few times; after that the UI points to the demo video. Worst-case cost is bounded by these numbers.
- Routing, plans, the opportunity grid and PayPal sync cost nothing to view.

In a product, "AI Discovery" is the natural paid tier (e.g. N runs per month); browsing and routing stay free.

## Disclaimer

Earnings figures are estimates extracted from public pages and may be wrong or out of date. Always check the platform's own terms before committing time or money. Money Router never asks for or stores bank or card details.

## License

MIT — see [LICENSE](LICENSE).
