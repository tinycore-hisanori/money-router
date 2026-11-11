import { useEffect, useState } from 'react';
import type { LocalizedSummary } from '@shared/types';
import { api, type Routed } from '../api';
import { t } from '../i18n';
import Stars from './Stars';
import { daysColor, daysLabel } from '../dates';
import type { ExecutionStatus } from '@shared/types';

const EXEC: ExecutionStatus[] = ['todo', 'applied', 'active', 'submitted', 'paid', 'won', 'lost', 'skipped'];

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
  onChange,
  style,
}: {
  routed: Routed;
  lang: string;
  onLang: (l: string) => void;
  onClose: () => void;
  onChange?: () => void;
  style?: React.CSSProperties;
}) {
  const [idea, setIdea] = useState(routed.note?.idea ?? '');
  const [note, setNote] = useState(routed.note?.note ?? '');
  const [noteMsg, setNoteMsg] = useState('');
  const [exec, setExec] = useState<ExecutionStatus | ''>(routed.execution ?? '');
  const saveNote = async () => {
    try {
      await api.setNote(routed.opportunity.id, { idea, note });
      setNoteMsg(t('note.saved'));
      onChange?.();
    } catch (e: any) {
      setNoteMsg(e?.status === 403 ? t('note.adminOnly') : String(e?.message ?? e));
    }
  };
  const setStatus = async (v: ExecutionStatus | '') => {
    setExec(v);
    await api.setExecution(routed.opportunity.id, (v || null) as ExecutionStatus | null);
    onChange?.();
  };
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
      <p style={{ margin: '0 0 8px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} title={t('stars.legend')}>
        <Stars stars={routed.stars} />
        {o.deadline && <b style={{ color: daysColor(o.deadline) }}>⏰ {o.deadline} · {daysLabel(o.deadline)}</b>}
        {(o.result_date || o.result_note) && <span className="muted" style={{ fontSize: 12 }}>🏁 {t('result.on')} {o.result_date ?? ''} {o.result_note ?? ''}</span>}
        <span className="spacer" />
        <select value={exec} onChange={(e) => setStatus(e.target.value as ExecutionStatus | '')} style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4 }}>
          <option value="">{t('st.' as any)}</option>
          {EXEC.map((s) => <option key={s} value={s}>{t(`st.${s}` as any)}</option>)}
        </select>
      </p>
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
      <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
        <label className="muted" style={{ fontSize: 12 }}>{t('note.idea')}
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={2} style={{ width: '100%', display: 'block', background: 'var(--bg)', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4, padding: 6, font: 'inherit' }} />
        </label>
        <label className="muted" style={{ fontSize: 12 }}>{t('note.note')}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%', display: 'block', background: 'var(--bg)', color: 'inherit', border: '1px solid var(--line)', borderRadius: 4, padding: 6, font: 'inherit' }} />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={saveNote} disabled={idea === (routed.note?.idea ?? '') && note === (routed.note?.note ?? '')}>{t('note.save')}</button>
          <span className="muted" style={{ fontSize: 12 }}>{noteMsg}</span>
        </div>
      </div>
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
        {t('col.category')}: {o.category} · {t('col.certainty')}: {t(`cert.${o.certainty}` as any)} · {t('col.hourly')}: ${routed.expected_hourly.toFixed(0)} · {t('col.minPayout')}: ${o.min_payout} · {t('col.days')}: {o.payout_days_estimate}{o.deadline ? ` · ${t('col.deadline')}: ${o.deadline}` : ''}{o.period ? ` · ${t('col.period')}: ${o.period}` : o.starts ? ` · ${t('col.period')}: ${o.starts} → ${o.deadline ?? '?'}` : ''}
      </p>
      <p className="muted" style={{ fontSize: 12 }}><a href={o.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{o.url} ↗</a></p>
    </div>
    </div>
  );
}
