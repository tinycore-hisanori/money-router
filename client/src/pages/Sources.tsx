import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { t } from '../i18n';

export default function Sources({ tick }: { tick: number }) {
  const [status, setStatus] = useState<any>(null);
  const [cands, setCands] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  const [local, setLocal] = useState(0);
  const [msg, setMsg] = useState('');
  const reload = () => {
    api.status().then(setStatus);
    api.candidates().then(setCands).catch(() => setCands([]));
  };
  useEffect(reload, [tick, local]);
  const crawl = status?.crawl;
  if (!crawl) return null;

  const discover = async () => {
    setBusy(true);
    try {
      setLast(await api.discover(12));
      setLocal((x) => x + 1);
    } catch (e: any) {
      setMsg(e instanceof ApiError && e.status === 429 ? t('guard.exhausted') : String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const act = async (id: string, ok: boolean) => {
    try {
      await (ok ? api.approve(id) : api.reject(id));
      setLocal((x) => x + 1);
    } catch (e: any) {
      setMsg(e instanceof ApiError && e.status === 403 ? t('guard.adminOnly') : String(e.message ?? e));
    }
  };
  const demo = status?.demo?.discovery;
  const canDiscover = status?.tier === 'admin' || (demo && demo.remaining > 0);
  const pending = cands.filter((c) => c.status === 'candidate').sort((a, b) => b.fit_score - a.fit_score);
  const done = cands.filter((c) => c.status !== 'candidate');
  const entries = Object.entries(crawl.sources ?? {}) as [string, any][];
  const rejectedTotal = entries.reduce((n, [, s]) => n + (s.rejected?.length ?? 0), 0);

  return (
    <div className="grid">
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>{t('disc.title')}</h3>
          <span className="muted">{t('disc.hint')}</span>
          <div className="spacer" />
          {status?.tier !== 'admin' && demo && <span className="muted">{t('guard.demoLeft', { n: demo.remaining, limit: demo.limit })}</span>}
          <button className="primary" onClick={discover} disabled={busy || !canDiscover}>{busy ? t('disc.running') : t('disc.run')}</button>
        </div>
        {msg && <p className="muted" style={{ color: 'var(--accent-2)' }}>{msg}</p>}
        {last && (
          <details style={{ marginBottom: 10 }}>
            <summary className="muted" style={{ cursor: 'pointer' }}>{t('disc.lastRun')} ({last.queries?.length}) · +{last.new_candidates}</summary>
            <ul className="muted" style={{ fontSize: 12, paddingLeft: 18 }}>
              {last.queries?.map((q: any, i: number) => <li key={i}>[{q.category}] {q.query} — {q.hits} hits</li>)}
            </ul>
          </details>
        )}
        {!pending.length && <p className="muted">{t('disc.none')}</p>}
        {pending.map((c) => (
          <div className="plan-item" key={c.id}>
            <div>
              <h4>
                <a href={c.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{c.name} ↗</a>{' '}
                <span className="pill">{c.category}</span>{' '}
                <span className={`pill ${c.fit_score >= 70 ? 'ok' : 'warn'}`}>{t('disc.fit')} {c.fit_score}</span>{' '}
                <span className={`pill ${c.legitimacy_hint >= 70 ? 'ok' : c.legitimacy_hint >= 50 ? 'warn' : 'bad'}`}>{t('disc.legit')} {c.legitimacy_hint}</span>
              </h4>
              <p>{c.why}</p>
              <p><b style={{ color: 'var(--text)' }}>{t('disc.evidence')}:</b> {c.paypal_evidence}</p>
              {c.country_note && <p><b style={{ color: 'var(--text)' }}>{t('disc.country')}:</b> {c.country_note}</p>}
              <p style={{ fontSize: 12 }}>{t('disc.query')}: {c.query}</p>
            </div>
            <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
              <button className="primary" onClick={() => act(c.id, true)}>{t('disc.approve')}</button>
              <button className="ghost" onClick={() => act(c.id, false)}>{t('disc.reject')}</button>
            </div>
          </div>
        ))}
        {done.length > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {done.map((c) => `${c.name} (${c.status === 'approved' ? t('disc.approved') : t('disc.rejected')})`).join(' · ')}
          </p>
        )}
      </div>
      <div className="cards">
        <div className="card"><div className="k">{t('src.crawled')}</div><div className="v">{entries.filter(([, s]) => s.ok).length} <small>/ {entries.length}</small></div></div>
        <div className="card"><div className="k">{t('src.kept')}</div><div className="v">{crawl.totals?.active ?? 0} <small>{t('src.keptSub')}</small></div></div>
        <div className="card"><div className="k">{t('src.rejected')}</div><div className="v">{rejectedTotal} <small>{t('src.rejectedSub')}</small></div></div>
        <div className="card"><div className="k">{t('src.audit')}</div><div className="v" style={{ fontSize: 16 }}>{crawl.audit_model}<br /><small>{crawl.audit_mode} · {crawl.last_run ? new Date(crawl.last_run).toLocaleString() : '—'}</small></div></div>
      </div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ color: 'var(--muted)', textAlign: 'left' }}><th>{t('src.source')}</th><th>{t('src.result')}</th><th>{t('src.via')}</th><th>{t('src.keptCol')}</th><th>{t('src.rejectedCol')}</th></tr></thead>
          <tbody>
            {entries.map(([id, s]) => (
              <tr key={id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 4px' }}>{id}</td>
                <td><span className={`pill ${s.ok ? 'ok' : 'bad'}`}>{s.ok ? (s.changed ? t('src.updated') : t('src.unchanged')) : t('src.failed')}</span></td>
                <td className="muted">{s.via ?? '—'}{s.url && s.via !== 'direct' ? <> · <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{t('src.page')}</a></> : null}</td>
                <td>{s.opportunities}</td>
                <td className="muted">{s.error ? <span style={{ color: 'var(--danger)' }}>{s.error}</span> : (s.rejected ?? []).map((r: any, i: number) => <div key={i}>{r.name}: {r.reason}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
