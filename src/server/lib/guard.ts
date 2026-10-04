// Daily allowance for AI-costing actions when the caller is not the admin.
// Counters live in data/runtime/usage.json so they survive restarts.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { config } from './config.js';

type Kind = 'discovery' | 'briefs' | 'crawls';
const LIMITS: Record<Kind, () => number> = {
  discovery: () => config.guards.dailyDiscovery,
  briefs: () => config.guards.dailyBriefs,
  crawls: () => config.guards.dailyCrawls,
};
const file = () => path.join(config.dataDir, 'usage.json');
const today = () => new Date().toISOString().slice(0, 10);

async function load(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    return {};
  }
}

export function isAdmin(c: Context): boolean {
  const t = c.req.header('x-admin-token') ?? c.req.query('token') ?? '';
  return Boolean(config.guards.adminToken) && t === config.guards.adminToken;
}

/** Returns null when allowed (and consumes one unit), or a JSON-able refusal. */
export async function consume(c: Context, kind: Kind): Promise<null | { error: string; remaining: number; limit: number }> {
  if (isAdmin(c)) return null;
  const limit = LIMITS[kind]();
  const key = `${today()}:${kind}`;
  const usage = await load();
  const used = usage[key] ?? 0;
  if (used >= limit) return { error: 'demo_limit', remaining: 0, limit };
  usage[key] = used + 1;
  // keep only today's keys
  const pruned = Object.fromEntries(Object.entries(usage).filter(([k]) => k.startsWith(today())));
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(file(), JSON.stringify(pruned));
  return null;
}

export async function remaining(kind: Kind): Promise<{ remaining: number; limit: number }> {
  const limit = LIMITS[kind]();
  const usage = await load();
  return { remaining: Math.max(0, limit - (usage[`${today()}:${kind}`] ?? 0)), limit };
}
