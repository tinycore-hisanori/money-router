import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { ExecutionStatus } from '@shared/types';
import { api, type Routed } from '../api';
import type { LocalizedSummary } from '@shared/types';
import { t, type Key } from '../i18n';

const EXEC: (ExecutionStatus | '')[] = ['', 'todo', 'applied', 'active', 'paid', 'skipped'];

export default function Opportunities({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [rows, setRows] = useState<Routed[]>([]);
  const [onlyEligible, setOnlyEligible] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [selected, setSelected] = useState<Routed | null>(null);
  const [lang, setLang] = useState('ja');
  const [brief, setBrief] = useState<LocalizedSummary | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState('');

  useEffect(() => {
    api.profile().then((p) => setLang(p.language || 'ja')).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return setBrief(null);
    const o = selected.opportunity;
    const have = o.localized?.[lang];
    if (have) return setBrief(have);
    setBrief(null);
    setBriefErr('');
    setBriefBusy(true);
    api.localize(o.id, lang).then(setBrief).catch((e) => { setBrief(null); if (e?.status === 429) setBriefErr(t('guard.exhausted')); }).finally(() => setBriefBusy(false));
  }, [selected, lang]);

  useEffect(() => {
    api.route().then(setRows);
  }, [tick]);

  const data = useMemo(() => (onlyEligible ? rows.filter((r) => r.eligible) : rows), [rows, onlyEligible]);

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
      { headerName: t('col.category'), valueGetter: (p) => p.data?.opportunity.category, width: 130 },
      {
        headerName: t('col.certainty'),
        valueGetter: (p) => p.data?.opportunity.certainty,
        width: 120,
        cellRenderer: (p: any) => <span className={`pill ${p.value === 'fixed' ? 'ok' : p.value === 'per_task' ? 'warn' : ''}`}>{t(`cert.${p.value}` as Key)}</span>,
      },
      { headerName: t('col.score'), field: 'score', width: 100, valueFormatter: (p) => p.value?.toFixed(1), sort: 'desc' },
      { headerName: t('col.hourly'), field: 'expected_hourly', width: 90, valueFormatter: (p) => `$${p.value?.toFixed(0)}` },
      {
        headerName: t('col.deadline'),
        valueGetter: (p) => p.data?.opportunity.deadline,
        width: 150,
        cellRenderer: (p: any) => (
          <>
            {p.value ?? '—'}{' '}
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
              <option key={s} value={s}>{s || '—'}</option>
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

  return (
    <div className="grid">
      <div className="toolbar">
        <button className={onlyEligible ? 'primary' : 'ghost'} onClick={() => setOnlyEligible(true)}>{t('opp.forYou')}</button>
        <button className={!onlyEligible ? 'primary' : 'ghost'} onClick={() => setOnlyEligible(false)}>{t('opp.all')}</button>
        <span className="muted">{t('opp.legend')}</span>
        <div className="spacer" />
        <button className="ghost" onClick={crawl} disabled={crawling}>{crawling ? t('opp.crawling') : t('opp.crawl')}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 12 }}>
        <div className="ag-theme-money" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
          <AgGridReact<Routed>
            rowData={data}
            columnDefs={cols}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            tooltipShowDelay={300}
            animateRows
          />
        </div>
        {selected && (
          <div className="card" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
            <div className="toolbar">
              <h3 style={{ margin: 0, fontSize: 15 }}>{selected.opportunity.name}</h3>
              <div className="spacer" />
              <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4 }}>
                {['ja', 'en', 'es', 'pt', 'de', 'fr', 'ko', 'zh'].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button className="ghost" style={{ padding: '2px 8px' }} onClick={() => setSelected(null)}>×</button>
            </div>
            {briefBusy && <p className="muted">{t('brief.writing')}</p>}
            {brief && (
              <>
                <p>{brief.summary}</p>
                <ol style={{ paddingLeft: 18 }}>{brief.how_to.map((h, i) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}</ol>
                <p style={{ color: 'var(--accent)' }}>{brief.payout}</p>
                <p className="muted" style={{ fontSize: 12 }}>{t('brief.by')}{brief.generated_by}</p>
              </>
            )}
            {!brief && !briefBusy && <p className="muted">{briefErr || t('brief.none')}</p>}
            <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
            <p className="muted" style={{ fontSize: 12 }}>
              <b style={{ color: selected.opportunity.eligibility_verified === false ? 'var(--danger)' : 'var(--text)' }}>{t('brief.eligibility')}</b>{' '}
              {selected.opportunity.eligibility_verified === false ? t('warn.eligibility_unverified') + ' — ' : ''}{selected.opportunity.eligibility_note}
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <b style={{ color: 'var(--text)' }}>{t('brief.legit')} {selected.opportunity.legitimacy.score}</b> ({selected.opportunity.legitimacy.scored_by}, {selected.opportunity.legitimacy.mode})<br />
              {selected.opportunity.legitimacy.notes}
            </p>
            {selected.exclusions.length > 0 && (
              <p className="muted" style={{ fontSize: 12 }}><b style={{ color: 'var(--accent-2)' }}>{t('brief.notForYou')}</b> {selected.exclusions.map((e) => e.detail).join('; ')}</p>
            )}
            <p className="muted" style={{ fontSize: 12 }}><a href={selected.opportunity.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{selected.opportunity.url}</a></p>
          </div>
        )}
      </div>
    </div>
  );
}
