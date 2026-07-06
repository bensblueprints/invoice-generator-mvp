// Swap the better-sqlite3 native binary between Node and Electron ABIs.
// Usage: node scripts/sqlite-runtime.js <node|electron>
// Uses prebuild-install (already shipped with better-sqlite3) — downloads a
// prebuilt binary, no compiler needed. Results are cached by prebuild-install,
// so switching modes is instant after the first run.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = process.argv[2];
if (!['node', 'electron'].includes(runtime)) {
  console.error('usage: node scripts/sqlite-runtime.js <node|electron>');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'better-sqlite3');
const marker = path.join(pkgDir, '.current-runtime');

const target = runtime === 'electron'
  ? JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8')).version
  : process.versions.node;

const want = `${runtime}@${target}`;
if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === want) process.exit(0);

console.log(`[sqlite-runtime] switching better-sqlite3 binary to ${want}…`);
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prebuild-install.cmd' : 'prebuild-install');
execSync(`"${bin}" -r ${runtime} -t ${target}`, { cwd: pkgDir, stdio: 'inherit', shell: true });
fs.writeFileSync(marker, want);
console.log('[sqlite-runtime] done.');
