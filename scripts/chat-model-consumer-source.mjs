// FEAT-156 opt-in source metadata; committed family verification is unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {consumerSourceLock as committedSourceLock} from './scheduled-consumer-source.mjs';
export function consumerSourceLock(root,lockPath,destination,check,extra={}) {
  // FEAT-156 is explicitly an unreleased working-tree candidate. It cannot
  // satisfy an immutable consumer pin or be used by a release entry.
  const local = check ? JSON.parse(readFileSync(destination, 'utf8')).mode === 'local_worktree_candidate' : process.env.YIJIE_FEAT156_LOCAL_CANDIDATE === 'true';
  if (local) {
    const lock=JSON.parse(readFileSync(path.join(root,lockPath)));
    assert.equal(lock.release,false);
    const rows=[...(lock.sources??[]),...(Array.isArray(lock.generators)?lock.generators:[]),...lock.generated];
    for (const row of rows) {
      assert.ok(!path.isAbsolute(row.path) && !row.path.split('/').some(v=>!v||v==='.'||v==='..'));
      assert.equal(createHash('sha256').update(readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,row.path);
    }
    return Buffer.from(JSON.stringify({...lock,mode:'local_worktree_candidate',feature:'FEAT-156',source_lock_path:lockPath,...extra},null,2)+'\n');
  }
  return committedSourceLock(root,lockPath,destination,check,extra);
}
