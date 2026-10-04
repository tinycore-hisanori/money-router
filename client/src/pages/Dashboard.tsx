import { useEffect, useState } from 'react';
import type { WeeklyPlan } from '@shared/types';
import { api, type Routed } from '../api';
import { t, type Key } from '../i18n';

export default function Dashboard({ tick, onChange, onSetup }: { tick: number; onChange: () => void; onSetup?: () => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [routed, setRouted] = useState<Routed[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.plan().then(setPlan);
    api.route().then(setRouted);
  }, [tick]);

  const observed = routed.reduce((s, r) => s + r.opportunity.observed.total_received_usd, 0);
  const eligible = routed.filter((r) => r.eligible).length;
  const exclusionCounts = routed.reduce<Record<string, number>>((m, r) => {
    for (const code of new Set(r.exclusions.map((e) => e.code))) m[code] = (m[code] ?? 0) + 1;
    return m;
  }, {});

  const explain = async () => {
    setBusy(true);
    try {
      setPlan(await api.plan(true));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      <div className="cards">
        <div className="card">
          <div className="k">{t('dash.eligible')}</div>
          <div className="v">
            {eligible} <small>{t('dash.ofOpps', { n: routed.length })}</small>
          </div>
        </div>
        <div className="card">
          <div className="k">{t('dash.certain')}</div>
          <div className="v" style={{ color: 'var(--accent)' }}>
            ${plan?.certain_usd ?? 0} <small>{t('dash.certainSub', { used: plan?.hours_used ?? 0, budget: plan?.hours_budget ?? 0 })}</small>
          </div>
        </div>
        <div className="card">
          <div className="k">{t('dash.spec')}</div>
          <div className="v" style={{ color: 'var(--muted)' }}>
            ${plan?.speculative_usd ?? 0} <small>{t('dash.specSub')}</small>
          </div>
        </div>
        <div className="card">
          <div className="k">{t('dash.verified')}</div>
          <div className="v">
            ${observed.toFixed(2)} <small>{t('dash.verifiedSub')}</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>{t('dash.thisWeek')}</h3>
          <span className="muted">{plan?.summary}</span>
          <div className="spacer" />
          <button className="ghost" onClick={explain} disabled={busy}>
            {busy ? t('dash.thinking') : t('dash.explain')}
          </button>
          <button className="ghost" onClick={onChange}>{t('dash.refresh')}</button>
        </div>
        {!plan?.items.length && (
          <div>
            {onSetup ? (
              <div style={{ padding: '8px 0 12px' }}>
                <p style={{ margin: '0 0 8px' }}>{t('onb.body')}</p>
                <button className="primary" onClick={onSetup}>{t('onb.cta')}</button>
              </div>
            ) : (
              <p className="muted">{t('dash.empty')}</p>
            )}
            {Object.keys(exclusionCounts).length > 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                <b style={{ color: 'var(--text)' }}>{t('dash.whyNot')}</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {Object.entries(exclusionCounts).sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                    <li key={code}>{t(`excl.${code}` as Key)}: {n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {plan?.items.map((i) => (
          <div className="plan-item" key={i.opportunity_id}>
            <div>
              <h4>
                {i.name} <span className={`pill ${i.certainty === 'fixed' ? 'ok' : i.certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${i.certainty}` as Key)}</span>
              </h4>
              <p>{i.why}</p>
              <p>
                <b style={{ color: 'var(--text)' }}>{t('dash.firstStep')}</b> {i.first_step}
              </p>
              <p>{t('dash.hours', { h: i.hours })}</p>
            </div>
            <div className="usd">${i.expected_usd}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
