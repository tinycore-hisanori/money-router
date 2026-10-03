// Tiny i18n: UI strings keyed by language. Add a language by adding a column.
export type Lang = 'ja' | 'en';

const dict = {
  // nav
  'nav.dashboard': { ja: 'ダッシュボード', en: 'Dashboard' },
  'nav.opportunities': { ja: '案件一覧', en: 'Opportunities' },
  'nav.sources': { ja: '収集元', en: 'Sources' },
  'nav.profile': { ja: 'プロフィール', en: 'Profile' },
  'nav.payments': { ja: 'PayPal入金', en: 'Payments' },
  'hdr.ai': { ja: 'AI', en: 'AI' },
  'hdr.crawl': { ja: '巡回', en: 'Crawl' },
  'hdr.never': { ja: '未実行', en: 'never' },
  'hdr.on': { ja: 'ON', en: 'on' },
  'hdr.off': { ja: 'OFF', en: 'off' },
  // dashboard
  'dash.eligible': { ja: 'あなた向け', en: 'Eligible for you' },
  'dash.ofOpps': { ja: '/ 全 {n} 件', en: '/ {n} opportunities' },
  'dash.certain': { ja: '今週 · 当てにできる額', en: 'This week · count on it' },
  'dash.certainSub': { ja: '確定＋やれば入る、{used}h / {budget}h', en: 'fixed + per-task, {used}h of {budget}h' },
  'dash.spec': { ja: '今週 · 売れたら', en: 'This week · speculative' },
  'dash.specSub': { ja: '投機的', en: 'if it sells' },
  'dash.verified': { ja: 'PayPalで確認済み', en: 'Verified via PayPal' },
  'dash.verifiedSub': { ja: '受取（突合済み）', en: 'received (matched)' },
  'dash.thisWeek': { ja: '今週やること', en: 'This week' },
  'dash.explain': { ja: 'AIに説明させる', en: 'Explain with AI' },
  'dash.thinking': { ja: '考え中…', en: 'Thinking…' },
  'dash.refresh': { ja: '更新', en: 'Refresh' },
  'dash.empty': { ja: '該当する案件がありません。プロフィール（国・スキル・時間）を見直してください。', en: 'No eligible opportunities. Update your profile (country, skills, hours).' },
  'dash.firstStep': { ja: '最初の一歩:', en: 'First step:' },
  'dash.hours': { ja: '今週 {h}h', en: '{h}h this week' },
  'dash.whyNot': { ja: '除外理由の内訳（全案件）', en: 'Why opportunities were excluded' },
  'excl.country': { ja: '国の制限', en: 'Country restriction' },
  'excl.skills': { ja: 'スキル不足', en: 'Missing skills' },
  'excl.min_payout_unreachable': { ja: '最低出金額に届かない', en: 'Min payout unreachable' },
  'excl.legitimacy': { ja: '正当性スコア不足', en: 'Low legitimacy score' },
  'excl.existing_account': { ja: '既存アカウント（新規限定）', en: 'Already have an account' },
  'excl.status': { ja: '停止・要注意', en: 'Paused / suspect' },
  // opportunities
  'opp.forYou': { ja: 'あなた向け', en: 'For you' },
  'opp.all': { ja: 'すべて', en: 'All' },
  'opp.legend': { ja: '* = 暫定スコア（差分審査またはseed）。正当性の数字にカーソルを当てると審査メモ。', en: '* = provisional score (diff audit or seed). Hover legitimacy for the auditor\'s notes.' },
  'opp.crawl': { ja: '今すぐ巡回', en: 'Run crawler now' },
  'opp.crawling': { ja: '巡回中…', en: 'Crawling…' },
  'opp.brief': { ja: '要約', en: 'Brief' },
  'opp.briefTitle': { ja: 'あなたの言語でAI要約', en: 'AI brief in your language' },
  'opp.openPage': { ja: '公式ページを開く', en: 'Open official page' },
  'col.opportunity': { ja: '案件', en: 'Opportunity' },
  'col.category': { ja: '種別', en: 'Category' },
  'col.certainty': { ja: '確実性', en: 'Certainty' },
  'col.score': { ja: 'スコア', en: 'Score' },
  'col.hourly': { ja: '$/h', en: '$/h' },
  'col.minPayout': { ja: '最低出金', en: 'Min payout' },
  'col.days': { ja: '入金まで(日)', en: 'Days to pay' },
  'col.legitimacy': { ja: '正当性', en: 'Legitimacy' },
  'col.verified': { ja: '実入金$', en: 'Verified $' },
  'col.whyNot': { ja: '除外理由', en: 'Why not' },
  'col.status': { ja: '状態', en: 'Status' },
  'cert.fixed': { ja: '確定', en: 'fixed' },
  'cert.per_task': { ja: 'やれば入る', en: 'per task' },
  'cert.speculative': { ja: '売れたら', en: 'speculative' },
  'brief.writing': { ja: '要約を作成中…', en: 'Writing brief…' },
  'brief.none': { ja: '要約はまだありません（AIがOFFか失敗）。', en: 'No brief yet (AI off or failed).' },
  'brief.legit': { ja: '正当性', en: 'Legitimacy' },
  'brief.notForYou': { ja: 'あなたには向かない理由:', en: 'Not for you:' },
  'brief.by': { ja: '生成: ', en: 'by ' },
  // profile
  'prof.country': { ja: '国（ISO2、例: JP）', en: 'Country (ISO2)' },
  'prof.language': { ja: '表示・要約の言語（ja, en, es…）', en: 'Language for UI & briefs (ja, en, es, …)' },
  'prof.hours': { ja: '週に使える時間', en: 'Hours per week' },
  'prof.paypal': { ja: 'PayPalメール（サンドボックス受取）', en: 'PayPal email (sandbox receiver)' },
  'prof.skills': { ja: 'スキル（カンマ区切り: html5_game_dev, web_dev, security, writing, design, audio, video, 3d, english…）', en: 'Skills (comma-separated: html5_game_dev, web_dev, security, writing, design, audio, video, 3d, english…)' },
  'prof.accounts': { ja: '既に持っているアカウント（source id、カンマ区切り。新規登録ボーナスを除外）', en: 'Existing accounts (source ids, comma-separated — excludes new-account bonuses)' },
  'prof.freeText': { ja: '自由記述（AIがスキルと時間を補完します）', en: 'Tell the router about yourself (AI fills in skills & hours)' },
  'prof.placeholder': { ja: '例: Phaserで HTML5 ゲームを作っている。英語は読める。週10時間。CrazyGames には出している。', en: 'e.g. I build HTML5 games with Phaser, read English fine, ~10 hours a week, already on CrazyGames.' },
  'prof.save': { ja: '保存', en: 'Save' },
  'prof.saveEnrich': { ja: '保存 + AI補完', en: 'Save + AI enrich' },
  // payments
  'pay.sync': { ja: 'PayPal同期（直近30日）', en: 'Sync PayPal (last 30 days)' },
  'pay.syncing': { ja: '同期中…', en: 'Syncing…' },
  'pay.hint': { ja: 'サンドボックスの入金を取得し、AIが案件と突合します。', en: 'Pulls incoming sandbox transactions and lets AI match them to opportunities.' },
  'pay.footer': { ja: '突合した入金は各案件の「実入金$」とランキングに反映されます。', en: 'Matched totals feed back into each opportunity\'s "Verified $" and ranking.' },
  'pay.date': { ja: '日時', en: 'Date' },
  'pay.amount': { ja: '金額', en: 'Amount' },
  'pay.payer': { ja: '送金元', en: 'Payer' },
  'pay.note': { ja: 'メモ / 件名', en: 'Note / subject' },
  'pay.matched': { ja: '突合先', en: 'Matched to' },
  'pay.match': { ja: '突合', en: 'Match' },
  'pay.unmatched': { ja: '— 未突合 —', en: '— unmatched —' },
  'pay.confirm': { ja: '確定', en: 'Confirm' },
  // sources
  'src.crawled': { ja: '巡回した収集元', en: 'Sources crawled' },
  'src.kept': { ja: '採用した案件', en: 'Opportunities kept' },
  'src.keptSub': { ja: 'PayPalで受取可', en: 'PayPal-payable' },
  'src.rejected': { ja: 'AIが却下', en: 'Rejected by AI' },
  'src.rejectedSub': { ja: 'PayPal払いが確認できず', en: 'no PayPal payout found' },
  'src.audit': { ja: '審査', en: 'Audit' },
  'src.source': { ja: '収集元', en: 'Source' },
  'src.result': { ja: '結果', en: 'Result' },
  'src.via': { ja: '取得方法', en: 'Via' },
  'src.keptCol': { ja: '採用', en: 'Kept' },
  'src.rejectedCol': { ja: '却下（理由）', en: 'Rejected (reason)' },
  'src.updated': { ja: '更新', en: 'updated' },
  'src.unchanged': { ja: '変更なし', en: 'unchanged' },
  'src.failed': { ja: '失敗', en: 'failed' },
  'src.page': { ja: 'ページ', en: 'page' },
} as const;

export type Key = keyof typeof dict;

let current: Lang = 'ja';
export const setLang = (l: string) => {
  current = l === 'ja' ? 'ja' : 'en';
};
export const getLang = () => current;

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = (dict[key] as any)[current] ?? (dict[key] as any).en ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
