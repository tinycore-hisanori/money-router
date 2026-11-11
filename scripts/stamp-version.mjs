// Writes src/shared/version.json {version, commit, built_at}. Runs before build; the file is also
// committed so a copy deployed without .git (scp) still reports the last known commit.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { try { commit = JSON.parse(readFileSync('src/shared/version.json', 'utf8')).commit; } catch {} }
const out = { version: pkg.version, commit, built_at: new Date().toISOString() };
writeFileSync('src/shared/version.json', JSON.stringify(out, null, 2) + '\n');
console.log('[version]', out.version, out.commit);
