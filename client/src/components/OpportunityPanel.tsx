import { useEffect, useState } from 'react';
import type { LocalizedSummary } from '@shared/types';
import { api, type Routed } from '../api';
import { t } from '../i18n';
import Stars from './Stars';
import { daysColor, daysLabel } from '../dates';
import { catColor, catLabel } from '../cats';
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

  const fs = o.findings ?? [];
  const hasWarn = fs.some((f) => f.severity === 'warning');
  const where = o.countries_allowed.length ? o.countries_allowed.join(' ') : o.worldwide_stated ? t('opp.worldwide') : t('opp.whereUnknown');
  const dirty = idea !== (routed.note?.idea ?? '') || note !== (routed.note?.note ?? '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ ['--c' as any]: catColor(o.category), ...style }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={o.name}>
        <div className="modal-head">
          <div className="row1">
            <span className="cat">{catLabel(o.category)}</span>
            <span className={`pill ${routed.effective_certainty === 'fixed' ? 'ok' : routed.effective_certainty === 'per_task' ? 'warn' : ''}`}>{t(`cert.${routed.effective_certainty}` as any)}</span>
            <span className="muted">{o.provider}</span>
            <span className="spacer" />
            <select className="input" value={lang} onChange={(e) => onLang(e.target.value)} style={{ padding: '3px 6px' }} aria-label="language">
              {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className="icon-btn" onClick={onClose} aria-label="close">✕</button>
          </div>
          <h3>{o.name}</h3>
          <Stars stars={routed.stars} />
        </div>

        <div className="modal-body">
          <div className="facts">
            <div className="fact"><div className="k">{t('panel.reward')}</div><div className="v">${o.reward_estimate_usd.toLocaleString()}</div></div>
            <div className="fact"><div className="k">{t('panel.hourly')}</div><div className="v">${routed.expected_hourly.toFixed(0)}<small>{t('opp.perHour')}</small></div></div>
            {o.deadline && <div className="fact"><div className="k">{t('col.deadline')}</div><div className="v" style={{ color: daysColor(o.deadline) }}>{o.deadline.slice(5).replace('-', '/')} <small style={{ color: 'inherit' }}>{daysLabel(o.deadline)}</small></div></div>}
            {(o.result_date || o.result_note) && <div className="fact"><div className="k">{t('result.on')}</div><div className="v">{o.result_date ? o.result_date.slice(5).replace('-', '/') : ''} <small>{o.result_note ?? ''}</small></div></div>}
            <div className="fact"><div className="k">{t('panel.payout')}</div><div className="v">{t('panel.days', { n: o.payout_days_estimate })}</div></div>
            <div className="fact"><div className="k">{t('panel.min')}</div><div className="v">${o.min_payout}</div></div>
            <div className="fact"><div className="k">{t('panel.where')}</div><div className="v" style={{ fontSize: 14 }}>{where}</div></div>
          </div>
          {o.period && <p className="muted" style={{ margin: '-8px 0 0' }}>{t('col.period')}: {o.period}</p>}

          <div className="brief">
            {busy && <p className="muted">{t('brief.writing')}</p>}
            {brief && (
              <>
                <p>{brief.summary}</p>
                <ol>{brief.how_to.map((h, i) => <li key={i}>{h}</li>)}</ol>
                <p className="pay" style={{ marginTop: 8 }}>{brief.payout}</p>
              </>
            )}
            {!brief && !busy && <p className="muted">{err || t('brief.none')}</p>}
          </div>

          {fs.length > 0 && (
            <div className={`box risk ${hasWarn ? 'bad' : ''}`}>
              <h5>{t('find.title')}</h5>
              <ul>
                {fs.map((f, i) => (
                  <li key={i} className={f.severity === 'warning' ? 'w' : f.severity === 'caution' ? 'c' : ''} title={f.evidence}>
                    {f.severity === 'warning' ? '⚠' : f.severity === 'caution' ? '△' : 'ⓘ'} {brief?.findings?.[i] ?? f.message}
                  </li>
                ))}
              </ul>
              {routed.effective_certainty !== o.certainty && <p style={{ margin: '6px 0 0' }}>{t('find.demoted')}</p>}
            </div>
          )}

          {routed.exclusions.length > 0 && (
            <div className="box risk"><h5>{t('brief.notForYou')}</h5>{routed.exclusions.map((e) => e.detail).join(' / ')}</div>
          )}

          <div className="box">
            <h5 style={{ color: routed.warnings.includes('eligibility_unverified') ? 'var(--danger)' : undefined }}>
              {t('brief.eligibility')}{routed.warnings.includes('eligibility_unverified') ? ` — ${t('warn.eligibility_unverified')}` : ''}
            </h5>
            {o.eligibility_note}
          </div>

          <div className="box">
            <h5>{t('brief.legit')} <span className="num">{o.legitimacy.score}</span> / 100</h5>
            <div className="meter"><i style={{ width: `${o.legitimacy.score}%`, background: o.legitimacy.score >= 85 ? 'var(--accent)' : o.legitimacy.score >= 60 ? 'var(--accent-2)' : 'var(--danger)' }} /></div>
            {o.legitimacy.notes}
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{o.legitimacy.scored_by} / {o.legitimacy.mode}{brief ? ` / ${t('brief.by')}${brief.generated_by}` : ''}</div>
          </div>

          <div className="memo">
            <h5 style={{ margin: 0, fontFamily: 'var(--f-body)', fontSize: 13 }}>{t('panel.memo')}</h5>
            <label>{t('note.idea')}<textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={2} /></label>
            <label>{t('note.note')}<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="ghost" onClick={saveNote} disabled={!dirty}>{t('note.save')}</button>
              <span className="muted">{noteMsg}</span>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {t('col.status')}
            <select className="input" value={exec} onChange={(e) => setStatus(e.target.value as ExecutionStatus | '')} style={{ padding: '5px 8px' }}>
              <option value="">{t('st.' as any)}</option>
              {EXEC.map((s) => <option key={s} value={s}>{t(`st.${s}` as any)}</option>)}
            </select>
          </label>
          <span className="spacer" />
          <a href={o.url} target="_blank" rel="noreferrer"><button className="primary">{t('panel.open')}</button></a>
        </div>
      </div>
    </div>
  );
}
