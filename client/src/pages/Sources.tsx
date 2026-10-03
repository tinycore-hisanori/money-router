import { useEffect, useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';

export default function Sources({ tick }: { tick: number }) {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    api.status().then(setStatus);
  }, [tick]);
  const crawl = status?.crawl;
  if (!crawl) return null;
  const entries = Object.entries(crawl.sources ?? {}) as [string, any][];
  const rejectedTotal = entries.reduce((n, [, s]) => n + (s.rejected?.length ?? 0), 0);

  return (
    <div className="grid">
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
