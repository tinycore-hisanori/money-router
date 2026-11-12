# デモ動画の録画

> English version: [README.md](README.md)

画面上のカーソル、英語字幕、任意の合成ナレーションつきで、実際のブラウザ操作として3分のデモを録画する。

1. 本番データ（`opportunities.json`、`crawl_status.json`）を作業用フォルダにコピーする。
2. そのデータでローカルサーバーを起動する。PayPal を呼ぶ代わりにサンドボックス入金を再生する：
   `DATA_DIR=<dir> PAYPAL_FIXTURE=scripts/demo/paypal-fixture.json PAYPAL_CLIENT_ID=x PAYPAL_CLIENT_SECRET=x CRAWLER_MODE=mock CRAWL_HOUR_UTC=99 PORT=3457 ADMIN_TOKEN=own JUDGE_TOKENS=j1 node dist/server/index.js`
3. ナレーション（任意）：`pip install kokoro-onnx soundfile`、kokoro-onnx のリリースファイル `kokoro.onnx` と `voices.bin` を `scripts/demo/tts/` に置き、`python3 scripts/demo/tts.py` を実行する。字幕ごとの音声と `clips.json` ができ、録画側は各文を読み終わるまで待つ。
4. `OUT=<出力先> FONTS_CSS=<fonts.css> FONTS_DIR=<@fontsource の入った node_modules> node scripts/demo/record.mjs`（各音声の開始時刻を `captions.json` に書き出す）。
5. `cd <出力先> && ffmpeg -f concat -safe 0 -i list.txt -vf "fps=30,format=yuv420p" -c:v libx264 -crf 20 demo.mp4` のあと、`captions.json` の時刻に合わせて音声を重ねる（`adelay` + `amix`）。

`paypal-fixture.json` は `npm run seed:payments` で送ったサンドボックス入金4件。
