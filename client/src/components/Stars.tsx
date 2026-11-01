import { t } from '../i18n';

/** ★ rating pair: ease (楽) and payoff (お得), 1-5 each. */
export default function Stars({ stars, compact }: { stars?: { ease: number; payoff: number }; compact?: boolean }) {
  if (!stars) return null;
  const row = (label: string, n: number, color: string) => (
    <span title={`${label} ${n}/5`} style={{ whiteSpace: 'nowrap', marginRight: compact ? 6 : 10 }}>
      {!compact && <span className="muted" style={{ fontSize: 11, marginRight: 3 }}>{label}</span>}
      {compact && <span style={{ fontSize: 11, marginRight: 2 }}>{label.slice(0, 1)}</span>}
      <span style={{ color, letterSpacing: -1 }}>{'★'.repeat(n)}</span>
      <span style={{ color: 'var(--line)', letterSpacing: -1 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
  return (
    <span className="stars">
      {row(t('stars.ease'), stars.ease, 'var(--accent-2)')}
      {row(t('stars.payoff'), stars.payoff, 'var(--accent)')}
    </span>
  );
}
