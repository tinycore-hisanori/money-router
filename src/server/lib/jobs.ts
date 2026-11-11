/**
 * Minimal in-process job runner for long-running actions (crawl / discovery / radar).
 * Needed because reverse proxies (Cloudflare: 100s) cut long HTTP requests; the UI polls instead.
 */
export interface Job {
  id: string;
  kind: string;
  status: 'running' | 'done' | 'error';
  started_at: string;
  finished_at: string | null;
  result: unknown;
  error: string | null;
}

const jobs = new Map<string, Job>();

export function startJob<T>(kind: string, fn: () => Promise<T>): Job {
  const running = [...jobs.values()].find((j) => j.kind === kind && j.status === 'running');
  if (running) return running; // one at a time per kind
  const job: Job = { id: `${kind}-${Date.now().toString(36)}`, kind, status: 'running', started_at: new Date().toISOString(), finished_at: null, result: null, error: null };
  jobs.set(job.id, job);
  fn()
    .then((r) => { job.result = r; job.status = 'done'; })
    .catch((e) => { job.error = String(e?.message ?? e); job.status = 'error'; })
    .finally(() => { job.finished_at = new Date().toISOString(); });
  // keep the map small
  if (jobs.size > 50) for (const k of [...jobs.keys()].slice(0, jobs.size - 50)) jobs.delete(k);
  return job;
}

export const getJob = (id: string) => jobs.get(id) ?? null;
export const runningJobs = () => [...jobs.values()].filter((j) => j.status === 'running').map((j) => j.kind);
