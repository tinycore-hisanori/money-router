import { useEffect, useState } from 'react';
import type { WeeklyPlan } from '@shared/types';
import { api, type Routed } from '../api';

export default function Dashboard({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [routed, setRouted] = useState<Routed[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.plan().then(setPlan);
    api.route().then(setRouted);
  }, [tick]);

  const observed = routed.reduce((s, r) => s + r.opportunity.observed.total_received_usd, 0);
  const eligible = routed.filter((r) => r.eligible).length;

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
          <div className="k">Eligible for you</div>
          <div className="v">
            {eligible} <small>/ {routed.length} opportunities</small>
          </div>
        </div>
        <div className="card">
          <div className="k">This week · expected</div>
          <div className="v">
            ${plan?.expected_usd ?? 0} <small>for {plan?.hours_used ?? 0}h of {plan?.hours_budget ?? 0}h</small>
          </div>
        </div>
        <div className="card">
          <div className="k">Verified via PayPal</div>
          <div className="v">
            ${observed.toFixed(2)} <small>received (matched)</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>This week</h3>
          <span className="muted">{plan?.summary}</span>
          <div className="spacer" />
          <button className="ghost" onClick={explain} disabled={busy}>
            {busy ? 'Thinking…' : 'Explain with AI'}
          </button>
          <button className="ghost" onClick={onChange}>Refresh</button>
        </div>
        {!plan?.items.length && <p className="muted">No eligible opportunities. Update your profile (country, skills, hours).</p>}
        {plan?.items.map((i) => (
          <div className="plan-item" key={i.opportunity_id}>
            <div>
              <h4>{i.name}</h4>
              <p>{i.why}</p>
              <p>
                <b style={{ color: 'var(--text)' }}>First step:</b> {i.first_step}
              </p>
              <p>{i.hours}h this week</p>
            </div>
            <div className="usd">${i.expected_usd}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
