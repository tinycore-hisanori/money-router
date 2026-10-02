import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { Payment } from '@shared/types';
import { api, type Routed } from '../api';

export default function Payments({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [opps, setOpps] = useState<Routed[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.payments().then(setRows);
    api.route().then(setOpps);
  }, [tick]);

  const names = useMemo(() => new Map(opps.map((r) => [r.opportunity.id, r.opportunity.name])), [opps]);

  const sync = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.sync();
      setMsg(`Fetched ${r.fetched} new, ${r.matched}/${r.total} matched`);
      onChange();
    } catch (e: any) {
      setMsg(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const cols = useMemo<ColDef<Payment>[]>(
    () => [
      { field: 'date', width: 170, valueFormatter: (p) => new Date(p.value).toLocaleString(), sort: 'desc' },
      { field: 'amount', width: 110, valueFormatter: (p) => `${p.value.toFixed(2)} ${p.data?.currency}` },
      { field: 'payer_name', headerName: 'Payer', flex: 1 },
      { field: 'note', headerName: 'Note / subject', flex: 2, valueGetter: (p) => p.data?.note || p.data?.subject },
      {
        headerName: 'Matched to',
        flex: 2,
        cellRenderer: (p: any) => {
          const d: Payment = p.data;
          return (
            <select
              value={d.matched_opportunity_id ?? ''}
              onChange={async (e) => {
                await api.setMatch(d.transaction_id, e.target.value ? 'confirmed' : 'rejected', e.target.value || null);
                onChange();
              }}
              style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4, maxWidth: '100%' }}
            >
              <option value="">— unmatched —</option>
              {opps.map((r) => (
                <option key={r.opportunity.id} value={r.opportunity.id}>{r.opportunity.name}</option>
              ))}
            </select>
          );
        },
      },
      {
        headerName: 'Match',
        width: 150,
        valueGetter: (p) => p.data?.match_status,
        tooltipValueGetter: (p) => p.data?.match_reason ?? '',
        cellRenderer: (p: any) => {
          const d: Payment = p.data;
          const cls = d.match_status === 'confirmed' ? 'ok' : d.match_status === 'auto' ? 'warn' : d.match_status === 'rejected' ? 'bad' : '';
          return (
            <span className={`pill ${cls}`}>
              {d.match_status}{d.match_status === 'auto' ? ` ${(d.match_confidence * 100).toFixed(0)}%` : ''}
            </span>
          );
        },
      },
      {
        headerName: '',
        width: 110,
        cellRenderer: (p: any) => {
          const d: Payment = p.data;
          if (d.match_status !== 'auto') return null;
          return (
            <button className="ghost" style={{ padding: '2px 8px' }} onClick={async () => { await api.setMatch(d.transaction_id, 'confirmed'); onChange(); }}>
              Confirm
            </button>
          );
        },
      },
    ],
    [opps, onChange],
  );

  return (
    <div className="grid">
      <div className="toolbar">
        <button className="primary" onClick={sync} disabled={busy}>{busy ? 'Syncing…' : 'Sync PayPal (last 30 days)'}</button>
        <span className="muted">{msg || 'Pulls incoming sandbox transactions and lets AI match them to opportunities.'}</span>
      </div>
      <div className="ag-theme-money" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
        <AgGridReact<Payment> rowData={rows} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} tooltipShowDelay={300} />
      </div>
      <p className="muted">Matched totals feed back into each opportunity's "Verified $" and ranking. {names.size} opportunities loaded.</p>
    </div>
  );
}
