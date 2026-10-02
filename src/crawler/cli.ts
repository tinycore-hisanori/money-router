import { runCrawl } from './index.js';

runCrawl()
  .then((s) => console.log(JSON.stringify(s.totals)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
