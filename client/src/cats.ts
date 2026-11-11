import type { Category } from '@shared/types';
import { t, type Key } from './i18n';

/** Route-line colour per category (transit-map vocabulary). Readable on both light and dark surfaces. */
const COLORS: Record<Category, string> = {
  contest: '#d6336c',
  freelance: '#3b6cf6',
  user_testing: '#0e9aa7',
  survey: '#7c5cdb',
  microtask: '#d98a00',
  bug_bounty: '#8e44c9',
  stock_assets: '#1a9c63',
  game_portal: '#e8621a',
  affiliate: '#b0703c',
  referral: '#c94f9b',
  licensing: '#5b7a99',
  localization: '#2f8fd0',
  data_collection: '#6f8f2f',
  other: '#7b8494',
};
export const catColor = (c?: string) => COLORS[(c as Category) ?? 'other'] ?? COLORS.other;
export const catLabel = (c?: string) => t(`cat.${c ?? 'other'}` as Key);
