import type { ExecutionStatus, LocalizedSummary, Payment, RoutedOpportunity, UserProfile, WeeklyPlan } from '@shared/types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type Routed = RoutedOpportunity & { execution: ExecutionStatus | null };

export const api = {
  status: () => j<any>('/api/status'),
  route: () => j<Routed[]>('/api/route'),
  plan: (explain = false) => j<WeeklyPlan>(`/api/plan${explain ? '?explain=1' : ''}`),
  profile: () => j<UserProfile>('/api/profile'),
  saveProfile: (p: Partial<UserProfile> & { enrich?: boolean }) => j<UserProfile>('/api/profile', { method: 'PUT', body: JSON.stringify(p) }),
  setExecution: (id: string, status: ExecutionStatus | null) =>
    j('/api/execution/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ status }) }),
  payments: () => j<Payment[]>('/api/payments'),
  sync: () => j<{ fetched: number; total: number; matched: number }>('/api/paypal/sync', { method: 'POST' }),
  setMatch: (tx: string, status: 'confirmed' | 'rejected', opportunity_id?: string | null) =>
    j<Payment>('/api/payments/' + encodeURIComponent(tx), { method: 'PUT', body: JSON.stringify({ status, opportunity_id }) }),
  crawl: () => j<any>('/api/crawl', { method: 'POST' }),
  localize: (id: string, lang: string) => j<LocalizedSummary | null>(`/api/opportunities/${encodeURIComponent(id)}/localize?lang=${encodeURIComponent(lang)}`, { method: 'POST' }),
};
