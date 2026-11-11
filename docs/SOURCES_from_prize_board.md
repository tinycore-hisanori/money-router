# 賞金ハンター帳の案件の出元一覧（Money Router 収集元の追加候補）

- 作成: 2026-11-11（賞金ハンター帳の全43件から集計）
- 用途: Money Router / 懸賞金ハンターweb の Event Radar に巡回先として登録する
- 「件数」は賞金ハンター帳に載っている案件のうち、その出元経由のもの

## A. 定期巡回する一覧サイト（案件が継続的に出る）

| 出元 | 巡回URL | 種類 | 件数 | 帳の案件 | メモ |
|---|---|---|---|---|---|
| Devpost | https://devpost.com/hackathons （JSON: https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&order_by=prize-amount&per_page=40） | 海外ハッカソン | 13 | Amazon Build Ship Shape / Build With AI: Basics / Codegeist 2026 / Codex×TwitchCon / GitLab Life After Code / Kiroween 2026 / Meta VR Start / Nebius×NVIDIA / PayPal AI / Qloo / QNX Global / UGREEN AI NAS / Shipaton | 最重要。APIで賞金順に取れる。賞金表記に現金以外（クレジット等）を含む、インド・学生限定・現地開催が混ざるので資格チェック必須 |
| itch.io jams | https://itch.io/jams （賞金ありを絞り込む） | ゲームジャム | 6 | Epic AI MegaJam / Game Gauntlet SIM Jam / Slapjam #2 / thatgamejam 02 / Overpowered Jam #1 / Zoud GameLab | AI禁止のジャムが多いので AI ルール抽出が必須。ページ取得が失敗しやすい |
| Hackster.io | https://www.hackster.io/contests | ハード・電子工作コンテスト | 3 | Autodesk AU2027 Product / Infineon Boss Battle / Nordic Sustain the System | 無償ボード申請の締切が本締切より早い |
| lablab.ai | https://lablab.ai/ai-hackathons | AIハッカソン | 1 | AMD AI League Match 6 | リーグ形式で毎週〜隔週にマッチが出る |
| Cerebral Valley | https://cerebralvalley.ai/events | AIハッカソン | 1 | Built with Claude: Japan 2026 | ほぼ米国現地開催。オンライン・グローバル版だけ拾う。選考制が多い |
| RUN | https://events.run.world/ | ゲームジャム（自社） | 2 | RUN October Jam / RUN プラットフォーム（Editor's Choice） | 毎月 Creator Jam、毎週 Editor's Choice |
| Thingiverse | https://www.thingiverse.com/challenges | 3Dデザインコンテスト | 1 | Green&Hydro Challenge | AI利用を避ける記述あり（見送り） |
| PCBWay | https://www.pcbway.com/activity/ | 基板設計コンテスト | 2 | PCBWay 9th Project Design Contest（旧エントリ「PCBWay」含む） | 年1回 |
| 登竜門（JDN） | https://compe.japandesign.ne.jp/ | 国内公募ポータル | 2 | やまなしメディア芸術アワード / viviON CREATOR AWARD | 国内の賞金ありはまずここ。学生限定が多い |
| 公募ガイド | https://koubo.jp/ | 国内公募ポータル | 1 | デプロイナウコンテスト | |

## B. ニュース・まとめ（新規発見のきっかけ）

| 出元 | 巡回URL | 件数 | 帳の案件 | メモ |
|---|---|---|---|---|
| Dev Grants Daily | https://devgrantsdaily.com/ | 1 | Decentraland Creator Success | 開発者向け助成・グラントのまとめ |
| Global Game Jam ニュース | https://globalgamejam.org/news | 1 | Zoud GameLab | |
| indiegamesjp.dev | https://indiegamesjp.dev/ | 1 | SQUARE ENIX GAME CONTEST 2026 | 国内インディー向けコンテスト告知 |
| PR TIMES | https://prtimes.jp/ （「コンテスト 賞金」で検索） | 1 | ゲームクリエイター甲子園2026 | 国内主催者のプレスリリース |
| Unreal Engine フォーラム | https://forums.unrealengine.com/ | 1 | Epic AI MegaJam | Epic 主催イベントの一次告知 |

## C. 主催者の公式ページ（個別に見張る）

| 案件 | URL | 周期 |
|---|---|---|
| 東京eスポーツフェスタ ゲーム開発コンテスト | https://tokyoesportsfesta.jp/creator_contest/ | 年1回（9〜11月） |
| 講談社ゲームラボ Monthly Awards | （講談社ゲームラボ公式） | 毎月 |
| デプロイナウコンテスト | https://lolipop.jp/deploy-now/contest/ | 月間賞あり |
| GMOロボットハンドコンテスト | https://ai-robotics.gmo/lp/gmo-robot-hand-competition/ | 第1回 |
| Decentraland Creator Success | https://docs.decentraland.org/creator/studio-onboarding | 常時（毎週審査） |
| CAFF Small Farm Innovation Challenge | https://caff.org/innovation-challenge/ | 年1回 |
| SQUARE ENIX GAME CONTEST | https://gc2026.jp.square-enix.com/ | 単発 |
| EasyEDA Spark | （EasyEDA 公式） | 年1回 |
| NEDO Challenge（量子懸賞金） | （NEDO 公式） | シーズン制 |
| Agentic AI Hackathon with Google Cloud | （Google Cloud Japan 公式） | 年1回 |

## D. 調べたが案件が出なかった・除外した出元

- indiegamejams.com（ジャムのタイムライン）：賞金なしが大半
- Devpost の学生・地域限定（Arbiter Hacks、Health Hackathon 3.0 など）：資格で除外
- Roblox DevForum（Developer Challenge、Inspire、Games for Change）：年1回で今年分は終了。12〜1月に再確認

## 収集時の共通フィルタ（帳の運用から）

1. AI禁止は除外（AI利用OK・申告制・必須のみ）
2. 日本から参加できるか（除外国リスト・学生限定・現地開催）を確認
3. 賞金の中身（現金かクレジットか）と、1人がもらえる額を分ける
4. 締切はタイムゾーン付きで保存し、日本時間に換算
5. 結果発表日も一緒に取る（帳の resultDate）
