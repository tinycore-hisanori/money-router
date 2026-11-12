import { config } from './config.js';
import type { Payment } from '../../shared/types.js';

const BASE = 'https://api-m.sandbox.paypal.com';

type Cred = 'main' | 'seed';
const tokens: Record<Cred, { value: string; exp: number } | null> = { main: null, seed: null };

export const paypalAvailable = () => Boolean(config.paypal.clientId && config.paypal.clientSecret);
export const seedAvailable = () => Boolean(config.paypal.seedClientId && config.paypal.seedClientSecret);

async function accessToken(cred: Cred = 'main'): Promise<string> {
  const t = tokens[cred];
  if (t && t.exp > Date.now() + 60_000) return t.value;
  const id = cred === 'main' ? config.paypal.clientId : config.paypal.seedClientId;
  const secret = cred === 'main' ? config.paypal.clientSecret : config.paypal.seedClientSecret;
  if (!id || !secret) throw new Error(cred === 'main' ? 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set' : 'PAYPAL_SEED_CLIENT_ID / PAYPAL_SEED_CLIENT_SECRET not set');
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokens[cred] = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function api<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, cred: Cred = 'main'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(cred)}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status}: ${txt}`);
  return (txt ? JSON.parse(txt) : {}) as T;
}

/**
 * Transaction Search API: incoming payments for the last `days` days.
 * https://developer.paypal.com/docs/api/transaction-search/v1/
 * Note: sandbox data can lag a few minutes; max window per call is 31 days.
 */
export async function listIncomingTransactions(days = 30): Promise<Payment[]> {
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(days, 31) * 86_400_000);
  const qs = new URLSearchParams({
    start_date: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    end_date: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    fields: 'transaction_info,payer_info',
    page_size: '100',
    transaction_status: 'S',
  });
  const j = await api<any>('GET', `/v1/reporting/transactions?${qs}`);
  const out: Payment[] = [];
  for (const t of j.transaction_details ?? []) {
    const info = t.transaction_info ?? {};
    const amt = Number(info.transaction_amount?.value ?? 0);
    if (amt <= 0) continue; // only money received
    const payer = t.payer_info ?? {};
    out.push({
      transaction_id: info.transaction_id,
      amount: amt,
      currency: info.transaction_amount?.currency_code ?? 'USD',
      date: info.transaction_initiation_date,
      payer_name: payer.payer_name?.alternate_full_name ?? payer.payer_name?.given_name ?? '',
      payer_email: payer.email_address ?? '',
      note: info.transaction_note ?? '',
      subject: info.transaction_subject ?? '',
      matched_opportunity_id: null,
      match_confidence: 0,
      match_status: 'unmatched',
    });
  }
  return out;
}

/** Invoicing v2: create a draft invoice. Returns the invoice id and view link. */
export interface InvoiceDraftInput {
  recipient_email: string;
  recipient_name?: string;
  currency: string;
  items: { name: string; description?: string; quantity: number; unit_amount: number }[];
  note?: string;
  reference?: string;
}

export async function createInvoiceDraft(input: InvoiceDraftInput): Promise<{ id: string; href: string }> {
  const body = {
    detail: {
      currency_code: input.currency,
      note: input.note,
      reference: input.reference,
      payment_term: { term_type: 'NET_30' },
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: input.recipient_email,
          name: input.recipient_name ? { full_name: input.recipient_name } : undefined,
        },
      },
    ],
    items: input.items.map((i) => ({
      name: i.name,
      description: i.description,
      quantity: String(i.quantity),
      unit_amount: { currency_code: input.currency, value: i.unit_amount.toFixed(2) },
    })),
  };
  const j = await api<any>('POST', '/v2/invoicing/invoices', body, { Prefer: 'return=representation' });
  const id = j.id as string;
  const href = (j.links ?? []).find((l: any) => l.rel === 'self')?.href ?? '';
  return { id, href };
}

export async function sendInvoice(id: string): Promise<void> {
  await api('POST', `/v2/invoicing/invoices/${id}/send`, { send_to_recipient: true, send_to_invoicer: false });
}

export async function getInvoice(id: string): Promise<any> {
  return api('GET', `/v2/invoicing/invoices/${id}`);
}

/**
 * Payouts v1 — used only by scripts/seed-payments.ts to simulate platform
 * payouts into the receiver sandbox account for demos. Sent from the SEED
 * credentials (account B), since PayPal rejects self-to-self payouts.
 */
export async function createPayout(items: { email: string; amount: number; currency: string; note: string; sender_item_id: string }[]) {
  const body = {
    sender_batch_header: {
      sender_batch_id: `mr_${Date.now()}`,
      email_subject: 'Money Router demo payout',
    },
    items: items.map((i) => ({
      recipient_type: 'EMAIL',
      receiver: i.email,
      amount: { value: i.amount.toFixed(2), currency: i.currency },
      note: i.note,
      sender_item_id: i.sender_item_id,
    })),
  };
  return api<any>('POST', '/v1/payments/payouts', body, {}, 'seed');
}

/** Payouts v1: status of a payout batch sent from the seed account (B). */
export async function getPayoutBatch(batchId: string) {
  return api<any>('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}`, undefined, {}, 'seed');
}
