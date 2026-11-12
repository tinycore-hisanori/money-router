# Money Router — Devpost submission (PayPal AI Hackathon)

Paste each section into the matching Devpost field. Japanese notes for the author are at the end.

---

## Project name
Money Router

## Tagline (≤ 60 chars)
An AI radar for PayPal-payable work, worldwide

## Links
- Live demo: https://money-router.kitakuarcade.com
- Code (MIT): https://github.com/tinycore-hisanori/money-router
- Video: <YouTube URL>

---

## Inspiration
Small, legitimate ways to earn online are scattered across hundreds of sites: user-testing panels, bug bounties, freelance marketplaces, game portals, hackathons and game jams. Each has its own country rules, payout thresholds and payout methods, and plenty of them are thin, slow to pay, or quietly closed to most of the world. Finding the few that fit *you* — and that actually pay out to PayPal — takes hours of reading terms of service.

We wanted a tool that does that reading for us, tells us honestly what is worth our week, and then checks the result against real money arriving in PayPal.

## What it does
Money Router collects money-making opportunities from all over the world, has AI vet them, routes the best ones to you, and verifies the outcome against your PayPal account.

1. **Collect** — a crawler visits 50+ sources (Devpost, itch.io jams, UserTesting, Prolific, HackerOne, Upwork, Fiverr, GamePix…) plus an *Event Radar* that searches in English, Japanese, Korean and Chinese for one-off contests. Claude extracts each opportunity into a structured record: reward, payout methods, minimum payout, countries, deadline, required skills. **Anything that cannot pay out to PayPal is rejected**, and the reason is shown.
2. **Vet** — a second AI pass scores legitimacy (0–100) and records *payment-risk findings* separately from that score: first edition with no payout history, prize pool "targeted" rather than locked, eligibility rules missing, and so on. A finding at warning level automatically demotes the opportunity from "fixed" to "if it works out". Contest prizes are never counted as money you can count on.
3. **Route** — your profile (country, skills, hours per week) filters out what you cannot do and ranks the rest by expected dollars per hour × certainty × legitimacy × payout speed. Each item gets two plain ratings: *Easy* and *Payoff*. The dashboard proposes a weekly route that fits your hours.
4. **Track** — press **+ Pick** and the opportunity becomes yours: deadlines with day counts, what you plan to submit, a weekly hours budget, and a status flow (to do → in progress → submitted / work done → won → paid, plus give up and pick again, with one-click undo).
5. **Verify with PayPal** — Money Router reads incoming transactions with the PayPal Transaction Search API and has Claude match each payment to the opportunity it came from (items you won or submitted are preferred candidates). A matched payment moves the item to *paid* and its observed payout history feeds back into the ranking. Every brief, finding and summary is localized into the viewer's language (English / Japanese).

## How we built it
- **TypeScript end to end**: Hono API on Node 20, React 18 + Vite front end, AG Grid for the table view, JSON-file storage per user.
- **Claude API with structured outputs** (`output_config.format` JSON schema) for extraction, legitimacy audit, payment-risk findings, localization, payment matching and plan explanations. Models are configured per stage; audits run on a weekly schedule (full re-audit on two days, diff-only otherwise) to keep cost bounded.
- **Brave Search API** for fallback page discovery, official-rules lookup, complaint search ("never paid", "scam") and the multilingual Event Radar.
- **PayPal REST APIs (sandbox)**: Transaction Search (incoming payments), Invoicing v2 (bill a client for completed work), and Payouts v1 (used to seed realistic incoming payments from a second sandbox account).
- **Deterministic where it matters**: date ranges from listing APIs are parsed in code, not by the model; opportunity ids are derived from URLs so your picks and notes survive re-crawls; the route score and the Easy/Payoff ratings are plain formulas.
- Hosted on a small VPS behind Nginx + Cloudflare; the crawler runs in-process on a schedule, long jobs run in the background and the UI polls them.

## Challenges we ran into
- **"Worldwide" is usually not stated.** Early versions guessed. We now distinguish *stated worldwide* from *not stated*, and only official rules count as verified eligibility.
- **Hackathon prizes are not income.** A $25,000 prize pool made the weekly forecast absurd. Prizes are now always "if it works out" and kept out of the expected total.
- **Models rename things.** The same opportunity came back as "Upwork Freelancers" and "Upwork Freelancer Contracts (PayPal withdrawal)", silently orphaning the user's status. Ids are now URL-based, and when an id still changes the crawler moves every user's state to the successor.
- **Large JSON listings** overflowed the model's output; we compact listing APIs into a few lines per item before extraction.
- **A shared demo** — we gave each judge key its own server-side user so testers never overwrite each other.

## Accomplishments that we're proud of
- It refuses to oversell. Speculative money, unverified eligibility and payout risks are labelled in plain words.
- The full loop works end to end: find → vet → pick → submit → win → PayPal payment matched → paid.
- It caught a real payment-risk case on its own: a first-edition game jam whose PayPal prize pool was only a "target" was demoted with the reasons spelled out.

## What we learned
Structured outputs make extraction reliable, but the trustworthy parts of the product are the deterministic guard rails around the model: what counts as verified, what counts as income, and what identity an item keeps.

## What's next for Money Router
- **Log In with PayPal** as the account system: per-user data synced across devices, and the PayPal email used directly for payment matching.
- **Paid tier** for the costly AI features (AI source discovery, Event Radar, daily re-audits); the free tier keeps search, vetting results and tracking.
- Live-mode PayPal after review, more regional sources, and a weekly e-mail of new opportunities that fit your profile.

## Built with
TypeScript, Node.js, Hono, React, Vite, AG Grid, Claude API (Anthropic), Brave Search API, PayPal REST APIs (Transaction Search, Invoicing, Payouts — sandbox), Nginx, Cloudflare, PM2

---

## Testing instructions (private field for judges)
Open one of these links — each one signs you in as your own user (separate profile, picks and notes, stored on the server, works on phone and PC):

- Judge A: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #1>
- Judge B: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #2>
- Judge C: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #3>
- Judge D: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #4>

Suggested path (5 minutes):
1. Answer the profile questionnaire (country, what you can do, hours per week). The UI language switch is at the top right (EN / 日本語).
2. **Dashboard** shows a suggested weekly route. Click any card for the AI brief, payment-risk findings, eligibility and legitimacy score.
3. Press **+ Pick** on two or three items. They become "My picks" with deadlines, an hours budget and a status flow. Try "✓ Submitted" / "✓ Work done", "Give up" / "Pick again", and the Undo bar.
4. **Payments** → *Sync PayPal* pulls sandbox transactions and Claude matches them to opportunities. Mark a submitted contest as Won, then *Check PayPal*: a matched payment moves it to Paid.
5. **Opportunities** → *All* shows rejected and excluded items with the reason. *Overpowered Studios Game Jam #1* is a good example of a demoted item.
6. **Sources** lists every crawled source with what was kept and why others were rejected.

PayPal runs in sandbox mode. No real money moves.

---

## 日本語メモ（作者用）
- 各見出しを Devpost の同名欄に貼る。「Testing instructions」は非公開欄。`<JUDGE_TOKENS #n>` を VPS の `.env` の `JUDGE_TOKENS=` の値（カンマ区切りの4つ）に置き換える。
- 「It caught a real payment-risk case」はライブデータで Overpowered の所見が出ていることを前提にしている。出ていなければその行を消す。
- 「What's next」の PayPal ログインと課金枠は、今日決めた方針（無料=閲覧と追跡、課金=同期とAI探索）をそのまま書いた。
