# Money Router v1.0 仕様書
## Money Router — an AI radar for PayPal-payable work, worldwide

- 作成日: 2026-10-03
- 応募先: PayPal AI Hackathon (Devpost) — 締切 2026-11-12 12:00 PST（JST 11/13 05:00）
- 前版: v0.6.0（日本の銀行キャンペーン監視、PHP/XServer）→ 全面作り直し。思想（取りこぼし防止・資金効率・今日やること）のみ継承
- 狙う賞: 総合 / Best Use of PayPal + AI / Best Use of Agentic Commerce / Best Use of AG Grid / Best Use of Render

---

## 1. プロダクト定義

### 1.1 一文で
世界中の「PayPalで報酬を受け取れる稼ぎ口」をAIが収集・審査し、ユーザーの国・スキル・時間に合わせて実行計画に変換し、PayPalの実入金で収益性を検証し続けるツール。

### 1.2 解く問題

**実例（2026-10-05）**：MapleStory Worlds Global Creator Challenge（Nexon、募集 6/4〜10/7、賞金総額 $65,000）を締切2日前まで知らなかった。告知が韓国中心でDevpostにも載らず、日本語情報も無かった。「情報は存在するのに、言語と場所の壁で届かない」—— Money Router の Discover が解くべき問題の典型。

- PayPal払いの副収入案件（ゲームポータル開発者収益、バグバウンティ、ユーザーテスト、アンケート、マイクロタスク、ストック素材、フリーランス、アフィリエイト、紹介特典）は無数にあるが、散在していて見つけにくい
- 詐欺・払われない・最低出金額に届かない案件が大量に混ざっている
- 「自分の国で使えるか」「自分のスキルで稼げるか」「いつ入金されるか」を案件ごとに調べるコストが高い
- 実際にいくら稼げたかを案件単位で把握している人はほぼいない

### 1.3 ターゲット
個人クリエイター・開発者・フリーランス・学生など、複数の小さな収入源をPayPalでまとめて受け取る人。開発者本人（インディーゲーム開発者、CrazyGames/GamePix等からPayPalで受取）が一次ユーザー。

### 1.4 3本柱
| 柱 | 役割 | AIの使い所 | PayPalの使い所 |
|---|---|---|---|
| Discover | 案件の収集・構造化・審査。**コンテスト・懸賞金・ハッカソン**を含む | ページからの構造化抽出、正当性スコア、重複統合、締切の抽出 | — |
| Route | ユーザー条件→実行計画 | 自然言語プロフィール解釈、優先度付け、週次プランの説明文生成 | — |
| Track | 実入金で閉じる | 入金と案件のマッチング、実測収益性でランキング更新 | Transaction Search API、Invoicing API、Payouts API（デモ用） |

---

## 2. スコープ

### 2.1 v1.0（提出版）に含む
- 登録制ソース（source registry）20〜30件のAIクローラー（Render Cron、1日1回）
- 案件データモデル（§4）とAI正当性スコア
- ユーザープロフィール（国、スキル、週の可処分時間、既に持っているアカウント、自然言語の自由記述）
- 対象外判定（国制限、スキル不足、最低出金額が現実的でない等）＋除外理由表示
- スコアリングと「今週やること」プラン生成
- PayPal Transaction Search による入金取得と、AIによる案件マッチング
- 実測収益（案件ごとの実入金合計、推奨→入金までの日数）に基づくランキング補正
- PayPal Invoicing による請求書ドラフト生成（フリーランス型案件向け、ユーザー確認後に送信）
- AG Grid による案件テーブル（フィルタ、ソート、グルーピング、実測列）
- Render へのデプロイ（Web Service + Cron Job）
- 3分デモ動画、README、英語提出文

### 2.2 含まない
- 案件への自動応募・自動アカウント作成
- 野良検索による新規ソース自動発見（v1.1以降）
- マルチユーザー・認証（単一ユーザーのローカルプロフィール。デモはサンドボックス固定）
- 通知（メール/Push）

---

## 3. システム構成

```
[Browser SPA (React + AG Grid)]
        |
        v
[API: Node.js / TypeScript (Hono or Express)]  ---- Render Web Service
   ├─ /api/opportunities     ← opportunities.json (or SQLite)
   ├─ /api/profile           ← user profile (server-side JSON, single user)
   ├─ /api/plan              ← Route engine + Claude で説明文生成
   ├─ /api/paypal/sync       ← PayPal Transaction Search → AI matching
   ├─ /api/paypal/invoice    ← PayPal Invoicing (draft → user confirm → send)
   └─ /api/status            ← crawl status
        |
        v
[Crawler: Render Cron Job, 1日1回]
   ├─ source_registry.json を巡回
   ├─ HTML → テキスト化 → Claude で構造化抽出 (JSON schema)
   ├─ 正当性スコアリング・重複統合
   └─ opportunities.json 更新（tmp + rename）

[PayPal Sandbox]
   ├─ Transaction Search API  (入金取得)
   ├─ Invoicing API           (請求書)
   └─ Payouts API             (デモ用: 模擬入金生成スクリプト)
```

- ストレージ: v1.0はJSONファイル（Render Diskにマウント）。SQLiteへの切替は任意
- LLM: Claude API（構造化抽出は tool use / JSON schema で強制）
- PayPal: REST API直叩き（`@paypal/paypal-server-sdk`）。Agent Toolkit / MCP Server はエージェント実行部で利用し、README で明記

---

## 4. データモデル

### 4.1 Opportunity（案件）
| フィールド | 型 | 意味 |
|---|---|---|
| id | string | 一意ID |
| source_id | string | source_registry のID |
| name | string | 案件名（例: CrazyGames Developer Revenue Share） |
| provider | string | 提供元 |
| category | enum | game_portal / bug_bounty / user_testing / survey / microtask / stock_assets / freelance / affiliate / referral / **contest** / **licensing** / **localization** / **data_collection** / other |
| url | string | 公式URL |
| payout_methods | string[] | 支払い方法。PayPal を含む案件のみ採用 |
| payout_currency | string | USD 等 |
| min_payout | number | 最低出金額 |
| payout_cycle | string | NET30 / weekly / on_request 等 |
| payout_days_estimate | integer | 作業〜入金までの目安日数 |
| reward_model | enum | per_task / rev_share / bounty / hourly / one_time |
| certainty | enum | fixed（条件を満たせば定額）/ per_task（1件やれば1件分、ただし受注が前提）/ speculative（売れるか分からない） |
| reward_estimate_usd | number | 1単位あたり or 月あたりの目安 |
| effort_hours_estimate | number | 1単位あたりの作業時間目安 |
| skills_required | string[] | 必要スキル（html5_game_dev, security, writing, design, ...） |
| countries_allowed | string[] | ISO2。空=全世界 |
| countries_blocked | string[] | ISO2 |
| requirements | string[] | 条件の箇条書き（年齢、ポートフォリオ等） |
| deadline | date \| null | 応募・提出締切（コンテスト、ハッカソン、期間限定プロモ）。開放型は null。**v0.6.0 の「申込期限」の継承** |
| eligibility_verified | bool | 参加資格（国・居住・年齢）を公式規約から確認できたか |
| eligibility_note | string | 資格条項の引用、または未確認の理由 |
| findings | Finding[] | **支払いリスク所見**。`code`（first_edition / individual_host / prize_not_locked / eligibility_missing / no_payout_history / payout_complaints / other）、`severity`（info / caution / warning）、`message`（英語。各言語訳は localized[lang].findings）、`evidence`（引用 or URL）。legitimacy_score（詐欺か否か）とは別に「詐欺ではないが払われないかもしれない」理由を根拠付きで残す |
| legitimacy_score | number 0-100 | AI審査スコア |
| legitimacy_notes | string | 根拠 |
| confidence | number 0-1 | 抽出信頼度 |
| status | enum | active / paused / closed / suspect |
| last_checked | datetime | 最終確認 |
| observed | object | 実測: total_received_usd, payments_count, avg_days_to_payout, last_payment_at |

### 4.2 Source（収集元）
| フィールド | 説明 |
|---|---|
| id, name, url | 収集元 |
| category | 上記カテゴリ |
| parse_hint | AIへの抽出ヒント（例: "developer payout terms are in the FAQ"） |
| trust_baseline | 0-100。運営者が付ける初期信頼度 |
| enabled | bool |

### 4.3 UserProfile
| フィールド | 説明 |
|---|---|
| country | ISO2 |
| skills | string[] |
| hours_per_week | number |
| existing_accounts | source_id[]（既存＝紹介/新規特典の対象外判定に使用） |
| free_text | 自然言語（例: "HTML5ゲームが作れる。英語は読める。週10時間"）→ AIが skills/hours を補完 |
| paypal_email | サンドボックス受取アカウント |

### 4.4 Payment（PayPal入金）
| フィールド | 説明 |
|---|---|
| transaction_id | PayPal transaction_id |
| amount, currency, date | 取引情報 |
| payer_name, payer_email, note, subject | マッチング材料 |
| matched_opportunity_id | AIマッチ結果（null可） |
| match_confidence | 0-1 |
| match_status | auto / confirmed / rejected（ユーザー承認可能） |

### 4.5 ExecutionStatus（案件ごとのユーザー状態）
todo / applied / active / paid / skipped — v0.6.0の実行状況管理を継承。

---

## 5. Discover（AIクローラー）

1. source_registry を巡回し、HTMLをテキスト化（Readability + 本文抽出）
2. Claude に JSON schema で構造化抽出を強制（§4.1の全フィールド）。PayPal が payout_methods に含まれない案件は破棄
3. 正当性スコアリング（別プロンプト）: ドメイン年齢・運営実体の明示・支払い条件の具体性・「登録料」等の危険シグナル・既知の詐欺パターン → 0-100
4. 既存案件との重複統合（同一URL or 名前類似）。変更点は diff として status に反映
5. tmp + rename で opportunities.json を更新、crawl_status.json に結果を記録

### 5.1 差分スキップ
取得したページ本文のハッシュを保存し、前回と同一ならLLMを呼ばない（規約ページの変更は月1〜2回程度）。これにより通常日のLLMコストは最小化される。

### 5.2 モデル構成（.envで工程別・曜日別に指定）
モデルIDは環境変数の文字列。新モデル登場時は1行差し替えで対応する。

```env
# 工程ごとの既定モデル
MODEL_EXTRACT=claude-sonnet-5-5      # ページ→JSON（差分がある日だけ）
MODEL_AUDIT=claude-sonnet-5-5        # 正当性スコア（差分がある日だけ）
MODEL_MATCH=claude-opus-5-5          # PayPal入金マッチング
MODEL_EXPLAIN=claude-opus-5-5        # 今週やることの英文

# 曜日ごとの審査スケジュール（未指定の曜日は MODEL_AUDIT で差分のみ）
# 書式: <dow>:<model>:<mode>  mode は full（active全件を再審査）| diff
AUDIT_SCHEDULE=mon:claude-fable-5-1:full,thu:claude-opus-5-5:full
```

- 曜日ローテは「何を投げるか」ではなく「その日の審査の深さ」の指定。full の日は差分の有無に関係なく active 全件を再審査し、詐欺化・条件改悪のドリフトを検知する
- 各スコアには `scored_by`（モデルID）と `scored_at` を記録。UIでは直近の full 審査スコアを正とし、diff 日に付いた暫定スコアは provisional 表示にする（モデル間でスコアの出方が異なるため平均しない）
- コスト目安: 月曜 Fable 全件（30件 × 約10k入力 + 1.5k出力 ≈ $5）× 4 ＋ 木曜 Opus 全件（≈ $2）× 4 ＋ 日々の Sonnet 差分 ≈ 月 $30 前後。全工程 Sonnet 差分のみなら月 $3〜5

初期ソース候補（30件程度、実装時に精査）:
- game_portal: CrazyGames, GamePix, Poki（要確認）, Yandex Games, itch.io
- bug_bounty: HackerOne, Bugcrowd, Intigriti, YesWeHack
- user_testing: UserTesting, Userlytics, TryMyUI(Trymata), PlaytestCloud
- survey/microtask: Prolific, Amazon MTurk（PayPal非対応なら除外）, Clickworker, Appen, Remotasks
- stock_assets: Shutterstock, Adobe Stock, Pond5, AudioJungle/Envato
- freelance: Upwork, Fiverr, Freelancer.com, PeoplePerHour
- affiliate/referral: Amazon Associates（PayPal非対応なら除外）, ShareASale, Impact, PayPal Referral
- other: Gumroad, Ko-fi, Buy Me a Coffee, Teespring/Spring

→ 「PayPal受取可」が確認できないものは AI が自動で落とす。これ自体がデモの見せ場。

### 5.3 コンテスト・懸賞金・ハッカソン（category: contest）
「期限と確定額がある情報」の代表であり、本プロダクトの原点（v0.6.0 の銀行キャンペーン）に最も近いカテゴリ。
- 収集元：Devpost（賞金は Devpost 経由で PayPal 支払い可）、itch.io ジャム（賞金ありのみ）、日本の公募サイト（登竜門／公募ガイド）、ゲーム会社の開発者コンテスト（Nexon 等）、各社ハッカソン告知
- **多言語ソースを前提にする**：韓国・中国・欧州の公募サイトも Discovery の検索対象に含め、要約はユーザー言語で出す（MapleStory の教訓）
- 抽出：`deadline` と賞金額を必ず取る。締切超過は `deadline_passed` として除外し、自動で `closed` 化
- **参加資格の検証を必須にする**（MapleStory の教訓その2：日本から参加できない可能性が規約に埋まっていた）：contest / referral は「Official Rules / 応募資格」ページを追加検索して本文に連結し、`eligibility_verified`（規約で明示的に確認できたか）と `eligibility_note`（引用）を抽出する。確認できない場合は `countries_allowed` を推測で埋めず、UI・要約に「参加資格 未確認（規約を確認）」の警告を出し、締切ブーストも付けない
- ルーティング：締切が近いほど優先（7日以内 ×1.5、30日以内 ×1.25）。certainty は `fixed`（賞金額が明示）
- **Event Radar（野良イベント探索）**：プラットフォーム登録制とは別に、「最近告知された単発イベント」をイベント名ではなく語彙（prize / deadline / 賞金 / 募集 / 공모전 / 상금 / 奖金 …）で英・日・韓・中の多言語検索（Brave freshness=1ヶ月）し、規約ページを添えて抽出 → 締切・賞金・参加資格付きで案件に直接登録（source_id = radar）。承認ゲートなし（ユーザーが支払う行為がないため、正当性スコアと資格警告で足りる）。締切超過で自動 closed。週1自動（RADAR_DOW）＋手動。MapleStory 型を拾うための本命機能

### 5.4 支払いリスク所見（findings）— contest / referral
**実例（2026-10-07）**：Overpowered Studios Game Jam #1（itch.io、賞金 $415 を PayPal 現金払い）。詐欺ではないが、賞金額が「目標額」で未確定、主催が個人で第1回、参加資格の記載なし。legitimacy_score 1本ではこのグレーが見えない。

| シグナル | 検出方法 | severity |
|---|---|---|
| 第1回目 | 名称に #1 / 1st / first、または過去開催の記述なし | caution |
| 個人主催 | 主催が企業・団体でなく個人アカウント | caution |
| 賞金未確定 | target / goal / TBD / will lock / depends on sponsors 等 | warning |
| 資格記載なし | eligibility_verified = false | warning |
| 支払い実績なし | 過去受賞者の受取報告が見つからない | caution |
| 不払い苦情 | 主催名 × never paid / not received / 未払い の検索（COMPLAINT SEARCH 節として抽出器に渡す）に信頼できる報告 | warning |

反映：
- warning が1件以上 → `effective_certainty = speculative`（重み 0.4）。**certain_usd には入れず speculative_usd に計上**
- 一覧に「リスク」列（⚠ warning 数 / △ caution 数、ツールチップに所見一覧）。Brief パネルと週次プランのカードに所見をユーザー言語で表示
- Track で入金が確認されたら、その案件の `no_payout_history` を解消（将来：同一主催者の次回開催に信頼を引き継ぐ）
- テストケースとして `overpowered-jam` をレジストリに登録（Event Radar が拾うべき典型例：PayPal 賞金・Devpost 非掲載・Discord 告知）

- 注意：コンテストは「応募すれば必ず入る」ではないため、週次プランの期待値は `reward × 採択率の保守的推定` を用いる（v1.1 で調整）

---

## 6. Route（実行計画）

### 6.1 対象外判定
- countries_allowed/blocked とユーザー国
- skills_required ⊄ ユーザー skills（AIが同義語を吸収）
- min_payout が reward_estimate × 想定実行回数を上回る（出金に届かない）
- legitimacy_score < 閾値（既定 60）
- existing_accounts に含まれ、かつ新規限定特典

除外理由は必ず表示（v0.6.0継承）。

### 6.2 スコア
```
expected_hourly = reward_estimate_usd / effort_hours_estimate
score = expected_hourly
        × certainty_weight (fixed 1.0 / per_task 0.9 / speculative 0.4)   // 「作れば売れるかも」は強く割引
        × deadline_urgency (7日以内 1.5 / 30日以内 1.25 / それ以外 1.0)  // 締切が近いものを先に
        × legitimacy_score/100
        × time_discount(payout_days_estimate)      // 入金が遠いほど減点
        × observed_boost                           // 実入金実績があれば加点、推奨後N日入金なしなら減点
```
時間予算（hours_per_week）内で貪欲法により選択 → 「今週やること」。締切のある案件は工数を締切までの週数で割って週あたりに配分し、1件が週枠の半分を超えないよう制限する（1件勝負にしない）。枠に入らなかった資格ありの案件は「次の候補」として並べる。プランは **certain_usd（fixed + per_task：当てにできる額）** と **speculative_usd（売れたら）** を分けて提示する。設計思想：夢を売らず、今週確実に入る額を先に出す。

#### 6.1.0 賞金は「見込み」に入れない
コンテスト・ハッカソン・ジャムの賞金は入賞しないと入らないため、抽出結果にかかわらず **effective_certainty = speculative（結果次第）** とし、週の見込み額（certain_usd）には含めない（PayPal で入金実績が確認できた案件を除く）。画面の文言も「当てにできます」ではなく「ほど入る見込みです」とし、賞金は「結果次第（入賞・売れたら）」に分けて表示する。

#### 6.1.1 コンテスト項目（賞金ハンター帳との整合）
賞金ハンター帳（Artifact）で実際に使っている項目を案件に取り込む：**開始日 starts／締切 deadline／期間表記 period／結果発表日 result_date／結果発表メモ result_note**。一覧の期間表記（"Sep 24 - Nov 18, 2026"）は取得時に機械的に ISO 化して AI に渡す（AI は書き写すだけ）。画面では締切に「あと N 日」（≤7日=赤、≤21日=橙）、結果発表は「N 日後に結果／結果出たかも」。

#### 6.1.2 状態と メモ
状態（execution）：未対応 todo／申込済 applied／対応中 active／**提出済・結果待ち submitted**／入金済 paid／**入賞 won**／**落選 lost**／見送り skipped。submitted・won・lost・paid・skipped は週次プランから外れ、submitted と applied はダッシュボードの「提出済・結果待ち」に結果発表日つきで並ぶ。
メモ（notes.json、管理者のみ書込）：**出すもの idea**（何で出すか）と **メモ note**。詳細モーダルで編集。v1.0 は単一ユーザー、ユーザー別メモは後続版。

#### 6.2.1 ★おすすめ度（人間向けの2軸、各1〜5）
スコアは機械用。人が一瞥で選べるよう、各案件に **楽（ease）** と **お得（payoff）** の★を付ける（LLM不使用・決定的）。
```
楽   = (工数の小ささ 0.4 + 条件・スキルの少なさ 0.2 + 入金の早さ 0.2 + 最低出金の低さ 0.2)
       × 締切あり 0.6 × 警告あり 0.7
お得 = (時給 log正規化(0〜$100/h) 0.6 + 報酬額 log正規化(0〜$1000) 0.4)
       × certainty_weight × legitimacy/100 × √time_discount
→ 0〜1 を 1〜5 ★ に丸める
```
例：PayPal紹介ボーナス 楽5/お得4、Devpostハッカソン 楽2/お得4、詐欺サンプル お得1、Overpowered（警告あり）楽2/お得2。

### 6.3 AIの役割
- free_text からのプロフィール補完
- 各推奨に対する「なぜあなたに向くか／最初の一歩」を1〜2文で生成（英語/日本語）
- 週次プラン全体の要約

---

## 7. Track（PayPal統合）

### 7.1 入金同期
- `GET /v1/reporting/transactions`（Transaction Search API, sandbox）で直近N日の受取取引を取得
- 各取引の payer_name / email / note / subject / amount と、active な案件・ユーザーの実行状況を Claude に渡し、最尤の案件へマッチング（confidence 付き）
- confidence < 0.7 は「要確認」としてユーザーに提示、確認で確定
- 確定した入金は opportunity.observed に集計 → §6.2 observed_boost に反映

### 7.2 請求書（Invoicing API）
- freelance / hourly 型の案件で、ユーザーが「請求する」を押すと、AIが作業内容から請求書ドラフトを生成
- `POST /v2/invoicing/invoices` でドラフト作成 → プレビュー → ユーザー確認 → `send`
- エージェントが取引を生成する部分として Agentic Commerce 賞に訴求

### 7.3 デモ用模擬入金
- Payouts API（sandbox）で、別のサンドボックスアカウントからユーザー受取アカウントへ「CrazyGames Revenue Share August」等の note 付きで送金するスクリプト `scripts/seed-payments.ts`
- 動画では Discover → Route → seed → sync → マッチング → ランキング変動 を一気通貫で見せる

### 7.4 エージェント実行（任意・時間があれば）
- PayPal Agent Toolkit / MCP Server を使い、「先週の入金を同期して、未請求の案件があれば請求書ドラフトを作って」を自然言語で実行できるチャット窓を追加

---

## 8. 画面

1. **Dashboard**: 今週やること（カード）、今週の期待収益、実測収益、巡回ステータス
2. **Opportunities**（AG Grid Community）: 全案件 / あなた向け 切替、列: 案件・カテゴリ・期待時給・最低出金・入金目安日数・正当性（scored_by付き）・実測受取額・状態。除外理由はツールチップ。行グルーピングはEnterprise機能のため使わず、カテゴリ切替タブ＋フィルタで代替
3. **Profile**: 国、スキル、時間、既存アカウント、自由記述
4. **Payments**: PayPal同期ボタン、入金一覧（AG Grid）、AIマッチ結果と確認UI
5. **Invoices**: ドラフト一覧、プレビュー、送信

言語: UIは英語（審査員向け）。日本語切替は任意。

---

## 9. セキュリティ・プライバシー
- PayPal資格情報はRender環境変数のみ。リポジトリに含めない（.env.example を置く）
- サンドボックス専用。本番資格情報を受け付けない（環境変数で `PAYPAL_ENV=sandbox` 固定）
- 氏名・住所・口座番号は保存しない。入金の payer 情報はマッチング後にハッシュ化可
- 案件URLは常に公式URLを保持し、ユーザーが一次情報を確認できるようにする
- 免責: 収益見積りは参考値。最終判断は公式条件を確認

---

## 10. デプロイ・リポジトリ
- GitHub 公開リポジトリ `money-router`、MIT License（About欄に表示）
- Render: Web Service（API+静的SPA）、Cron Job（crawler, 毎日）、Disk（JSON永続化）
- README: 概要、アーキテクチャ図、セットアップ（PayPal sandbox app作成→env→`npm run dev`）、`scripts/seed-payments.ts` の使い方、使用ツール一覧（PayPal APIs, Claude, AG Grid, Render）
- コミット履歴でハッカソン期間中の進捗を示す（既存プロジェクトの「意味のある進捗」要件）

---

## 11. 提出物チェックリスト
- [ ] 動作するホスト済みデモURL（Render）
- [ ] 公開GitHubリポジトリ＋ライセンス表示
- [ ] 3分未満のYouTube動画（商標ロゴ・著作権音楽なし。PayPalロゴの扱いは規約確認）
- [ ] 英語の説明文（問題・対象・PayPalとAIの使い方・使用ツール）
- [ ] 使用ツールの明記（PayPal Transaction Search / Invoicing / Payouts、Claude API、AG Grid、Render）

---

## 12. 受入基準
1. Crawler 実行後、opportunities.json に PayPal対応案件のみが構造化されて保存される
2. PayPal非対応ソースが自動で除外され、除外理由が status に記録される
3. 正当性スコアが全案件に付与され、閾値未満は「あなた向け」から除外される
4. プロフィール変更で対象外判定・スコア・今週やることが更新される
5. seed-payments 実行後、PayPal同期で入金が取得され、案件にマッチングされる
6. 入金確定後、該当案件の実測列とランキングが変化する
7. 請求書ドラフトがPayPalサンドボックスに作成され、送信できる
8. Render上でAPI・SPA・Cronが動作し、README手順で第三者が再現できる

---

## 13. スケジュール（締切 11/12 PST）
| 週 | 内容 |
|---|---|
| 10/3–10/6 | リポジトリ作成、PayPal sandbox app、骨格（API/SPA/Render）、データモデル |
| 10/7–10/13 | Discover: クローラー＋AI抽出＋正当性スコア、初期30ソース投入 |
| 10/14–10/20 | Route: 対象外判定・スコア・今週やること、AG Grid画面 |
| 10/21–10/27 | Track: Transaction Search同期＋AIマッチング、seed script、Invoicing |
| 10/28–11/3 | 仕上げ: Agent Toolkitチャット（任意）、README、英語提出文 |
| 11/4–11/9 | 動画撮影・編集、第三者再現テスト、提出 |
| 11/10–11/12 | 予備 |

※ Nebius（10/30締切）と並行するため、10/21–10/30 は薄くなる前提。

---

## 14. v1.1以降
- 野良検索による新規ソース発見（検索API＋AI審査）
- マルチユーザー＋PayPal Log In（Connect with PayPal）
- 通知（期限・新規高額案件・支払い遅延）
- 日本の銀行キャンペーン（v0.6.0の領域）を Discover の1カテゴリとして復活（AI抽出で）
- コンテストの期待値補正（採択率）、締切リマインド通知、多言語公募サイトの定期巡回（韓国・中国・欧州）
