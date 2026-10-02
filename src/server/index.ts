import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { config } from './lib/config.js';
import { api } from './routes/api.js';

const app = new Hono();
app.use(logger());

app.get('/api/health', (c) => c.json({ ok: true, service: 'money-router', env: config.paypal.env }));
app.route('/api', api);

// SPA (client/dist) — built by `npm run build`
app.use('/*', serveStatic({ root: './client/dist' }));
app.get('*', serveStatic({ path: './client/dist/index.html' }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Money Router API on http://localhost:${info.port} (crawler: ${config.crawler.mode})`);
});

// In-process daily crawl (Render web services can't share a disk with cron jobs).
if (config.crawler.hourUtc !== null) {
  let lastDay = '';
  setInterval(async () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== config.crawler.hourUtc || lastDay === day) return;
    lastDay = day;
    try {
      const { runCrawl } = await import('../crawler/index.js');
      await runCrawl();
    } catch (e) {
      console.error('[crawl] scheduled run failed', e);
    }
  }, 60_000);
}
