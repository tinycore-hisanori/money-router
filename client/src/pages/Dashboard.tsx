import { useEffect, useState } from 'react';
import type { WeeklyPlan } from '@shared/types';
import { api, type Routed } from '../api';
import OpportunityPanel from '../components/OpportunityPanel';
import Stars from '../components/Stars';
import { t, type Key } from '../i18n';

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
          <span className="muted" title={t('stars.legend')}>{plan?.summary}</span>
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
          <div
            className="plan-item clickable"
            key={i.opportunity_id}
            title={t('dash.clickHint')}
            onClick={() => { const r = routed.find((x) => x.opportunity.id === i.opportunity_id); if (r) setSelected(r); }}
          >
            <div>
              <h4>
                {i.name} <span className={`pill ${i.certainty === 'fixed' ? 'ok' : i.certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${i.certainty}` as Key)}</span>
                {routed.find((r) => r.opportunity.id === i.opportunity_id)?.warnings?.includes('eligibility_unverified') && (
                  <> <span className="pill bad">{t('warn.eligibility_unverified')}</span></>
                )}
              </h4>
              {(() => {
                const r = routed.find((x) => x.opportunity.id === i.opportunity_id);
                const fs = r?.opportunity.findings ?? [];
                const loc = r?.opportunity.localized?.[lang]?.findings;
                return fs.length ? (
                  <p style={{ fontSize: 12, color: fs.some((f) => f.severity === 'warning') ? 'var(--danger)' : 'var(--accent-2)' }}>
                    {fs.map((f, k) => `${f.severity === 'warning' ? '⚠' : '△'} ${loc?.[k] ?? f.message}`).join(' · ')}
                  </p>
                ) : null;
              })()}
              <p><Stars stars={i.stars} /></p>
              <p>{i.why}</p>
              <p>
                <b style={{ color: 'var(--text)' }}>{t('dash.firstStep')}</b> {i.first_step}
              </p>
              <p>{t('dash.hours', { h: i.hours })} <span className="hint">· {t('dash.clickHint')} ›</span></p>
            </div>
            <div className="usd">${i.expected_usd}</div>
          </div>
        ))}
      </div>
      {!!plan?.backlog?.length && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px' }}>{t('dash.backlog')}</h3>
          {plan.backlog.map((i) => (
            <div
              className="plan-item clickable"
              key={i.opportunity_id}
              style={{ padding: '8px 8px' }}
              title={t('dash.clickHint')}
              onClick={() => { const r = routed.find((x) => x.opportunity.id === i.opportunity_id); if (r) setSelected(r); }}
            >
              <div>
                <h4 style={{ fontSize: 14 }}>
                  {i.name} <span className={`pill ${i.certainty === 'fixed' ? 'ok' : i.certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${i.certainty}` as Key)}</span>
                </h4>
                <p><Stars stars={i.stars} compact /> {i.why} · {t('dash.hours', { h: i.hours })}</p>
              </div>
              <div className="usd" style={{ fontSize: 15 }}>${i.expected_usd}</div>
            </div>
          ))}
        </div>
      )}
      {selected && <OpportunityPanel routed={selected} lang={lang} onLang={setLangState} onClose={() => setSelected(null)} />}
    </div>
  );
}
