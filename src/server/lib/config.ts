import 'dotenv/config';
import path from 'node:path';

export type AuditMode = 'full' | 'diff';
export interface AuditPlan {
  model: string;
  mode: AuditMode;
}

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir: path.resolve(process.env.DATA_DIR ?? './data/runtime'),
  seedDir: path.resolve('./data'),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  models: {
    extract: process.env.MODEL_EXTRACT ?? 'claude-sonnet-5-5',
    audit: process.env.MODEL_AUDIT ?? 'claude-sonnet-5-5',
    match: process.env.MODEL_MATCH ?? 'claude-opus-5-5',
    explain: process.env.MODEL_EXPLAIN ?? 'claude-opus-5-5',
  },
  auditSchedule: parseAuditSchedule(process.env.AUDIT_SCHEDULE ?? ''),
  paypal: {
    env: (process.env.PAYPAL_ENV ?? 'sandbox') as 'sandbox',
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    receiverEmail: process.env.PAYPAL_RECEIVER_EMAIL ?? '',
  },
  crawler: {
    mode: (process.env.CRAWLER_MODE ?? 'mock') as 'mock' | 'live',
    hourUtc: process.env.CRAWL_HOUR_UTC === '' || process.env.CRAWL_HOUR_UTC === undefined ? null : Number(process.env.CRAWL_HOUR_UTC),
    token: process.env.CRAWL_TOKEN ?? '',
    userAgent:
      process.env.CRAWLER_USER_AGENT ??
      'MoneyRouterBot/1.0 (+https://github.com/tinycore-hisanori/money-router)',
  },
};

if (config.paypal.env !== 'sandbox') {
  // Hard guard: this project never talks to PayPal production.
  throw new Error('PAYPAL_ENV must be "sandbox"');
}

/**
 * Parse `mon:claude-fable-5-1:full,thu:claude-opus-5-5:full` into a weekday map.
 * Invalid entries are skipped with a warning rather than crashing the crawler.
 */
export function parseAuditSchedule(raw: string): Partial<Record<(typeof DOW)[number], AuditPlan>> {
  const out: Partial<Record<(typeof DOW)[number], AuditPlan>> = {};
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [dow, model, mode] = entry.split(':');
    const d = dow?.toLowerCase() as (typeof DOW)[number];
    if (!DOW.includes(d) || !model || (mode !== 'full' && mode !== 'diff')) {
      console.warn(`[config] ignoring invalid AUDIT_SCHEDULE entry: "${entry}"`);
      continue;
    }
    out[d] = { model, mode };
  }
  return out;
}

/** Resolve today's audit plan: scheduled entry, else default audit model in diff mode. */
export function auditPlanFor(date = new Date()): AuditPlan {
  const d = DOW[date.getUTCDay()];
  return config.auditSchedule[d] ?? { model: config.models.audit, mode: 'diff' };
}
