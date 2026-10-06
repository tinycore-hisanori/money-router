import { useEffect, useState } from 'react';
import type { LocalizedSummary } from '@shared/types';
import { api, type Routed } from '../api';
import { t } from '../i18n';

const LANGS = ['ja', 'en', 'es', 'pt', 'de', 'fr', 'ko', 'zh'];

/**
 * Detail / brief panel for one opportunity. Shared by Dashboard and Opportunities.
 * Loads the localized brief for `lang` (cached on the opportunity, else generated on demand).
 */
export default function OpportunityPanel({
  routed,
  lang,
  onLang,
  onClose,
  style,
}: {
  routed: Routed;
  lang: string;
  onLang: (l: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [brief, setBrief] = useState<LocalizedSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const o = routed.opportunity;

  useEffect(() => {
    const have = o.localized?.[lang];
    if (have) {
      setBrief(have);
      return;
    }
    setBrief(null);
    setErr('');
    setBusy(true);
    api
      .localize(o.id, lang)
      .then(setBrief)
      .catch((e) => {
        setBrief(null);
        if (e?.status === 429) setErr(t('guard.exhausted'));
      })
      .finally(() => setBusy(false));
  }, [o.id, lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
    <div className="card modal" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="toolbar">
        <h3 style={{ margin: 0, fontSize: 15 }}>{o.name}</h3>
        <div className="spacer" />
        <select value={lang} onChange={(e) => onLang(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4 }}>
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="ghost" style={{ padding: '2px 8px' }} onClick={onClose}>×</button>
      </div>
      {busy && <p className="muted">{t('brief.writing')}</p>}
      {brief && (
        <>
          <p>{brief.summary}</p>
          <ol style={{ paddingLeft: 18 }}>{brief.how_to.map((h, i) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}</ol>
          <p style={{ color: 'var(--accent)' }}>{brief.payout}</p>
          <p className="muted" style={{ fontSize: 12 }}>{t('brief.by')}{brief.generated_by}</p>
        </>
      )}
      {!brief && !busy && <p className="muted">{err || t('brief.none')}</p>}
      <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
      {(o.findings ?? []).length > 0 && (
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <b>{t('find.title')}</b>
          <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
            {o.findings.map((f, i) => (
              <li key={i} style={{ color: f.severity === 'warning' ? 'var(--danger)' : f.severity === 'caution' ? 'var(--accent-2)' : 'var(--muted)' }} title={f.evidence}>
                {f.severity === 'warning' ? '⚠' : f.severity === 'caution' ? '△' : 'ⓘ'} {brief?.findings?.[i] ?? f.message}
              </li>
            ))}
          </ul>
          {routed.effective_certainty !== o.certainty && <p className="muted" style={{ margin: 0 }}>{t('find.demoted')}</p>}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        <b style={{ color: routed.warnings.includes('eligibility_unverified') ? 'var(--danger)' : 'var(--text)' }}>{t('brief.eligibility')}</b>{' '}
        {routed.warnings.includes('eligibility_unverified') ? t('warn.eligibility_unverified') + ' — ' : ''}{o.eligibility_note}
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        <b style={{ color: 'var(--text)' }}>{t('brief.legit')} {o.legitimacy.score}</b> ({o.legitimacy.scored_by}, {o.legitimacy.mode})<br />
        {o.legitimacy.notes}
      </p>
      {routed.exclusions.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}><b style={{ color: 'var(--accent-2)' }}>{t('brief.notForYou')}</b> {routed.exclusions.map((e) => e.detail).join('; ')}</p>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        {t('col.category')}: {o.category} · {t('col.certainty')}: {t(`cert.${o.certainty}` as any)} · {t('col.hourly')}: ${routed.expected_hourly.toFixed(0)} · {t('col.minPayout')}: ${o.min_payout} · {t('col.days')}: {o.payout_days_estimate}{o.deadline ? ` · ${t('col.deadline')}: ${o.deadline}` : ''}
      </p>
      <p className="muted" style={{ fontSize: 12 }}><a href={o.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{o.url} ↗</a></p>
    </div>
    </div>
  );
}
