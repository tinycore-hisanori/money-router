# Money Router — 3-minute demo video script

Record in English UI (top right: EN). Screen recording + voice (or captions). Target 2:45, hard limit 3:00.
Before recording: sign in with a fresh judge key, answer the questionnaire as a US developer (web dev, AI, English, 10 h/week), and run `npm run seed:payments` on the server so PayPal has sandbox transactions.

| Time | Screen | Narration (English) | 日本語メモ |
|---|---|---|---|
| 0:00–0:15 | Dashboard top: "About $… expected this week" | "Small, legitimate ways to earn online are scattered across hundreds of sites, and most of them won't pay you. Money Router collects them from all over the world, has AI vet them, and routes the ones that pay out to PayPal to you." | 一言で何か |
| 0:15–0:35 | Sources tab: 52 sources, kept / rejected with reasons | "A crawler reads 50-plus sources — Devpost, itch.io, UserTesting, HackerOne, Upwork — plus a multilingual radar for one-off contests. Claude extracts each opportunity, and anything that can't pay out to PayPal is rejected, with the reason." | 却下理由の列を映す |
| 0:35–1:05 | Opportunities → click "Overpowered Studios Game Jam #1" | "Each item gets a legitimacy score and, separately, payment-risk findings. This first-edition jam only *targets* its prize pool and states no eligibility rules — so it's demoted to 'if it works out' and kept out of the money you can count on." | 所見（⚠/△）と格下げを映す |
| 1:05–1:30 | Profile questionnaire → back to Dashboard route | "Your profile — country, skills, hours — filters out what you can't do. The rest is ranked by expected dollars per hour, certainty and legitimacy, with two plain ratings: Easy and Payoff. The dashboard fits a weekly route into your hours." | ★楽／お得 |
| 1:30–1:55 | Press "+ Pick" on a hackathon and a user-testing job; type "What to submit"; hours bar | "Pick what you'll actually do. Deadlines count down, you note what you'll submit, and the hours bar tells you when you've over-committed." | 自分の案件 |
| 1:55–2:15 | "✓ Submitted" → "Won"; "Give up" → "Pick again"; Undo bar | "Submit, win, give up, change your mind — every step is one click, and every change can be undone." | 戻せることを見せる |
| 2:15–2:40 | Payments tab: Sync PayPal → matched rows; Dashboard "Won → Check PayPal" → Paid, Track record | "Then the part that keeps it honest: Money Router reads incoming PayPal transactions and Claude matches each payment to the opportunity it came from. A matched payment marks it paid and feeds real payout history back into the ranking." | PayPal照合が肝 |
| 2:40–2:55 | Language switch EN ⇄ 日本語; footer | "Everything is localized into the viewer's language. Next: Log In with PayPal and synced accounts. Money Router — an AI radar for PayPal-payable work, worldwide." | 締め |

## Recording tips
- 1280×800 browser window, zoom 100 %, dark or light theme (pick one and keep it).
- Close the Undo bar before moving to the next scene so it does not cover cards.
- If a brief is still generating, cut that wait in editing.
- Upload to YouTube as *Unlisted* or *Public* (Devpost requires a public or unlisted link), title: "Money Router — PayPal AI Hackathon demo".
