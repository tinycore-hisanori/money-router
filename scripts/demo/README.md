# Demo video recorder

> 日本語版: [README.ja.md](README.ja.md)

Records the 3-minute demo as a real browser session with an on-screen cursor, English captions and optional synthesized narration.

1. Copy the live data into a scratch dir: `opportunities.json`, `crawl_status.json`.
2. Start a local server on that data, replaying the sandbox payouts instead of calling PayPal:
   `DATA_DIR=<dir> PAYPAL_FIXTURE=scripts/demo/paypal-fixture.json PAYPAL_CLIENT_ID=x PAYPAL_CLIENT_SECRET=x CRAWLER_MODE=mock CRAWL_HOUR_UTC=99 PORT=3457 ADMIN_TOKEN=own JUDGE_TOKENS=j1 node dist/server/index.js`
3. Optional narration: `pip install kokoro-onnx soundfile`, put `kokoro.onnx` and `voices.bin` (kokoro-onnx release files) in `scripts/demo/tts/`, then `python3 scripts/demo/tts.py`. It writes one clip per caption and `clips.json`; the recorder then waits for each line to finish.
4. `OUT=<out dir> FONTS_CSS=<fonts.css> FONTS_DIR=<node_modules with @fontsource> node scripts/demo/record.mjs` (also writes `captions.json` with each clip's start time).
5. `cd <out dir> && ffmpeg -f concat -safe 0 -i list.txt -vf "fps=30,format=yuv420p" -c:v libx264 -crf 20 demo.mp4`, then mix the clips in at the times in `captions.json` (`adelay` + `amix`).

`paypal-fixture.json` holds the four sandbox payouts sent by `npm run seed:payments`.
