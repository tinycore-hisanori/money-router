import { t } from './i18n';

export function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function daysLabel(iso?: string | null): string {
  const n = daysLeft(iso);
  if (n == null) return '';
  if (n < 0) return t('days.past');
  if (n === 0) return t('days.today');
  return t('days.left', { n });
}

/** Color for a countdown: urgent ≤7d, soon ≤21d. */
export function daysColor(iso?: string | null): string {
  const n = daysLeft(iso);
  if (n == null || n < 0) return 'var(--muted)';
  if (n <= 7) return 'var(--danger)';
  if (n <= 21) return 'var(--accent-2)';
  return 'var(--accent)';
}
