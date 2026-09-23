// FEAT-155 source metadata only. Wire schemas and generated DTOs stay unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function consumerSourceLock(root, lockPath, destination, check, extra = {}) {
  const commit = check
    ? JSON.parse(readFileSync(destination, 'utf8')).source_commit
    : process.env.YIJIE_SCHEDULED_CONTRACTS_COMMIT;
  assert.match(commit ?? '', /^[0-9a-f]{40}$/, 'Explicit committed FEAT-155 Contracts source required');
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(git('rev-parse', '--verify', `${commit}^{commit}`).toString().trim(), commit);
  const bytes = git('show', `${commit}:${lockPath}`);
  assert.deepEqual(readFileSync(path.join(root, lockPath)), bytes, `Uncommitted source lock: ${lockPath}`);
  const lock = JSON.parse(bytes);
  const rows = [...(lock.sources ?? []), ...(Array.isArray(lock.generators) ? lock.generators : []), ...lock.generated];
  for (const row of rows) {
    assert.ok(!path.isAbsolute(row.path) && !row.path.split('/').some(v => !v || v === '.' || v === '..'));
    const committed = git('show', `${commit}:${row.path}`);
    assert.equal(createHash('sha256').update(committed).digest('hex'), row.sha256, `Committed digest: ${row.path}`);
    assert.deepEqual(readFileSync(path.join(root, row.path)), committed, `Source drift: ${row.path}`);
  }
  return Buffer.from(JSON.stringify({ ...lock, source_commit: commit, source_lock_path: lockPath, ...extra }, null, 2) + '\n');
}
