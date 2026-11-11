import type { OpportunityNote, ExecutionStatus, LocalizedSummary, Payment, RoutedOpportunity, UserProfile, WeeklyPlan } from '@shared/types';

export const adminToken = {
  get: () => { try { return localStorage.getItem('mr_admin_token') ?? ''; } catch { return ''; } },
  set: (v: string) => { try { v ? localStorage.setItem('mr_admin_token', v) : localStorage.removeItem('mr_admin_token'); } catch {} },
};

export class ApiError extends Error {
  constructor(public status: number, public body: any) { super(body?.error ?? String(status)); }
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tok = adminToken.get();
  if (tok) headers['x-admin-token'] = tok;
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { body = { error: await res.text() }; }
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export type Routed = RoutedOpportunity & { execution: ExecutionStatus | null; note: OpportunityNote | null };

interface Job { id: string; kind: string; status: 'running' | 'done' | 'error'; result: any; error: string | null }

/** Start a long-running server job and poll until it finishes (survives proxy timeouts). */
async function runJob(start: () => Promise<Job>): Promise<any> {
  let job = await start();
  while (job.status === 'running') {
    await new Promise((r) => setTimeout(r, 3000));
    job = await j<Job>(`/api/jobs/${encodeURIComponent(job.id)}`);
  }
  if (job.status === 'error') throw new ApiError(500, { error: job.error });
  return job.result;
}

export const api = {
  status: () => j<any>('/api/status'),
  route: () => j<Routed[]>('/api/route'),
  plan: (explain = false) => j<WeeklyPlan>(`/api/plan${explain ? '?explain=1' : ''}`),
  profile: () => j<UserProfile>('/api/profile'),
  saveProfile: (p: Partial<UserProfile> & { enrich?: boolean }) => j<UserProfile>('/api/profile', { method: 'PUT', body: JSON.stringify(p) }),
  setExecution: (id: string, status: ExecutionStatus | null) =>
    j('/api/execution/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ status }) }),
  setNote: (id: string, note: Partial<OpportunityNote>) =>
    j<OpportunityNote | null>('/api/notes/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(note) }),
  payments: () => j<Payment[]>('/api/payments'),
  sync: () => j<{ fetched: number; total: number; matched: number }>('/api/paypal/sync', { method: 'POST' }),
  setMatch: (tx: string, status: 'confirmed' | 'rejected', opportunity_id?: string | null) =>
    j<Payment>('/api/payments/' + encodeURIComponent(tx), { method: 'PUT', body: JSON.stringify({ status, opportunity_id }) }),
  crawl: () => runJob(() => j<Job>('/api/crawl', { method: 'POST' })),
  discover: (max = 12) => runJob(() => j<Job>(`/api/discover?max=${max}`, { method: 'POST' })),
  radar: (max = 10) => runJob(() => j<Job>(`/api/radar?max=${max}`, { method: 'POST' })),
  candidates: () => j<any[]>('/api/candidates'),
  approve: (id: string) => j<any>(`/api/candidates/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  reject: (id: string) => j<any>(`/api/candidates/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  localize: (id: string, lang: string) => j<LocalizedSummary | null>(`/api/opportunities/${encodeURIComponent(id)}/localize?lang=${encodeURIComponent(lang)}`, { method: 'POST' }),
};
