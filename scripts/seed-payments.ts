// Demo helper: simulate platform payouts into the receiver sandbox account using PayPal Payouts (sandbox).
// Usage: npm run seed:payments
// Requires PAYPAL_SEED_CLIENT_ID/SECRET (account B, the demo payer) and PAYPAL_RECEIVER_EMAIL (account A).
import { config } from '../src/server/lib/config.js';
import { createPayout } from '../src/server/lib/paypal.js';

const receiver = config.paypal.receiverEmail;
if (!receiver) throw new Error('PAYPAL_RECEIVER_EMAIL not set');

const items = [
  { note: 'CrazyGames revenue share - September', amount: 142.3 },
  { note: 'itch.io payout - game template sales', amount: 48.0 },
  { note: 'PlaytestCloud - 3 playtests', amount: 27.0 },
  { note: 'Gumroad weekly payout', amount: 19.5 },
].map((i, n) => ({ ...i, email: receiver, currency: 'USD', sender_item_id: `demo_${Date.now()}_${n}` }));

const r = await createPayout(items);
console.log('payout batch:', r.batch_header?.payout_batch_id, r.batch_header?.batch_status);
console.log('Sandbox payouts usually settle within a few minutes; then run POST /api/paypal/sync');
