import { t } from '../i18n';

/** Rating pair: ease (楽) and payoff (お得), 1-5 each. */
export default function Stars({ stars }: { stars?: { ease: number; payoff: number }; compact?: boolean }) {
  if (!stars) return null;
  const row = (label: string, n: number, cls: string) => (
    <span className={`rate ${cls}`} title={`${label} ${n}/5 — ${t('stars.legend')}`}>
      <span className="rate-k">{label}</span>
      <span className="rate-on">{'★'.repeat(n)}</span>
      <span className="rate-off">{'★'.repeat(5 - n)}</span>
    </span>
  );
  return (
    <span className="stars">
      {row(t('stars.ease'), stars.ease, 'ease')}
      {row(t('stars.payoff'), stars.payoff, 'payoff')}
    </span>
  );
}
