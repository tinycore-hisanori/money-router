# Money Router — Devpost 提出文（PayPal AI Hackathon）日本語版

> English version (Devpost にはこちらを貼る): [SUBMISSION.md](SUBMISSION.md)

各見出しは Devpost の同名欄に対応する。末尾に作者用メモ。

---

## プロジェクト名
Money Router

## タグライン（60字以内）
An AI radar for PayPal-payable work, worldwide（PayPalで受け取れる世界中の仕事を探すAIレーダー）

## リンク
- ライブデモ: https://money-router.kitakuarcade.com
- コード（MIT）: https://github.com/tinycore-hisanori/money-router
- 動画: https://youtu.be/ojJBASD8UA4

---

## きっかけ
ネットで合法的に小さく稼ぐ手段は、何百ものサイトに散らばっている。ユーザーテストのパネル、バグバウンティ、フリーランスのマーケット、ゲームポータル、ハッカソンやゲームジャム。それぞれ国の条件・最低出金額・支払い方法が違い、中身が薄いもの、支払いが遅いもの、実は世界の大半から参加できないものも多い。その中から「自分に合っていて、しかもPayPalで実際に払われるもの」を探すには、規約を何時間も読む必要がある。

その読む作業を代わりにやり、今週の時間を使う価値があるかを正直に教え、結果をPayPalに実際に届いたお金で確かめるツールが欲しかった。

## 何をするか
Money Router は世界中の稼ぎ口を集め、AIで審査し、良いものをあなたに振り分け、結果をPayPalアカウントで検証する。

1. **集める** — クローラーが50以上の収集元（Devpost、itch.io のジャム、UserTesting、Prolific、HackerOne、Upwork、Fiverr、GamePix…）を巡回する。加えて *Event Radar* が英語・日本語・韓国語・中国語で単発のコンテストを検索する。Claude が各案件を構造化データ（報酬、支払い方法、最低出金額、対象国、締切、必要スキル）に抽出する。**PayPalで受け取れないものは除外し、その理由を表示する。**
2. **審査する** — AIの2段目で正当性（0〜100）を採点し、それとは別に*支払いリスク所見*を記録する（第1回開催で支払い実績なし、賞金総額が確定ではなく「目標」、参加資格の記載なし、など）。warning レベルの所見があると「確定」から「結果次第」に自動で格下げされる。コンテストの賞金は「当てにできるお金」には決して入れない。
3. **振り分ける** — プロフィール（国、スキル、週の作業時間）で実行できないものを除き、残りを「期待時給 × 確実性 × 正当性 × 入金の早さ」で並べる。各案件には *楽* と *お得* の2つの★評価が付く。ダッシュボードは時間内に収まる週のルートを提案する。
4. **管理する** — **+ やる** を押すとその案件が自分のものになる。締切までの日数、出すもの、週の時間予算、状態の流れ（未対応 → 対応中 → 提出済／作業完了 → 入賞 → 入金済、さらに「やめる」「やっぱりやる」、1クリックで元に戻せる）。
5. **PayPalで検証する** — PayPal Transaction Search API で入金を読み取り、Claude が各入金をどの案件から来たものか照合する（入賞・提出済の案件を優先候補にする）。照合された入金で案件は *入金済* になり、実測の支払い実績がランキングに反映される。要約・所見・説明文はすべて閲覧者の言語（英語／日本語）で表示する。

## 作り方
- **TypeScript で一貫**：Node 20 上の Hono API、React 18 + Vite のフロント、表表示に AG Grid、ユーザーごとのJSONファイル保存。
- **Claude API の構造化出力**（`output_config.format` の JSON schema）で、抽出・正当性審査・支払いリスク所見・翻訳・入金照合・プランの説明を行う。モデルは工程ごとに設定。審査は週単位のスケジュール（週2日は全件再審査、他の日は差分のみ）でコストを抑える。
- **Brave Search API**：ページの予備探索、公式規約の検索、苦情検索（"never paid"、"scam"）、多言語 Event Radar。
- **PayPal REST API（サンドボックス）**：Transaction Search（入金取得）、Invoicing v2（完了した仕事の請求）、Payouts v1（2つ目のサンドボックスアカウントからそれらしい入金を作るため）。
- **大事なところは決定的に**：一覧APIの日付範囲はモデルではなくコードで解析する。案件IDはURLから作るので、再巡回しても選んだ案件やメモが残る。ルートのスコアと楽／お得の★は単純な式。
- 小さなVPS上で Nginx + Cloudflare の背後に置く。クローラーはプロセス内でスケジュール実行し、時間のかかる処理はバックグラウンドジョブにしてUIがポーリングする。

## 苦労した点
- **「全世界」はたいてい明記されていない。** 初期版は推測していた。今は「全世界と明記」と「記載なし」を区別し、公式規約だけを確認済みの資格として扱う。
- **ハッカソンの賞金は収入ではない。** 賞金総額 $25,000 で週の見込みがおかしくなった。今は賞金は常に「結果次第」で、見込み額には入れない。
- **モデルは名前を変える。** 同じ案件が "Upwork Freelancers" と "Upwork Freelancer Contracts (PayPal withdrawal)" として返ってきて、ユーザーの状態が黙って宙に浮いた。IDをURLベースにし、それでもIDが変わったときはクローラーが全ユーザーの状態を後継に移す。
- **大きなJSON一覧**がモデルの出力上限を超えた。抽出前に一覧APIを1件数行に圧縮する。
- **共有デモ** — 審査員キーごとにサーバー側の別ユーザーを用意し、テスター同士が上書きし合わないようにした。

## 誇れる点
- 盛らない。結果次第のお金、未確認の参加資格、支払いリスクを平易な言葉で表示する。
- 一連の流れが端から端まで動く：探す → 審査 → 選ぶ → 提出 → 入賞 → PayPal入金を照合 → 入金済。
- 実際の支払いリスク事例を自力で見つけた：PayPal賞金総額が「目標」でしかない第1回のゲームジャムを、理由を明記して格下げした。

## 学んだこと
構造化出力で抽出は安定するが、プロダクトの信頼できる部分はモデルの周りにある決定的なガードレールだった。何を確認済みとするか、何を収入とみなすか、案件がどのIDを保つか。

## 今後
- **Log In with PayPal** をアカウントの仕組みにする：ユーザーデータを端末間で同期し、PayPalのメールアドレスを入金照合にそのまま使う。
- 費用のかかるAI機能（AIによる収集元探索、Event Radar、毎日の再審査）を**有料枠**に。無料枠は検索・審査結果・管理を残す。
- 審査後に本番PayPal、地域の収集元の追加、プロフィールに合う新着案件の週次メール。

## 使用技術
TypeScript, Node.js, Hono, React, Vite, AG Grid, Claude API (Anthropic), Brave Search API, PayPal REST APIs (Transaction Search, Invoicing, Payouts — sandbox), Nginx, Cloudflare, PM2

---

## テスト手順（審査員向けの非公開欄）
次のリンクのどれかを開く。それぞれ独立したユーザーとしてログインする（プロフィール・選んだ案件・メモは別々にサーバーに保存され、スマホでもPCでも同じ）。

- 審査員A: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #1>
- 審査員B: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #2>
- 審査員C: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #3>
- 審査員D: https://money-router.kitakuarcade.com/?key=<JUDGE_TOKENS #4>

おすすめの流れ（5分）：
1. プロフィールの質問（国、できること、週の時間）に答える。UI言語の切り替えは右上（EN／日本語）。
2. **Dashboard** に週のおすすめルートが出る。カードをクリックするとAI要約、支払いリスク所見、参加資格、正当性スコアが見られる。
3. 2〜3件で **+ Pick** を押す。締切・時間予算・状態の流れつきの「My picks」になる。「✓ Submitted」／「✓ Work done」、「Give up」／「Pick again」、Undo バーを試す。
4. **Payments** → *Sync PayPal* でサンドボックスの入金を取得し、Claude が案件に照合する。提出済のコンテストを Won にして *Check PayPal* を押すと、照合された入金で Paid に移る。
5. **Opportunities** → *All* で除外・対象外の案件と理由が見られる。*Overpowered Studios Game Jam #1* が格下げの好例。
6. **Sources** に巡回したすべての収集元と、残したもの・除外した理由が並ぶ。

PayPal はサンドボックスモード。実際のお金は動かない。

---

## 作者用メモ
- Devpost には英語版（SUBMISSION.md）の各見出しを同名欄に貼る。「Testing instructions」は非公開欄。`<JUDGE_TOKENS #n>` を VPS の `.env` の `JUDGE_TOKENS=` の値（カンマ区切りの4つ）に置き換える。
- 「It caught a real payment-risk case」はライブデータで Overpowered の所見が出ていることが前提（2026-11-12 のクロールで所見5件を確認済み）。
- 「What's next」の PayPal ログインと課金枠は、決めた方針（無料=閲覧と管理、課金=同期とAI探索）をそのまま書いた。
