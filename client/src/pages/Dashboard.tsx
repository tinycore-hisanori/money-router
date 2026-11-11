import { useEffect, useState } from 'react';
import type { WeeklyPlan, WeeklyPlanItem } from '@shared/types';
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

export default function Dashboard({ tick, onChange, onSetup }: { tick: number; onChange: () => void; onSetup?: () => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [routed, setRouted] = useState<Routed[]>([]);
  const [busy, setBusy] = useState(false);
  const [lang, setLangState] = useState('ja');
  const [selected, setSelected] = useState<Routed | null>(null);

  useEffect(() => {
    api.plan().then(setPlan);
    api.route().then(setRouted);
    api.profile().then((p) => setLangState(p.language || 'ja')).catch(() => {});
  }, [tick]);

  const byId = (id: string) => routed.find((r) => r.opportunity.id === id);
  const open = (id: string) => { const r = byId(id); if (r) setSelected(r); };
  const observed = routed.reduce((s, r) => s + r.opportunity.observed.total_received_usd, 0);
  const eligible = routed.filter((r) => r.eligible);
  const exclusionCounts = routed.reduce<Record<string, number>>((m, r) => {
    for (const code of new Set(r.exclusions.map((e) => e.code))) m[code] = (m[code] ?? 0) + 1;
    return m;
  }, {});
  const closing = eligible
    .filter((r) => { const n = daysLeft(r.opportunity.deadline); return n != null && n >= 0 && !['submitted', 'won', 'lost', 'skipped', 'paid'].includes(r.execution ?? ''); })
    .sort((a, b) => a.opportunity.deadline!.localeCompare(b.opportunity.deadline!))
    .slice(0, 6);
  const waiting = routed.filter((r) => r.execution === 'submitted' || r.execution === 'applied');

  const explain = async () => {
    setBusy(true);
    try { setPlan(await api.plan(true)); } finally { setBusy(false); }
  };

  const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const hero = t('dash.hero', { h: plan?.hours_used ?? 0, usd: '\u0000' }).split('\u0000');
  const hasPlan = !!plan?.items.length;

  const stop = (i: WeeklyPlanItem) => {
    const r = byId(i.opportunity_id);
    const o = r?.opportunity;
    const loc = o?.localized?.[lang];
    const fs = o?.findings ?? [];
    const warn = fs.some((f) => f.severity === 'warning');
    const n = daysLeft(o?.deadline);
    return (
      <li className="stop" key={i.opportunity_id} style={{ ['--c' as any]: catColor(o?.category) }} onClick={() => open(i.opportunity_id)} title={t('dash.clickHint')}>
        <div className="stop-time">{i.hours}h</div>
        <div className="stop-rail" />
        <div className="stop-body">
          <div className="stop-head">
            <h4>{i.name}</h4>
            <span className="usd">{usd(i.expected_usd)}</span>
          </div>
          <div className="chips">
            <span className="cat">{catLabel(o?.category)}</span>
            <span className={`pill ${i.certainty === 'fixed' ? 'ok' : i.certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${i.certainty}` as Key)}</span>
            {n != null && n >= 0 && <span className={`pill ${n <= 7 ? 'bad' : n <= 21 ? 'warn' : ''}`}>{t('col.deadline')} {o!.deadline} / {n === 0 ? t('days.today') : t('days.left', { n })}</span>}
            {r?.warnings?.includes('eligibility_unverified') && <span className="pill bad">{t('warn.eligibility_unverified')}</span>}
            <Stars stars={i.stars} />
          </div>
          {loc?.summary && <p className="stop-sum">{loc.summary}</p>}
          <p className="stop-step"><b>{t('dash.firstStep')}</b>{loc?.how_to?.[0] ?? i.first_step}</p>
          {fs.length > 0 && (
            <p className={`stop-risk ${warn ? 'bad' : ''}`}>
              {fs.map((f, k) => `${f.severity === 'warning' ? '⚠' : '△'} ${loc?.findings?.[k] ?? f.message}`).join('　')}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="grid">
      <section className="hero">
        <h2>
          {hasPlan ? <>{hero[0]}<span className="usd">{usd(plan!.certain_usd)}</span>{hero[1]}</> : t('dash.heroEmpty')}
        </h2>
        <div className="hero-meta">
          <span>{t('dash.eligible')} <b>{eligible.length}</b> {t('dash.ofOpps', { n: routed.length })}</span>
          <span>{t('dash.specShort')} <b>{usd(plan?.speculative_usd ?? 0)}</b></span>
          <span>{t('dash.paypalVerified')} <b>${observed.toFixed(2)}</b></span>
          <span><b>{plan?.hours_used ?? 0}</b> / {plan?.hours_budget ?? 0}h</span>
        </div>
        {plan?.summary && <p className="hero-note">{plan.summary}</p>}
      </section>

      <div className="dash">
        <section className="card">
          <div className="sec-head">
            <h3>{t('dash.route')}</h3>
            <p className="muted">{t('dash.routeSub')}</p>
            <span className="spacer" />
            <button className="ghost" onClick={explain} disabled={busy || !hasPlan}>{busy ? t('dash.thinking') : t('dash.explain')}</button>
          </div>
          {!hasPlan && (
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
          {hasPlan && (
            <ol className="route">
              {plan!.items.map(stop)}
              <li className="stop terminus">
                <div className="stop-time">{plan!.hours_used}h</div>
                <div className="stop-rail" />
                <div className="stop-body">
                  <div className="stop-head">
                    <h4>{t('dash.total')} <span className="muted" style={{ fontWeight: 400 }}>{t('dash.totalSub')}</span></h4>
                    <span className="usd">{usd(plan!.certain_usd)}</span>
                  </div>
                </div>
              </li>
            </ol>
          )}
        </section>

        <div className="side">
          <section className="card">
            <div className="sec-head"><h3>{t('dash.deadlines')}</h3></div>
            {!closing.length && <p className="muted" style={{ margin: 0 }}>{t('dash.noDeadlines')}</p>}
            <ul className="mini">
              {closing.map((r) => (
                <li key={r.opportunity.id} onClick={() => setSelected(r)}>
                  <Count iso={r.opportunity.deadline} />
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{r.opportunity.name}</div>
                    <div className="s">{r.opportunity.deadline}{r.note?.idea ? ` / ${r.note.idea}` : ''}</div>
                  </div>
                  <span className="usd">{usd(r.opportunity.reward_estimate_usd)}</span>
                </li>
              ))}
            </ul>
          </section>

          {waiting.length > 0 && (
            <section className="card">
              <div className="sec-head"><h3>{t('dash.waiting')}</h3></div>
              <ul className="mini">
                {waiting.map((r) => (
                  <li key={r.opportunity.id} onClick={() => setSelected(r)}>
                    <Count iso={r.opportunity.result_date} unit={t('result.on')} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{r.opportunity.name}</div>
                      <div className="s">{t(`st.${r.execution}` as Key)}{r.opportunity.result_note ? ` / ${r.opportunity.result_note}` : ''}{r.note?.idea ? ` / ${r.note.idea}` : ''}</div>
                    </div>
                    <span />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!!plan?.backlog?.length && (
            <section className="card">
              <div className="sec-head"><h3>{t('dash.backlog')}</h3></div>
              <ul className="mini">
                {plan.backlog.slice(0, 8).map((i) => {
                  const o = byId(i.opportunity_id)?.opportunity;
                  return (
                    <li key={i.opportunity_id} onClick={() => open(i.opportunity_id)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{i.name}</div>
                        <div className="s"><span className="cat" style={{ ['--c' as any]: catColor(o?.category) }}>{catLabel(o?.category)}</span>　{i.hours}h</div>
                      </div>
                      <span className="usd">{usd(i.expected_usd)}</span>
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
