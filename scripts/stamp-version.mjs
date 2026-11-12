// Writes src/shared/version.json. The release number ("build") is bumped only by `npm run release`
// (run before each commit), so a copy deployed without .git (scp) shows exactly which release it runs.
import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let prev = {};
try { prev = JSON.parse(readFileSync('src/shared/version.json', 'utf8')); } catch {}
const bump = process.argv.includes('--bump');
const now = new Date().toISOString();
const out = {
  version: pkg.version,
  build: (prev.build ?? 0) + (bump ? 1 : 0),
  released_at: bump ? now : prev.released_at ?? now,
  built_at: now,
};
writeFileSync('src/shared/version.json', JSON.stringify(out, null, 2) + '\n');
console.log(`[version] v${out.version} #${out.build} (released ${out.released_at})`);
