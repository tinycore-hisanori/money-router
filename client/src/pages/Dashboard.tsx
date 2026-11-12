import { useEffect, useState } from 'react';
import type { ExecutionStatus, WeeklyPlan, WeeklyPlanItem } from '@shared/types';
import { api, type Routed } from '../api';
import OpportunityPanel from '../components/OpportunityPanel';
import Stars from '../components/Stars';
import { catColor, catLabel } from '../cats';
import { daysLeft } from '../dates';
import { t, type Key } from '../i18n';

/** Countdown box: days to a date, coloured by urgency. */
export function Count({ iso, unit }: { iso?: string | null; unit?: string }) {
  const n = daysLeft(iso);
  if (n == null) return <div className="count none"><b>–</b><span>{unit ?? ''}</span></div>;
  const cls = n < 0 ? 'none' : n <= 7 ? 'urgent' : n <= 21 ? 'soon' : '';
  return (
    <div className={`count ${cls}`}>
      <b>{n < 0 ? '!' : n}</b>
      <span>{n < 0 ? t('days.past') : n === 0 ? t('days.today') : unit ?? t('days.unit')}</span>
    </div>
  );
}

const PICKED: ExecutionStatus[] = ['active', 'todo', 'applied'];
const STATUSES: ExecutionStatus[] = ['todo', 'applied', 'active', 'submitted', 'paid', 'won', 'lost', 'skipped'];

/**
 * Dashboard. The main thing is "my picks": what the user decided to do, with deadlines, hours and expected money.
 * Suggestions (what the router would do with the remaining hours) are secondary.
 */
export default function Dashboard({ tick, onChange, onSetup }: { tick: number; onChange: () => void; onSetup?: () => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [routed, setRouted] = useState<Routed[]>([]);
  const [busy, setBusy] = useState(false);
  const [lang, setLangState] = useState('ja');
  const [selected, setSelected] = useState<Routed | null>(null);
  const [memo, setMemo] = useState('');
  const [memoState, setMemoState] = useState('');
  const [undo, setUndo] = useState<{ id: string; name: string; prev: string; next: string } | null>(null);

  const load = () => { api.plan().then(setPlan); api.route().then(setRouted); };
  useEffect(() => {
    load();
    api.profile().then((p) => setLangState(p.language || 'ja')).catch(() => {});
    api.getNote('_board').then((n) => setMemo(n?.note ?? '')).catch(() => {});
  }, [tick]);

  const byId = (id: string) => routed.find((r) => r.opportunity.id === id);
  const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const setStatus = async (id: string, v: string, remember = true) => {
    const cur = routed.find((r) => r.opportunity.id === id);
    const before = routed;
    setRouted((rs) => rs.map((r) => (r.opportunity.id === id ? { ...r, execution: (v || null) as ExecutionStatus | null } : r)));
    try {
      await api.setExecution(id, (v || null) as ExecutionStatus | null);
      // Every saved status change can be undone from the bar at the top of the board.
      if (remember && cur) setUndo({ id, name: cur.opportunity.name, prev: cur.execution ?? '', next: v });
      load();
    } catch {
      setRouted(before); // the server refused (e.g. no access key): show the real state, never a change that was not saved
      setUndo(null);
    }
  };

  /** Plan numbers for one opportunity: from the weekly plan when it is in it, else from its own estimate. */
  const itemFor = (r: Routed): WeeklyPlanItem => {
    const o = r.opportunity;
    const hit = plan?.items.find((i) => i.opportunity_id === o.id) ?? plan?.backlog?.find((i) => i.opportunity_id === o.id);
    if (hit) return hit;
    const hours = Math.max(1, Math.min(o.effort_hours_estimate || 1, Math.floor((plan?.hours_budget ?? 10) / 2)));
    return { opportunity_id: o.id, name: o.name, certainty: r.effective_certainty, hours, expected_usd: Math.round(r.expected_hourly * hours), first_step: o.requirements[0] ?? '', why: '', stars: r.stars };
  };

  const far = (r: Routed) => { const n = daysLeft(r.opportunity.deadline); return n == null ? 1e6 : n < 0 ? 5e5 : n; };
  const mine = routed.filter((r) => PICKED.includes(r.execution as ExecutionStatus)).sort((a, b) => far(a) - far(b));
  const mineItems = mine.map((r) => ({ r, i: itemFor(r) }));
  const mineHours = Math.round(mineItems.reduce((s, x) => s + x.i.hours, 0) * 10) / 10;
  const mineCertain = mineItems.filter((x) => x.r.effective_certainty !== 'speculative').reduce((s, x) => s + x.i.expected_usd, 0);
  const mineSpec = mineItems.filter((x) => x.r.effective_certainty === 'speculative').reduce((s, x) => s + x.i.expected_usd, 0);
  const results = routed.filter((r) => r.execution === 'submitted');
  const suggestions = [...(plan?.items ?? []), ...(plan?.backlog ?? [])].filter((i) => !byId(i.opportunity_id)?.execution);
  const observed = routed.reduce((s, r) => s + r.opportunity.observed.total_received_usd, 0);
  const eligible = routed.filter((r) => r.eligible);
  const exclusionCounts = routed.reduce<Record<string, number>>((m, r) => {
    for (const code of new Set(r.exclusions.map((e) => e.code))) m[code] = (m[code] ?? 0) + 1;
    return m;
  }, {});
  const closing = eligible
    .filter((r) => { const n = daysLeft(r.opportunity.deadline); return n != null && n >= 0 && !r.execution; })
    .sort((a, b) => a.opportunity.deadline!.localeCompare(b.opportunity.deadline!))
    .slice(0, 5);

  const saveMemo = async () => {
    try { await api.setNote('_board', { idea: '', note: memo }); setMemoState(t('note.saved')); }
    catch (e: any) { setMemoState(e?.status === 403 ? t('note.adminOnly') : String(e?.message ?? e)); }
  };
  const saveIdea = async (r: Routed, idea: string) => {
    if (idea === (r.note?.idea ?? '')) return;
    try { await api.setNote(r.opportunity.id, { idea, note: r.note?.note ?? '' }); load(); }
    catch (e: any) { setMemoState(e?.status === 403 ? t('note.adminOnly') : String(e?.message ?? e)); }
  };
  const cnt = (k: string) => routed.filter((r) => r.execution === k).length;
  const nextDeadline = mine.find((r) => { const n = daysLeft(r.opportunity.deadline); return n != null && n >= 0; });
  const nextResult = results
    .filter((r) => { const n = daysLeft(r.opportunity.result_date); return n != null && n >= 0; })
    .sort((a, b) => a.opportunity.result_date!.localeCompare(b.opportunity.result_date!))[0];
  const inDays = (iso?: string | null) => { const n = daysLeft(iso); return n === 0 ? t('board.today') : t('board.inDays', { n: n ?? 0 }); };
  const hasMine = mine.length > 0;
  const budget = plan?.hours_budget ?? 0;
  const over = hasMine && mineHours > budget;
  const hero = (hasMine
    ? t('dash.heroMine', { n: mine.length, usd: '\u0000' })
    : t('dash.heroSuggest', { h: plan?.hours_used ?? 0, usd: '\u0000' })).split('\u0000');
  const heroUsd = hasMine ? mineCertain : plan?.certain_usd ?? 0;

  const explain = async () => {
    setBusy(true);
    try { setPlan(await api.plan(true)); } finally { setBusy(false); }
  };

  const stop = (r: Routed | undefined, i: WeeklyPlanItem, picked: boolean) => {
    const o = r?.opportunity;
    const loc = o?.localized?.[lang];
    const fs = o?.findings ?? [];
    const warn = fs.some((f) => f.severity === 'warning');
    const n = daysLeft(o?.deadline);
    const cert = r?.effective_certainty ?? i.certainty;
    return (
      <li className="stop" key={i.opportunity_id} style={{ ['--c' as any]: catColor(o?.category) }} onClick={() => r && setSelected(r)} title={t('dash.clickHint')}>
        <div className="stop-time">{i.hours}h</div>
        <div className="stop-rail" />
        <div className="stop-body">
          <div className="stop-head">
            <h4>{i.name}</h4>
            <span className="usd" style={cert === 'speculative' ? { color: 'var(--muted)' } : undefined}>{usd(i.expected_usd)}</span>
          </div>
          <div className="chips">
            <span className="cat">{catLabel(o?.category)}</span>
            <span className={`pill ${cert === 'fixed' ? 'ok' : cert === 'per_task' ? 'warn' : ''}`}>{t(`cert.${cert}` as Key)}</span>
            {n != null && n >= 0 && <span className={`pill ${n <= 7 ? 'bad' : n <= 21 ? 'warn' : ''}`}>{t('col.deadline')} {o!.deadline} / {n === 0 ? t('days.today') : t('days.left', { n })}</span>}
            {n != null && n < 0 && <span className="pill">{t('days.past')} {o!.deadline}</span>}
            {r?.warnings?.includes('eligibility_unverified') && <span className="pill bad">{t('warn.eligibility_unverified')}</span>}
            <Stars stars={i.stars ?? r?.stars} />
          </div>
          {picked && r && (
            <label className="stop-idea" onClick={(e) => e.stopPropagation()}>
              <b>{t('note.idea')}</b>
              <input className="input" defaultValue={r.note?.idea ?? ''} key={r.note?.updated_at ?? 'new'} placeholder={t('board.ideaPh')} onBlur={(e) => saveIdea(r, e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            </label>
          )}
          {!picked && loc?.summary && <p className="stop-sum">{loc.summary}</p>}
          <p className="stop-step"><b>{t('dash.firstStep')}</b>{loc?.how_to?.[0] ?? i.first_step}</p>
          {fs.length > 0 && (
            <p className={`stop-risk ${warn ? 'bad' : ''}`}>
              {fs.map((f, k) => `${f.severity === 'warning' ? '⚠' : '△'} ${loc?.findings?.[k] ?? f.message}`).join('　')}
            </p>
          )}
          <div className="stop-act" onClick={(e) => e.stopPropagation()}>
            {picked && <button className="ghost" onClick={() => setStatus(i.opportunity_id, 'submitted')}>{t('board.done')}</button>}
            {picked ? (
              <select className="input" value={r?.execution ?? ''} onChange={(e) => setStatus(i.opportunity_id, e.target.value)} aria-label={t('col.status')}>
                <option value="">{t('st.' as Key)}</option>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`st.${s}` as Key)}</option>)}
              </select>
            ) : (
              <button className="ghost" onClick={() => setStatus(i.opportunity_id, 'todo')}>{t('opp.pick')}</button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const terminus = (hours: number, total: number) => (
    <li className="stop terminus">
      <div className="stop-time">{hours}h</div>
      <div className="stop-rail" />
      <div className="stop-body">
        <div className="stop-head">
          <h4>{t('dash.total')} <span className="muted" style={{ fontWeight: 400 }}>{t('dash.totalSub')}</span></h4>
          <span className="usd">{usd(total)}</span>
        </div>
      </div>
    </li>
  );

  return (
    <div className="grid">
      <section className="hero">
        <h2>{hero[0]}<span className="usd">{usd(heroUsd)}</span>{hero[1]}</h2>
        <div className="hero-meta">
          <span><b>{mine.length}</b> {t('board.active')}</span>
          <span><b>{cnt('submitted') + cnt('won') + cnt('lost') + cnt('paid')}</b> {t('board.joined')}（{t('board.joinedSub', { w: cnt('won'), d: cnt('submitted'), l: cnt('lost') })}）</span>
          {nextDeadline && <span>{t('board.nextDeadline')} <b style={{ color: 'var(--danger)' }}>{inDays(nextDeadline.opportunity.deadline)}</b> {nextDeadline.opportunity.name}</span>}
          {nextResult && <span>{t('board.nextResult')} <b>{inDays(nextResult.opportunity.result_date)}</b> {nextResult.opportunity.name}</span>}
          <span>{t('dash.specShort')} <b>{usd(hasMine ? mineSpec : plan?.speculative_usd ?? 0)}</b></span>
          <span>{t('dash.paypalVerified')} <b>${observed.toFixed(2)}</b></span>
        </div>
        {plan?.summary && <p className="hero-note">{plan.summary}</p>}
      </section>

      {undo && (
        <div className="undobar" role="status">
          <span>{t('board.undoBar', { name: undo.name, st: t(`st.${undo.next}` as Key) })}</span>
          <button className="primary" onClick={() => { setStatus(undo.id, undo.prev, false); setUndo(null); }}>{t('board.undoBtn')}</button>
          <button className="icon-btn" onClick={() => setUndo(null)} aria-label="close">✕</button>
        </div>
      )}

      <section className="card boardmemo">
        <div className="sec-head" style={{ marginBottom: 6 }}><h3>{t('board.memo')}</h3><span className="spacer" /><span className="muted">{memoState}</span></div>
        <textarea value={memo} onChange={(e) => { setMemo(e.target.value); setMemoState(''); }} onBlur={saveMemo} rows={2} placeholder={t('board.memoPh')} aria-label={t('board.memo')} />
      </section>

      <div className="dash">
        <section className="card">
          <div className="sec-head">
            <h3>{hasMine ? t('dash.mine') : t('dash.suggestRoute')}</h3>
            <p className="muted">{hasMine ? t('dash.mineSub') : t('dash.suggestSub')}</p>
            <span className="spacer" />
            {!hasMine && <button className="ghost" onClick={explain} disabled={busy || !plan?.items.length}>{busy ? t('dash.thinking') : t('dash.explain')}</button>}
          </div>

          {hasMine && (
            <div className="budget" title={`${mineHours}h / ${budget}h`}>
              <div className="budget-top">
                <span>{t('dash.budget')}</span>
                <b className="num" style={over ? { color: 'var(--danger)' } : undefined}>{mineHours}h / {budget}h{over ? `　${t('dash.over')}` : ''}</b>
              </div>
              <div className="meter"><i style={{ width: `${Math.min(100, budget ? (mineHours / budget) * 100 : 0)}%`, background: over ? 'var(--danger)' : 'var(--route)' }} /></div>
            </div>
          )}

          {hasMine && (
            <ol className="route">
              {mineItems.map(({ r, i }) => stop(r, i, true))}
              {terminus(mineHours, mineCertain)}
            </ol>
          )}

          {!hasMine && !!plan?.items.length && (
            <ol className="route">
              {plan.items.map((i) => stop(byId(i.opportunity_id), i, false))}
              {terminus(plan.hours_used, plan.certain_usd)}
            </ol>
          )}

          {!hasMine && !plan?.items.length && (
            <div>
              {onSetup ? (
                <div style={{ padding: '4px 0 12px' }}>
                  <p style={{ margin: '0 0 10px', maxWidth: '60ch' }}>{t('onb.body')}</p>
                  <button className="primary" onClick={onSetup}>{t('onb.cta')}</button>
                </div>
              ) : (
                <p className="muted">{t('dash.empty')}</p>
              )}
              {Object.keys(exclusionCounts).length > 0 && (
                <div className="box">
                  <h5>{t('dash.whyNot')}</h5>
                  <ul>
                    {Object.entries(exclusionCounts).sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                      <li key={code}>{t(`excl.${code}` as Key)}: {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="side">
          {results.length > 0 && (
            <section className="card">
              <div className="sec-head"><h3>{t('dash.results')}</h3></div>
              <ul className="mini">
                {results.map((r) => (
                  <li key={r.opportunity.id} onClick={() => setSelected(r)} style={{ gridTemplateColumns: '58px minmax(0, 1fr)' }}>
                    <Count iso={r.opportunity.result_date} unit={t('result.on')} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{r.opportunity.name}</div>
                      <div className="s">{r.note?.idea || r.opportunity.result_note || r.opportunity.result_date || t('result.wait')}</div>
                      <div className="stop-act" style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button className="ghost" onClick={() => setStatus(r.opportunity.id, 'active')}>{t('board.undo')}</button>
                        <select className="input" value={r.execution ?? ''} onChange={(e) => setStatus(r.opportunity.id, e.target.value)} aria-label={t('col.status')}>
                          <option value="">{t('st.' as Key)}</option>
                          {STATUSES.map((x) => <option key={x} value={x}>{t(`st.${x}` as Key)}</option>)}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasMine && suggestions.length > 0 && (
            <section className="card">
              <div className="sec-head"><h3>{t('dash.suggest')}</h3></div>
              <ul className="mini">
                {suggestions.slice(0, 8).map((i) => {
                  const r = byId(i.opportunity_id); const o = r?.opportunity;
                  return (
                    <li key={i.opportunity_id} onClick={() => r && setSelected(r)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{i.name}</div>
                        <div className="s"><span className="cat" style={{ ['--c' as any]: catColor(o?.category) }}>{catLabel(o?.category)}</span>　{i.hours}h　{t(`cert.${r?.effective_certainty ?? i.certainty}` as Key)}</div>
                      </div>
                      <span className="usd">{usd(i.expected_usd)}</span>
                      <button className="ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setStatus(i.opportunity_id, 'todo'); }}>{t('opp.pick')}</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="sec-head"><h3>{t('dash.deadlines')}</h3></div>
            {!closing.length && <p className="muted" style={{ margin: 0 }}>{t('dash.noDeadlines')}</p>}
            <ul className="mini">
              {closing.map((r) => (
                <li key={r.opportunity.id} onClick={() => setSelected(r)}>
                  <Count iso={r.opportunity.deadline} />
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{r.opportunity.name}</div>
                    <div className="s">{r.opportunity.deadline}　{t('panel.reward')} {usd(r.opportunity.reward_estimate_usd)}</div>
                  </div>
                  <button className="ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setStatus(r.opportunity.id, 'todo'); }}>{t('opp.pick')}</button>
                </li>
              ))}
            </ul>
          </section>

          {!hasMine && !!plan?.backlog?.length && (
            <section className="card">
              <div className="sec-head"><h3>{t('dash.backlog')}</h3></div>
              <ul className="mini">
                {plan.backlog.slice(0, 8).map((i) => {
                  const r = byId(i.opportunity_id); const o = r?.opportunity;
                  return (
                    <li key={i.opportunity_id} onClick={() => r && setSelected(r)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{i.name}</div>
                        <div className="s"><span className="cat" style={{ ['--c' as any]: catColor(o?.category) }}>{catLabel(o?.category)}</span>　{i.hours}h</div>
                      </div>
                      <span className="usd">{usd(i.expected_usd)}</span>
                      <button className="ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setStatus(i.opportunity_id, 'todo'); }}>{t('opp.pick')}</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {selected && <OpportunityPanel routed={selected} lang={lang} onLang={setLangState} onClose={() => setSelected(null)} onChange={onChange} />}
    </div>
  );
}
