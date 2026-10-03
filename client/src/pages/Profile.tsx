import { useEffect, useState } from 'react';
import type { UserProfile } from '@shared/types';
import { api } from '../api';
import { t } from '../i18n';

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
          {t('prof.country')}
          <input value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} />
        </label>
        <label className="field">
          {t('prof.language')}
          <input value={p.language ?? 'ja'} onChange={(e) => setP({ ...p, language: e.target.value })} />
        </label>
        <label className="field">
          {t('prof.hours')}
          <input type="number" value={p.hours_per_week} onChange={(e) => setP({ ...p, hours_per_week: Number(e.target.value) })} />
        </label>
        <label className="field">
          {t('prof.paypal')}
          <input value={p.paypal_email} onChange={(e) => setP({ ...p, paypal_email: e.target.value })} />
        </label>
        <label className="field wide">
          {t('prof.skills')}
          <input value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
        <label className="field wide">
          {t('prof.accounts')}
          <input value={accounts} onChange={(e) => setAccounts(e.target.value)} />
        </label>
        <label className="field wide">
          {t('prof.freeText')}
          <textarea rows={4} value={p.free_text} onChange={(e) => setP({ ...p, free_text: e.target.value })} placeholder={t('prof.placeholder')} />
        </label>
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="primary" onClick={() => save(false)} disabled={busy}>{t('prof.save')}</button>
        <button className="ghost" onClick={() => save(true)} disabled={busy}>{t('prof.saveEnrich')}</button>
      </div>
    </div>
  );
}
