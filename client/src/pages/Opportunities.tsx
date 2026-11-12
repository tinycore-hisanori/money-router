import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { ExecutionStatus } from '@shared/types';
import { api, type Routed } from '../api';
import OpportunityPanel from '../components/OpportunityPanel';
import Stars from '../components/Stars';
import { t, type Key } from '../i18n';
import { daysColor, daysLabel, daysLeft } from '../dates';
import { catColor, catLabel } from '../cats';
import { Count } from './Dashboard';

const EXEC: (ExecutionStatus | '')[] = ['', 'todo', 'applied', 'active', 'submitted', 'paid', 'won', 'lost', 'skipped'];

export default function Opportunities({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [rows, setRows] = useState<Routed[]>([]);
  const [scope, setScope] = useState<'foryou' | 'mine' | 'all'>('foryou');
  const onlyEligible = scope === 'foryou';
  const [crawling, setCrawling] = useState(false);
  const [selected, setSelected] = useState<Routed | null>(null);
  const [lang, setLang] = useState('ja');
  const [view, setView] = useState<'list' | 'table'>('list');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<'score' | 'deadline' | 'hourly' | 'ease' | 'payoff'>('score');

  useEffect(() => {
    api.profile().then((p) => setLang(p.language || 'ja')).catch(() => {});
  }, []);

  useEffect(() => {
    api.route().then(setRows);
  }, [tick]);

  const cats = useMemo(() => [...new Set(rows.map((r) => r.opportunity.category))].sort(), [rows]);
  const data = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (scope === 'all' || (scope === 'mine' ? !!r.execution : r.eligible)) &&
      (!cat || r.opportunity.category === cat) &&
      (!needle || `${r.opportunity.name} ${r.opportunity.provider}`.toLowerCase().includes(needle)));
    const far = (r: Routed) => { const n = daysLeft(r.opportunity.deadline); return n == null || n < 0 ? 1e6 : n; };
    const by: Record<typeof sort, (a: Routed, b: Routed) => number> = {
      score: (a, b) => b.score - a.score,
      deadline: (a, b) => far(a) - far(b) || b.score - a.score,
      hourly: (a, b) => b.expected_hourly - a.expected_hourly,
      ease: (a, b) => b.stars.ease - a.stars.ease || b.score - a.score,
      payoff: (a, b) => b.stars.payoff - a.stars.payoff || b.score - a.score,
    };
    return [...list].sort(by[sort]);
  }, [rows, scope, q, cat, sort]);

  const cols = useMemo<ColDef<Routed>[]>(
    () => [
      {
        headerName: '',
        width: 84,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => (
          <button className="ghost" style={{ padding: '2px 10px' }} onClick={() => setSelected(p.data)} title={t('opp.briefTitle')}>
            {t('opp.brief')}
          </button>
        ),
      },
      { headerName: t('col.opportunity'), valueGetter: (p) => p.data?.opportunity.name, flex: 2, minWidth: 220, cellRenderer: (p: any) => <a href={p.data.opportunity.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }} title={t('opp.openPage')}>{p.value} ↗</a> },
      { headerName: t('col.category'), valueGetter: (p) => catLabel(p.data?.opportunity.category), width: 140 },
      {
        headerName: t('col.certainty'),
        valueGetter: (p) => p.data?.opportunity.certainty,
        width: 120,
        cellRenderer: (p: any) => <span className={`pill ${p.value === 'fixed' ? 'ok' : p.value === 'per_task' ? 'warn' : ''}`}>{t(`cert.${p.value}` as Key)}</span>,
      },
      {
        headerName: t('col.stars'),
        width: 220,
        valueGetter: (p) => (p.data ? p.data.stars.ease * 10 + p.data.stars.payoff : 0),
        headerTooltip: t('stars.legend'),
        cellRenderer: (p: any) => <Stars stars={p.data.stars} />,
      },
      {
        headerName: t('col.risk'),
        width: 90,
        valueGetter: (p) => (p.data?.opportunity.findings ?? []).filter((f: any) => f.severity === 'warning').length * 10 + (p.data?.opportunity.findings ?? []).length,
        tooltipValueGetter: (p) => {
          const fs = p.data?.opportunity.findings ?? [];
          const loc = p.data?.opportunity.localized?.[lang]?.findings;
          return fs.length ? fs.map((f: any, i: number) => `${f.severity === 'warning' ? '⚠' : f.severity === 'caution' ? '△' : 'ⓘ'} ${loc?.[i] ?? f.message}`).join('\n') : t('find.none');
        },
        cellRenderer: (p: any) => {
          const fs = p.data.opportunity.findings ?? [];
          if (!fs.length) return <span className="muted">—</span>;
          const w = fs.filter((f: any) => f.severity === 'warning').length;
          const c = fs.filter((f: any) => f.severity === 'caution').length;
          return (
            <span>
              {w > 0 && <span className="pill bad">⚠ {w}</span>}{' '}
              {c > 0 && <span className="pill warn">△ {c}</span>}
            </span>
          );
        },
      },
      { headerName: t('col.score'), field: 'score', width: 100, valueFormatter: (p) => p.value?.toFixed(1), sort: 'desc' },
      { headerName: t('col.hourly'), field: 'expected_hourly', width: 90, valueFormatter: (p) => `$${p.value?.toFixed(0)}` },
      {
        headerName: t('col.deadline'),
        valueGetter: (p) => p.data?.opportunity.deadline,
        tooltipValueGetter: (p) => p.data?.opportunity.period ?? (p.data?.opportunity.starts ? `${p.data.opportunity.starts} → ${p.data.opportunity.deadline}` : ''),
        width: 150,
        cellRenderer: (p: any) => (
          <>
            {p.value ?? '—'}{' '}
            {p.value && <small style={{ color: daysColor(p.value) }}>{daysLabel(p.value)}</small>}{' '}
            {p.data?.warnings?.includes('eligibility_unverified') && <span className="pill bad" title={t('warn.eligibility_unverified')}>?</span>}
          </>
        ),
      },
      { headerName: t('col.minPayout'), valueGetter: (p) => p.data?.opportunity.min_payout, width: 110, valueFormatter: (p) => `$${p.value}` },
      { headerName: t('col.days'), valueGetter: (p) => p.data?.opportunity.payout_days_estimate, width: 110 },
      {
        headerName: t('col.legitimacy'),
        valueGetter: (p) => p.data?.opportunity.legitimacy.score,
        width: 120,
        tooltipValueGetter: (p) => `${p.data?.opportunity.legitimacy.notes} (by ${p.data?.opportunity.legitimacy.scored_by}, ${p.data?.opportunity.legitimacy.mode})`,
        cellRenderer: (p: any) => {
          const m = p.data.opportunity.legitimacy.mode;
          const cls = p.value >= 85 ? 'ok' : p.value >= 60 ? 'warn' : 'bad';
          return <span className={`pill ${cls}`}>{p.value}{m === 'diff' || m === 'seed' ? '*' : ''}</span>;
        },
      },
      { headerName: t('col.verified'), valueGetter: (p) => p.data?.opportunity.observed.total_received_usd, width: 110, valueFormatter: (p) => (p.value ? `$${p.value.toFixed(2)}` : '—') },
      {
        headerName: t('col.whyNot'),
        valueGetter: (p) => p.data?.exclusions.map((e) => e.detail).join('; '),
        flex: 2,
        minWidth: 200,
        tooltipValueGetter: (p) => p.value,
        hide: onlyEligible,
      },
      {
        headerName: t('col.status'),
        field: 'execution',
        width: 120,
        cellRenderer: (p: any) => (
          <select
            value={p.value ?? ''}
            onChange={async (e) => {
              await api.setExecution(p.data.opportunity.id, (e.target.value || null) as ExecutionStatus | null);
              onChange();
            }}
            style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4 }}
          >
            {EXEC.map((s) => (
              <option key={s} value={s}>{t(`st.${s}` as Key)}</option>
            ))}
          </select>
        ),
      },
    ],
    [onlyEligible, onChange],
  );

  const crawl = async () => {
    setCrawling(true);
    try {
      await api.crawl();
      onChange();
    } finally {
      setCrawling(false);
    }
  };

  const setStatus = async (id: string, v: string) => {
    setRows((rs) => rs.map((r) => (r.opportunity.id === id ? { ...r, execution: (v || null) as ExecutionStatus | null } : r)));
    await api.setExecution(id, (v || null) as ExecutionStatus | null);
  };

  const row = (r: Routed) => {
    const o = r.opportunity;
    const fs = o.findings ?? [];
    const w = fs.filter((f) => f.severity === 'warning').length;
    const c = fs.filter((f) => f.severity === 'caution').length;
    const where = o.countries_allowed.length ? o.countries_allowed.slice(0, 4).join(' ') + (o.countries_allowed.length > 4 ? ' …' : '') : o.worldwide_stated ? t('opp.worldwide') : t('opp.whereUnknown');
    return (
      <div className={`orow ${r.eligible ? '' : 'out'}`} key={o.id} style={{ ['--c' as any]: catColor(o.category) }} onClick={() => setSelected(r)}>
        <div className="orow-bar" />
        <div className="orow-main">
          <h4>{o.name}</h4>
          <div className="chips">
            <span className="cat">{catLabel(o.category)}</span>
            <span className={`pill ${r.effective_certainty === 'fixed' ? 'ok' : r.effective_certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${r.effective_certainty}` as Key)}</span>
            <span className="pill">{where}</span>
            {w > 0 && <span className="pill bad">⚠ {w}</span>}
            {c > 0 && <span className="pill warn">△ {c}</span>}
            {r.warnings.includes('eligibility_unverified') && <span className="pill bad">{t('warn.eligibility_unverified')}</span>}
            {o.observed.total_received_usd > 0 && <span className="pill ok">PayPal ${o.observed.total_received_usd.toFixed(2)}</span>}
          </div>
          {!r.eligible && <p className="why">{r.exclusions.map((e) => e.detail).join(' / ')}</p>}
          {r.note?.idea && <p className="muted" style={{ margin: 0 }}>{t('note.idea')}: {r.note.idea}</p>}
        </div>
        <div className="orow-stars"><Stars stars={r.stars} /></div>
        <div className="orow-money">
          <b>${r.expected_hourly.toFixed(0)}</b><span style={{ display: 'inline' }}>{t('opp.perHour')}</span>
          <span>{t('panel.reward')} ${o.reward_estimate_usd.toLocaleString()}</span>
        </div>
        <div className="orow-count">{o.deadline ? <Count iso={o.deadline} /> : <span className="muted">—</span>}</div>
        <div className="orow-act" onClick={(e) => e.stopPropagation()}>
          {r.execution ? (
            <select className="input" value={r.execution} onChange={(e) => setStatus(o.id, e.target.value)} aria-label={t('col.status')}>
              <option value="">{t('st.' as Key)}</option>
              {EXEC.filter(Boolean).map((x) => <option key={x} value={x}>{t(`st.${x}` as Key)}</option>)}
            </select>
          ) : (
            <button className="ghost" onClick={() => setStatus(o.id, 'todo')}>{t('opp.pick')}</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid">
      <div className="filters">
        <div className="seg" role="group">
          <button aria-pressed={scope === 'foryou'} onClick={() => setScope('foryou')}>{t('opp.forYou')}</button>
          <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>{t('opp.mine')} {rows.filter((r) => r.execution).length || ''}</button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{t('opp.all')}</button>
        </div>
        <input className="input search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('opp.search')} aria-label={t('opp.search')} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('col.category')}>
          <option value="">{t('opp.allCats')}</option>
          {cats.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="sort">
          {(['score', 'deadline', 'hourly', 'ease', 'payoff'] as const).map((k) => <option key={k} value={k}>{t(`opp.sort.${k}` as Key)}</option>)}
        </select>
        <div className="seg" role="group">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>{t('opp.view.list')}</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>{t('opp.view.table')}</button>
        </div>
        <span className="muted">{t('opp.count', { n: data.length })}</span>
        <span className="spacer" />
        <button className="ghost" onClick={crawl} disabled={crawling}>{crawling ? t('opp.crawling') : t('opp.crawl')}</button>
      </div>
      {view === 'list' && (
        <div className="olist">
          {scope !== 'mine' && data.map(row)}
          {scope === 'mine' && (['active', 'todo', 'applied', 'submitted', 'won', 'paid', 'lost', 'skipped'] as ExecutionStatus[]).map((st) => {
            const g = data.filter((r) => r.execution === st);
            return g.length ? [<h3 key={st} className="group">{t(`st.${st}` as Key)} <span className="muted">{g.length}</span></h3>, ...g.map(row)] : null;
          })}
          {!data.length && <div className="card muted">{scope === 'mine' ? t('opp.mineEmpty') : t('opp.noResults')}</div>}
        </div>
      )}
      {view === 'table' && (
        <>
          <span className="muted">{t('opp.legend')}</span>
          <div className="ag-theme-money" style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
            <AgGridReact<Routed>
              rowData={data}
              columnDefs={cols}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
              tooltipShowDelay={300}
              animateRows
            />
          </div>
        </>
      )}
      {selected && <OpportunityPanel routed={selected} lang={lang} onLang={setLang} onClose={() => setSelected(null)} onChange={onChange} />}
    </div>
  );
}
