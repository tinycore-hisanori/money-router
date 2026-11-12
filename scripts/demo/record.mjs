// Records the Money Router demo: a real browser session against a local copy of the live data,
// with an on-screen cursor and English captions. Output: video.webm in OUT dir.
import { chromium } from '/home/claude/money-router/node_modules/playwright/index.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3457';
const OUT = process.env.OUT ?? '/tmp/claude-0/rec/out';
const W = 1280, H = 720;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: 'light' });
await ctx.addInitScript(() => {
  try { localStorage.setItem('mr-lang', 'en'); localStorage.setItem('mr-theme', 'light'); } catch {}
  const boot = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;transition:transform .04s linear';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 9-6.5 1.5L8 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', () => { c.firstChild.style.transform = 'scale(.8)'; }, true);
    addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
    const cap = document.createElement('div'); cap.id = '__cap';
    cap.style.cssText = 'position:fixed;z-index:99998;left:50%;bottom:26px;transform:translateX(-50%);max-width:1080px;padding:12px 22px;border-radius:12px;background:rgba(12,20,36,.88);color:#fff;font:600 21px/1.4 "Bricolage Grotesque",system-ui,sans-serif;text-align:center;pointer-events:none;opacity:0;transition:opacity .35s';
    document.body.appendChild(cap);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
});
import fs from 'node:fs';
await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: fs.readFileSync('/tmp/claude-0/rec/fonts.css', 'utf8') }));
await ctx.route('**/__fonts/**', (r) => { const f = '/tmp/claude-0/rec/fonts/node_modules/' + new URL(r.request().url()).pathname.replace('/__fonts/', ''); r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(f) }); });
await ctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
const p = await ctx.newPage();
p.on('response', (r) => { if (/\/api\/(paypal|execution)/.test(r.url())) console.log('api', r.status(), r.request().method(), r.url().replace(/^.*\/api/, '')); });
const sleep = (ms) => p.waitForTimeout(ms);
// Screen recording via the DevTools screencast: every frame is saved with its timestamp, then ffmpeg builds the video.
fs.mkdirSync(OUT + '/frames', { recursive: true });
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  const n = frames.length;
  fs.writeFileSync(`${OUT}/frames/${String(n).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  frames.push(f.metadata.timestamp);
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
let CLIPS = {}; try { CLIPS = JSON.parse(fs.readFileSync(process.env.CLIPS ?? 'scripts/demo/tts/clips.json', 'utf8')); } catch {} // optional narration timings from tts.py
const capLog = []; let speechEnd = 0;
const caption = async (text, ms = 0) => {
  const now = Date.now() / 1000;
  if (speechEnd > now) await p.waitForTimeout(Math.round((speechEnd - now) * 1000));
  if (text && CLIPS[text]) { const t = Date.now() / 1000; capLog.push({ t, file: CLIPS[text].file }); speechEnd = t + CLIPS[text].dur + 0.35; }
  await p.evaluate((t) => { const c = document.getElementById('__cap'); if (!c) return; c.textContent = t; c.style.opacity = t ? '1' : '0'; }, text);
  if (ms) await sleep(ms);
};
let cx = 640, cy = 360;
const moveTo = async (x, y, steps = 18) => { await p.mouse.move(x, y, { steps }); cx = x; cy = y; };
const moveToEl = async (loc) => {
  if (!(await loc.count())) return null; loc = loc.first(); await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); await moveTo(bb.x + Math.min(bb.width / 2, 120), bb.y + bb.height / 2); return bb; };
const has = async (loc) => (await loc.count()) > 0;
const click = async (loc, pause = 500) => {
  if (!(await has(loc))) { console.log('skip (not found):', loc.toString().slice(0, 140)); return; }
  loc = loc.first(); await moveToEl(loc);
  let bb0 = await loc.boundingBox();
  if (bb0 && bb0.y < 70) { await p.mouse.wheel(0, bb0.y - 160); await sleep(250); } // keep targets clear of the sticky header
  const bb = await loc.boundingBox(); if (bb) await moveTo(bb.x + Math.min(bb.width / 2, 120), bb.y + bb.height / 2, 4); // re-aim if the layout moved
  await sleep(160); await p.mouse.down(); await sleep(80); await p.mouse.up();
  await p.waitForLoadState('networkidle').catch(() => {}); await sleep(pause); };
const scroll = async (dy, ms = 900) => { const n = 8; for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy / n); await sleep(ms / n); } };
const goto = async (url) => { await p.goto(url); await sleep(1400); await p.mouse.move(cx, cy); };
const nav = (name) => p.locator('header nav button', { hasText: name });
const goNav = async (name, pause = 900) => { await click(nav(name), 300); await p.evaluate(() => scrollTo(0, 0)); await sleep(pause); };

// 1. Hook — the public demo board
await goto(`${BASE}/`);
await caption('Small, legitimate ways to earn online are scattered across hundreds of sites — and many never pay out to you.', 5000);
await caption('Money Router collects them worldwide, has AI vet them, and routes the ones that pay out to PayPal to you.', 5000);

// 2. Collect — sources
await goNav('Sources', 900);
await caption('A crawler reads 50+ sources — Devpost, itch.io, UserTesting, HackerOne, Upwork — plus a multilingual radar for one-off contests.', 4500);
await scroll(520, 1400);
await caption('Claude extracts each opportunity. Anything that cannot pay out to PayPal is rejected — with the reason.', 5000);

// 3. Vet — a payment-risk case
await goNav('Opportunities', 900);
await click(p.getByRole('button', { name: 'All', exact: true }), 700);
await p.locator('input[type=search]').click(); await p.keyboard.type('Overpowered', { delay: 45 }); await sleep(500);
await caption('Every item gets a legitimacy score — and, separately, payment-risk findings.', 2500);
await click(p.locator('.orow').first(), 1200);
await caption('This first-edition jam only "targets" its PayPal prize pool and states no eligibility rules → demoted to "if it works out".', 5000);
await moveToEl(p.locator('.box.risk').first()); await sleep(900);
await p.locator('.modal').hover(); await p.mouse.wheel(0, 380); await sleep(1600);
await caption('Contest prizes are never counted as money you can count on.', 3500);
await p.keyboard.press('Escape'); await sleep(400);

// 4. Route — sign in as a judge and answer the questionnaire
await caption('Sign in with your key — each key is its own user, synced across devices.', 3500);
await goto(`${BASE}/?key=j1`);
await caption('Tell it where you live, what you can do, and how many hours you have.', 2000);
const boxes = p.locator('label:has(input[type=checkbox])');
for (const name of [/web/i, /with AI/i, /English/i]) { const l = boxes.filter({ hasText: name }).first(); if (await l.count()) await click(l, 350); }
await click(p.getByRole('button', { name: /Save/ }).first(), 1600);
await goNav('Dashboard', 1500);
await caption('Your profile filters out what you cannot do; the rest is ranked by $/hour × certainty × legitimacy, with two plain ratings: Easy and Payoff.', 5500);
await moveToEl(p.locator('.route .stop').first()); await sleep(800);
await moveToEl(p.locator('.route .stop').nth(1)); await sleep(800);

// 5. Track — pick, plan, submit, give up, undo
await caption('Pick what you will actually do.', 600);
await goNav('Opportunities', 900);
const search = p.locator('input[type=search]');
for (const name of ['PayPal AI', 'PlaytestCloud', 'Upwork']) {
  await click(search, 150); await p.keyboard.press('Control+A'); await p.keyboard.type(name, { delay: 40 }); await sleep(600);
  await click(p.locator('.orow').first().getByRole('button', { name: '+ Pick' }), 1200);
  await p.waitForLoadState('networkidle');
}
await click(search, 150); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); await sleep(300);
await click(p.getByRole('button', { name: /My picks/ }), 1800);
await goNav('Dashboard', 1600);
await p.evaluate(() => scrollTo(0, 0)); await sleep(500);
await caption('Deadlines count down, you note what you will submit, and the hours bar shows when you over-commit.', 1500);
const card = (t) => p.locator('.route .stop', { hasText: t }).first();
const idea = card('PayPal AI').locator('.stop-idea input');
if (await idea.count()) { await click(idea, 200); await p.keyboard.type('Money Router demo + repo', { delay: 40 }); await p.keyboard.press('Enter'); await sleep(900); }
await moveToEl(p.locator('.budget')); await sleep(1400);
await caption('Submit, finish, give up, change your mind — one click each, and every change can be undone.', 800);
await click(card('PlaytestCloud').getByRole('button', { name: /Work done/ }), 1800);
await click(card('PayPal AI').getByRole('button', { name: /Submitted/ }), 1800);
await click(card('Upwork').getByRole('button', { name: 'Give up' }), 1800);
await click(p.getByRole('button', { name: 'Undo' }), 2000);
await caption('', 0);

// 6. Verify with PayPal
await goNav('Payments', 900);
await caption('Then the part that keeps it honest: read incoming PayPal transactions (sandbox)…', 600);
await click(p.getByRole('button', { name: /Sync PayPal/ }), 2600);
console.log('state after sync:', await p.evaluate(async () => (await (await fetch('/api/route', { headers: { 'x-admin-token': localStorage.getItem('mr_admin_token') || '' } })).json()).filter((r) => r.execution).map((r) => r.opportunity.name.slice(0, 20) + ':' + r.execution).join(', ')));
await caption('…and match each payment to the opportunity it came from.', 4500);
await goNav('Dashboard', 1300);
await caption('The PlaytestCloud payment matched the work you marked done — so it is now Paid, and feeds real payout history back into the ranking.', 1500);
const rec = p.locator('.card', { hasText: 'Track record' }).first();
if (await rec.count()) { await moveToEl(rec); await sleep(4500); }
const res = p.locator('.card', { hasText: 'Submitted / done' }).first();
if (await res.count()) { await moveToEl(res.getByRole('button', { name: /Won/ }).first()); await caption('Win a contest and its prize payout is matched the same way.', 1200); await click(res.getByRole('button', { name: /Won/ }).first(), 1600); }

// 7. Close
await p.evaluate(() => scrollTo(0, 0)); await sleep(400);
await caption('Everything is localized into the viewer\'s language.', 600);
await click(p.locator('.top-right .icon-btn', { hasText: '日本語' }), 2200);
await click(p.locator('.top-right .icon-btn', { hasText: 'EN' }), 1200);
await caption('Next: Log In with PayPal and synced accounts.   Money Router — an AI radar for PayPal-payable work, worldwide.', 6000);
await caption('', 300);

{ const r = speechEnd - Date.now() / 1000; if (r > 0) await sleep(Math.round(r * 1000)); }
await sleep(600);
await cdp.send('Page.stopScreencast');
fs.writeFileSync(OUT + '/captions.json', JSON.stringify(capLog.map((c) => ({ ...c, t: c.t - frames[0] }))));
// ffmpeg concat list: each frame shown until the next one arrived
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1] - frames[i]) : 1;
  lines.push(`file 'frames/${String(i).padStart(6, '0')}.jpg'`, `duration ${d.toFixed(3)}`);
}
lines.push(`file 'frames/${String(frames.length - 1).padStart(6, '0')}.jpg'`);
fs.writeFileSync(OUT + '/list.txt', lines.join('\n'));
console.log('frames:', frames.length, 'seconds:', (frames.at(-1) - frames[0]).toFixed(1));
await ctx.close(); await b.close();
