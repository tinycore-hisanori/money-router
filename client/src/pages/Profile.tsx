import { useEffect, useState } from 'react';
import type { UserProfile } from '@shared/types';
import { api } from '../api';

export default function Profile({ onChange }: { onChange: () => void }) {
  const [p, setP] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState('');
  const [accounts, setAccounts] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.profile().then((x) => {
      setP(x);
      setSkills(x.skills.join(', '));
      setAccounts(x.existing_accounts.join(', '));
    });
  }, []);

  if (!p) return null;

  const save = async (enrich: boolean) => {
    setBusy(true);
    try {
      const next = await api.saveProfile({
        ...p,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        existing_accounts: accounts.split(',').map((s) => s.trim()).filter(Boolean),
        enrich,
      });
      setP(next);
      setSkills(next.skills.join(', '));
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="form">
        <label className="field">
          Country (ISO2)
          <input value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} />
        </label>
        <label className="field">
          Hours per week
          <input type="number" value={p.hours_per_week} onChange={(e) => setP({ ...p, hours_per_week: Number(e.target.value) })} />
        </label>
        <label className="field">
          PayPal email (sandbox receiver)
          <input value={p.paypal_email} onChange={(e) => setP({ ...p, paypal_email: e.target.value })} />
        </label>
        <label className="field wide">
          Skills (comma-separated: html5_game_dev, web_dev, security, writing, design, audio, video, 3d, english…)
          <input value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
        <label className="field wide">
          Existing accounts (source ids, comma-separated — excludes new-account bonuses)
          <input value={accounts} onChange={(e) => setAccounts(e.target.value)} />
        </label>
        <label className="field wide">
          Tell the router about yourself (AI fills in skills & hours)
          <textarea rows={4} value={p.free_text} onChange={(e) => setP({ ...p, free_text: e.target.value })} placeholder="e.g. I build HTML5 games with Phaser, read English fine, ~10 hours a week, already on CrazyGames." />
        </label>
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="primary" onClick={() => save(false)} disabled={busy}>Save</button>
        <button className="ghost" onClick={() => save(true)} disabled={busy}>Save + AI enrich</button>
      </div>
    </div>
  );
}
