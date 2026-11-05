// Historical CLI retained as a thin alias to the existing shared checker.
// Do not maintain a second projection or different failure semantics.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [base, ...extra] = process.argv.slice(2);
assert.ok(/^[0-9a-f]{40}$/.test(base ?? '') && extra.length === 0, 'Pass one full baseline commit');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('bash', ['scripts/check-breaking.sh', base], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
