// Check a sandbox payout batch sent by `npm run seed:payments`.
// Usage: npm run payout:status -- <batch id>
import { getPayoutBatch } from '../src/server/lib/paypal.js';

const id = process.argv[2];
if (!id) throw new Error('usage: npm run payout:status -- <batch id>');
const b = await getPayoutBatch(id);
console.log('batch:', b.batch_header?.batch_status);
for (const i of b.items ?? []) console.log(' ', i.transaction_status, i.payout_item?.amount?.value, i.payout_item?.receiver, i.errors?.name ?? '');
