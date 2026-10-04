// Daily allowance for AI-costing actions, by caller tier.
// admin: unlimited. judge: its own larger pool (and may change the registry). public: small pool.
// Counters live in data/runtime/usage.json so they survive restarts.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { config } from './config.js';

export type Kind = 'discovery' | 'briefs' | 'crawls';
export type Tier = 'admin' | 'judge' | 'public';

const file = () => path.join(config.dataDir, 'usage.json');
const today = () => new Date().toISOString().slice(0, 10);

async function load(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    return {};
  }
}

export function tierOf(c: Context): Tier {
  const t = c.req.header('x-admin-token') ?? c.req.query('token') ?? '';
  if (config.guards.adminToken && t === config.guards.adminToken) return 'admin';
  if (config.guards.judgeToken && t === config.guards.judgeToken) return 'judge';
  return 'public';
}
export const isAdmin = (c: Context) => tierOf(c) === 'admin';
/** May change the source registry (approve/reject discoveries). */
export const canCurate = (c: Context) => tierOf(c) !== 'public';

const limitFor = (tier: Tier, kind: Kind) => (tier === 'judge' ? config.guards.judge[kind] : config.guards.public[kind]);

/** Returns null when allowed (and consumes one unit), or a JSON-able refusal. */
export async function consume(c: Context, kind: Kind): Promise<null | { error: string; remaining: number; limit: number }> {
  const tier = tierOf(c);
  if (tier === 'admin') return null;
  const limit = limitFor(tier, kind);
  const key = `${today()}:${tier}:${kind}`;
  const usage = await load();
  const used = usage[key] ?? 0;
  if (used >= limit) return { error: 'demo_limit', remaining: 0, limit };
  usage[key] = used + 1;
  const pruned = Object.fromEntries(Object.entries(usage).filter(([k]) => k.startsWith(today())));
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(file(), JSON.stringify(pruned));
  return null;
}

export async function remaining(c: Context, kind: Kind): Promise<{ remaining: number; limit: number }> {
  const tier = tierOf(c);
  if (tier === 'admin') return { remaining: Infinity, limit: Infinity };
  const limit = limitFor(tier, kind);
  const usage = await load();
  return { remaining: Math.max(0, limit - (usage[`${today()}:${tier}:${kind}`] ?? 0)), limit };
}
