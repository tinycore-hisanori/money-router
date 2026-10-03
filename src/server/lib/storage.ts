import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import type {
  CrawlStatus,
  ExecutionStatus,
  Opportunity,
  Payment,
  Source,
  UserProfile,
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

const DEFAULT_PROFILE: UserProfile = {
  country: 'JP',
  language: 'ja',
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

export const store = {
  // --- opportunities: runtime copy, falls back to seed data on first run
  async getOpportunities(): Promise<Opportunity[]> {
    const rt = await readJson<Opportunity[] | null>(runtime('opportunities.json'), null);
    if (rt) return rt;
    return readJson<Opportunity[]>(seed('opportunities.seed.json'), []);
  },
  saveOpportunities: (list: Opportunity[]) => writeJson(runtime('opportunities.json'), list),

  getSources: () => readJson<Source[]>(seed('source_registry.json'), []),

  getProfile: () => readJson<UserProfile>(runtime('profile.json'), DEFAULT_PROFILE),
  saveProfile: (p: UserProfile) => writeJson(runtime('profile.json'), p),

  getExecution: () => readJson<Record<string, ExecutionStatus>>(runtime('execution.json'), {}),
  saveExecution: (m: Record<string, ExecutionStatus>) => writeJson(runtime('execution.json'), m),

  getPayments: () => readJson<Payment[]>(runtime('payments.json'), []),
  savePayments: (p: Payment[]) => writeJson(runtime('payments.json'), p),

  getCrawlStatus: () => readJson<CrawlStatus>(runtime('crawl_status.json'), EMPTY_STATUS),
  saveCrawlStatus: (s: CrawlStatus) => writeJson(runtime('crawl_status.json'), s),

  getPageHashes: () => readJson<Record<string, string>>(runtime('page_hashes.json'), {}),
  savePageHashes: (h: Record<string, string>) => writeJson(runtime('page_hashes.json'), h),
};
