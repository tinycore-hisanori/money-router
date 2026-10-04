import { runDiscovery } from './discover.js';

const max = Number(process.argv[2] ?? 12);
runDiscovery({ maxQueries: max })
  .then((r) => {
    for (const q of r.queries) console.log(`  [${q.category}] ${q.query}  (${q.hits} hits) — ${q.rationale}`);
    console.log(JSON.stringify({ new_candidates: r.new_candidates, brave_queries_used: r.brave_queries_used }));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
