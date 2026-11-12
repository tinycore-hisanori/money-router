# Money Router — demo video (2:40)

Recorded automatically with `scripts/demo/record.mjs` (Playwright + DevTools screencast) against the live crawl data of 2026-11-12. Narration is synthesized (Kokoro TTS, voice `am_michael`) from the same lines as the on-screen captions, and each caption waits until its line has been spoken.

The PayPal scene replays the four real sandbox payouts ($142.30, $48.00, $27.00, $19.50 — batch `VDW23CN4GHX8Y`) through `PAYPAL_FIXTURE`, so the recording does not depend on Transaction Search latency. The recording machine had no Claude API key, so payment matching in the video uses the keyword fallback; the live site matches with Claude.

| Time | Narration / caption |
|---|---|
| 0:01 | Small, legitimate ways to earn online are scattered across hundreds of sites — and many never pay out to you. |
| 0:08 | Money Router collects them worldwide, has AI vet them, and routes the ones that pay out to PayPal to you. |
| 0:15 | A crawler reads 50+ sources — Devpost, itch.io, UserTesting, HackerOne, Upwork — plus a multilingual radar for one-off contests. |
| 0:25 | Claude extracts each opportunity. Anything that cannot pay out to PayPal is rejected — with the reason. |
| 0:35 | Every item gets a legitimacy score — and, separately, payment-risk findings. |
| 0:41 | This first-edition jam only "targets" its PayPal prize pool and states no eligibility rules → demoted to "if it works out". |
| 0:50 | Contest prizes are never counted as money you can count on. |
| 0:54 | Sign in with your key — each key is its own user, synced across devices. |
| 0:59 | Tell it where you live, what you can do, and how many hours you have. |
| 1:09 | Your profile filters out what you cannot do; the rest is ranked by $/hour × certainty × legitimacy, with two plain ratings: Easy and Payoff. |
| 1:20 | Pick what you will actually do. |
| 1:41 | Deadlines count down, you note what you will submit, and the hours bar shows when you over-commit. |
| 1:47 | Submit, finish, give up, change your mind — one click each, and every change can be undone. |
| 2:00 | Then the part that keeps it honest: read incoming PayPal transactions (sandbox)… |
| 2:06 | …and match each payment to the opportunity it came from. |
| 2:13 | The PlaytestCloud payment matched the work you marked done — so it is now Paid, and feeds real payout history back into the ranking. |
| 2:21 | Win a contest and its prize payout is matched the same way. |
| 2:25 | Everything is localized into the viewer's language. |
| 2:31 | Next: Log In with PayPal and synced accounts.   Money Router — an AI radar for PayPal-payable work, worldwide. |

## Upload
YouTube (unlisted or public), title: "Money Router — AI finds work that pays out to PayPal | PayPal AI Hackathon demo". Thumbnail: `docs/images/thumbnail.png`.
