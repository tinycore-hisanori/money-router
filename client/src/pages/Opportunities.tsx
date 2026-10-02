import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { ExecutionStatus } from '@shared/types';
import { api, type Routed } from '../api';

const EXEC: (ExecutionStatus | '')[] = ['', 'todo', 'applied', 'active', 'paid', 'skipped'];

export default function Opportunities({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [rows, setRows] = useState<Routed[]>([]);
  const [onlyEligible, setOnlyEligible] = useState(true);
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    api.route().then(setRows);
  }, [tick]);

  const data = useMemo(() => (onlyEligible ? rows.filter((r) => r.eligible) : rows), [rows, onlyEligible]);

  const cols = useMemo<ColDef<Routed>[]>(
    () => [
      { headerName: 'Opportunity', valueGetter: (p) => p.data?.opportunity.name, flex: 2, minWidth: 220, cellRenderer: (p: any) => <a href={p.data.opportunity.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{p.value}</a> },
      { headerName: 'Category', valueGetter: (p) => p.data?.opportunity.category, width: 130 },
      { headerName: 'Score', field: 'score', width: 100, valueFormatter: (p) => p.value?.toFixed(1), sort: 'desc' },
      { headerName: '$/h', field: 'expected_hourly', width: 90, valueFormatter: (p) => `$${p.value?.toFixed(0)}` },
      { headerName: 'Min payout', valueGetter: (p) => p.data?.opportunity.min_payout, width: 110, valueFormatter: (p) => `$${p.value}` },
      { headerName: 'Days to pay', valueGetter: (p) => p.data?.opportunity.payout_days_estimate, width: 110 },
      {
        headerName: 'Legitimacy',
        valueGetter: (p) => p.data?.opportunity.legitimacy.score,
        width: 120,
        tooltipValueGetter: (p) => `${p.data?.opportunity.legitimacy.notes} (by ${p.data?.opportunity.legitimacy.scored_by}, ${p.data?.opportunity.legitimacy.mode})`,
        cellRenderer: (p: any) => {
          const m = p.data.opportunity.legitimacy.mode;
          const cls = p.value >= 85 ? 'ok' : p.value >= 60 ? 'warn' : 'bad';
          return <span className={`pill ${cls}`}>{p.value}{m === 'diff' || m === 'seed' ? '*' : ''}</span>;
        },
      },
      { headerName: 'Verified $', valueGetter: (p) => p.data?.opportunity.observed.total_received_usd, width: 110, valueFormatter: (p) => (p.value ? `$${p.value.toFixed(2)}` : '—') },
      {
        headerName: 'Why not',
        valueGetter: (p) => p.data?.exclusions.map((e) => e.detail).join('; '),
        flex: 2,
        minWidth: 200,
        tooltipValueGetter: (p) => p.value,
        hide: onlyEligible,
      },
      {
        headerName: 'Status',
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
        <button className={onlyEligible ? 'primary' : 'ghost'} onClick={() => setOnlyEligible(true)}>For you</button>
        <button className={!onlyEligible ? 'primary' : 'ghost'} onClick={() => setOnlyEligible(false)}>All</button>
        <span className="muted">* = provisional score (diff audit or seed). Hover legitimacy for the auditor's notes.</span>
        <div className="spacer" />
        <button className="ghost" onClick={crawl} disabled={crawling}>{crawling ? 'Crawling…' : 'Run crawler now'}</button>
      </div>
      <div className="ag-theme-money" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
        <AgGridReact<Routed> rowData={data} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} tooltipShowDelay={300} animateRows />
      </div>
    </div>
  );
}
