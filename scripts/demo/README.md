# Demo video recorder

Records the 3-minute demo as a real browser session with an on-screen cursor and English captions.

1. Copy the live data into a scratch dir: `opportunities.json`, `crawl_status.json`.
2. Start a local server on that data, replaying the sandbox payouts instead of calling PayPal:
   `DATA_DIR=<dir> PAYPAL_FIXTURE=scripts/demo/paypal-fixture.json PAYPAL_CLIENT_ID=x PAYPAL_CLIENT_SECRET=x CRAWLER_MODE=mock CRAWL_HOUR_UTC=99 PORT=3457 ADMIN_TOKEN=own JUDGE_TOKENS=j1 node dist/server/index.js`
3. `OUT=<out dir> FONTS_CSS=<fonts.css> FONTS_DIR=<node_modules with @fontsource> node scripts/demo/record.mjs`
4. `cd <out dir> && ffmpeg -f concat -safe 0 -i list.txt -vf "fps=30,format=yuv420p" -c:v libx264 -crf 20 demo.mp4`

`paypal-fixture.json` holds the four sandbox payouts sent by `npm run seed:payments`.
