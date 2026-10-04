import { useEffect, useState } from 'react';
import type { UserProfile } from '@shared/types';
import { api } from '../api';
import { t, type Key } from '../i18n';

const SKILL_QUESTIONS = ['html5_game_dev', 'game_dev', 'web_dev', 'mobile_dev', 'security', 'design', '3d', 'audio', 'video', 'writing', 'english', 'japanese', 'data', 'teaching'] as const;
const COUNTRIES: [string, string][] = [['JP', '日本 / Japan'], ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['IN', 'India'], ['ID', 'Indonesia'], ['PH', 'Philippines'], ['KR', 'Korea'], ['TW', 'Taiwan'], ['SG', 'Singapore'], ['NG', 'Nigeria'], ['ZA', 'South Africa']];
const LANGS: [string, string][] = [['ja', '日本語'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'], ['ko', '한국어'], ['zh', '中文']];
const HOURS = [2, 5, 10, 15, 20, 30, 40];

export default function Profile({ onChange }: { onChange: () => void }) {
  const [p, setP] = useState<UserProfile | null>(null);
  const [other, setOther] = useState('');
  const [accounts, setAccounts] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.profile().then((x) => {
      setP(x);
      setOther(x.skills.filter((s) => !(SKILL_QUESTIONS as readonly string[]).includes(s)).join(', '));
      setAccounts(x.existing_accounts.join(', '));
    });
  }, []);

  if (!p) return null;

  const toggle = (skill: string, on: boolean) =>
    setP({ ...p, skills: on ? Array.from(new Set([...p.skills, skill])) : p.skills.filter((s) => s !== skill) });

  const save = async (enrich: boolean) => {
    setBusy(true);
    try {
      const checked = p.skills.filter((s) => (SKILL_QUESTIONS as readonly string[]).includes(s));
      const extra = other.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const next = await api.saveProfile({
        ...p,
        skills: Array.from(new Set([...checked, ...extra])),
        existing_accounts: accounts.split(',').map((s) => s.trim()).filter(Boolean),
        enrich,
      });
      setP(next);
      setOther(next.skills.filter((s) => !(SKILL_QUESTIONS as readonly string[]).includes(s)).join(', '));
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const sel = { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', font: 'inherit' } as const;

  return (
    <div className="grid">
      <div className="card">
        <div className="form">
          <label className="field">
            {t('q.countryTitle')}
            <select style={sel} value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            {t('q.langTitle')}
            <select style={sel} value={p.language ?? 'ja'} onChange={(e) => setP({ ...p, language: e.target.value })}>
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            {t('q.hoursTitle')}
            <select style={sel} value={p.hours_per_week} onChange={(e) => setP({ ...p, hours_per_week: Number(e.target.value) })}>
              {HOURS.map((h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </label>
          <label className="field">
            {t('prof.paypal')}
            <input value={p.paypal_email} onChange={(e) => setP({ ...p, paypal_email: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="k" style={{ marginBottom: 10, color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('q.title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8 }}>
          {SKILL_QUESTIONS.map((s) => (
            <label key={s} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', background: p.skills.includes(s) ? '#1d2a24' : 'transparent' }}>
              <input type="checkbox" checked={p.skills.includes(s)} onChange={(e) => toggle(s, e.target.checked)} />
              <span>{t(`q.${s}` as Key)}</span>
            </label>
          ))}
        </div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="field wide">
            {t('q.other')}
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. electronics, translation" />
          </label>
          <label className="field wide">
            {t('prof.accounts')}
            <input value={accounts} onChange={(e) => setAccounts(e.target.value)} placeholder="crazygames, gamepix" />
          </label>
          <label className="field wide">
            {t('prof.freeText')}
            <textarea rows={3} value={p.free_text} onChange={(e) => setP({ ...p, free_text: e.target.value })} placeholder={t('prof.placeholder')} />
          </label>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => save(false)} disabled={busy}>{t('prof.save')}</button>
          <button className="ghost" onClick={() => save(true)} disabled={busy}>{t('prof.saveEnrich')}</button>
        </div>
      </div>
    </div>
  );
}
