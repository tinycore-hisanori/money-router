import { runRadar } from './radar.js';
runRadar({ maxQueries: Number(process.argv[2] ?? 10) })
  .then((r) => { for (const q of r.queries) console.log(`  [${q.lang}] ${q.query} (${q.hits})`); console.log(JSON.stringify({ pages: r.pages, added: r.added, updated: r.updated, expired: r.expired, brave: r.brave_queries_used })); })
  .catch((e) => { console.error(e); process.exit(1); });
