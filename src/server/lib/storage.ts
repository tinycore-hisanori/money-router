import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import type { SourceCandidate } from '../../crawler/discover.js';
import type {
  CrawlStatus,
  ExecutionStatus,
  Opportunity,
  Payment,
  Source,
  UserProfile,
  OpportunityNote,
} from '../../shared/types.js';

/** JSON file store with tmp+rename writes (no partial files on crash). */
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (e: any) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

const runtime = (name: string) => path.join(config.dataDir, name);
const seed = (name: string) => path.join(config.seedDir, name);

// Hosted demo can start with a different default (e.g. DEFAULT_COUNTRY=US DEFAULT_LANGUAGE=en) so judges see a full dashboard.
const DEFAULT_PROFILE: UserProfile = {
  country: (process.env.DEFAULT_COUNTRY || 'JP').toUpperCase(),
  language: (process.env.DEFAULT_LANGUAGE || 'ja').toLowerCase(),
  skills: [],
  hours_per_week: 10,
  existing_accounts: [],
  free_text: '',
  paypal_email: '',
};

const EMPTY_STATUS: CrawlStatus = {
  last_run: null,
  mode: config.crawler.mode,
  audit_model: null,
  audit_mode: null,
  sources: {},
  totals: { opportunities: 0, active: 0, rejected_no_paypal: 0 },
};

/** Profile a new judge/demo user starts with: English, US, no skills yet (judges get the questionnaire). */
const GUEST_PROFILE: UserProfile = { ...DEFAULT_PROFILE, country: 'US', language: 'en' };
/** The read-only demo user visitors see: a filled-in profile so the board is not empty. */
const DEMO_PROFILE: UserProfile = { ...GUEST_PROFILE, skills: ['web_dev', 'ai', 'english', 'writing'], hours_per_week: 10 };

const safeUser = (u: string) => u.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'demo';
/** Files of one user. "owner" keeps the original top-level files so existing data stays where it is. */
const userFile = (user: string, name: string) => (user === 'owner' ? runtime(name) : runtime(path.join('users', safeUser(user), name)));

/** Per-user state: profile, picks/status ("execution") and notes. */
export function userStore(user: string) {
  const defaultProfile = user === 'owner' ? DEFAULT_PROFILE : user === 'demo' ? DEMO_PROFILE : GUEST_PROFILE;
  return {
    user,
    getProfile: () => readJson<UserProfile>(userFile(user, 'profile.json'), defaultProfile),
    saveProfile: (p: UserProfile) => writeJson(userFile(user, 'profile.json'), p),
    getExecution: () => readJson<Record<string, ExecutionStatus>>(userFile(user, 'execution.json'), {}),
    saveExecution: (m: Record<string, ExecutionStatus>) => writeJson(userFile(user, 'execution.json'), m),
    getNotes: () => readJson<Record<string, OpportunityNote>>(userFile(user, 'notes.json'), {}),
    saveNotes: (m: Record<string, OpportunityNote>) => writeJson(userFile(user, 'notes.json'), m),
  };
}

/** Every user that has stored state (the crawler moves their state when an opportunity is re-keyed). */
export async function listUsers(): Promise<string[]> {
  try {
    const dirs = await fs.readdir(runtime('users'), { withFileTypes: true });
    return ['owner', ...dirs.filter((d) => d.isDirectory()).map((d) => d.name)];
  } catch {
    return ['owner'];
  }
}

export const store = {
  // --- opportunities: runtime copy, falls back to seed data on first run
  async getOpportunities(): Promise<Opportunity[]> {
    const rt = await readJson<Opportunity[] | null>(runtime('opportunities.json'), null);
    if (rt) return rt;
    return readJson<Opportunity[]>(seed('opportunities.seed.json'), []);
  },
  saveOpportunities: (list: Opportunity[]) => writeJson(runtime('opportunities.json'), list),

  // Sources = seed registry + runtime additions (approved discoveries). Runtime file wins on id clash.
  async getSources(): Promise<Source[]> {
    const base = await readJson<Source[]>(seed('source_registry.json'), []);
    const extra = await readJson<Source[]>(runtime('sources_extra.json'), []);
    const byId = new Map(base.map((s) => [s.id, s]));
    for (const s of extra) byId.set(s.id, s);
    return [...byId.values()];
  },
  async saveSources(list: Source[]) {
    const base = await readJson<Source[]>(seed('source_registry.json'), []);
    const baseIds = new Set(base.map((s) => s.id));
    await writeJson(runtime('sources_extra.json'), list.filter((s) => !baseIds.has(s.id)));
  },

  getCandidates: () => readJson<SourceCandidate[]>(runtime('source_candidates.json'), []),
  saveCandidates: (c: SourceCandidate[]) => writeJson(runtime('source_candidates.json'), c),

  getProfile: () => readJson<UserProfile>(runtime('profile.json'), DEFAULT_PROFILE),
  saveProfile: (p: UserProfile) => writeJson(runtime('profile.json'), p),

  getExecution: () => readJson<Record<string, ExecutionStatus>>(runtime('execution.json'), {}),
  getNotes: () => readJson<Record<string, OpportunityNote>>(runtime('notes.json'), {}),
  saveNotes: (m: Record<string, OpportunityNote>) => writeJson(runtime('notes.json'), m),
  saveExecution: (m: Record<string, ExecutionStatus>) => writeJson(runtime('execution.json'), m),

  getPayments: () => readJson<Payment[]>(runtime('payments.json'), []),
  savePayments: (p: Payment[]) => writeJson(runtime('payments.json'), p),

  getCrawlStatus: () => readJson<CrawlStatus>(runtime('crawl_status.json'), EMPTY_STATUS),
  saveCrawlStatus: (s: CrawlStatus) => writeJson(runtime('crawl_status.json'), s),

  getPageHashes: () => readJson<Record<string, string>>(runtime('page_hashes.json'), {}),
  savePageHashes: (h: Record<string, string>) => writeJson(runtime('page_hashes.json'), h),
};
