import { consumerSourceLock } from './scheduled-consumer-source.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const consumer = path.resolve(root, '../yijie-agent-host');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('Only --check is supported');
const check = args.includes('--check');
const lock = JSON.parse(readFileSync(path.join(root, 'compatibility/scheduled-task-recovery/source.lock.json')));
assert.equal(lock.mode, 'local_candidate'); assert.equal(lock.release, false);
assert.match(lock.base_commit, /^[0-9a-f]{40}$/);
execFileSync('git', ['cat-file', '-e', `${lock.base_commit}^{commit}`], { cwd: root });
const sources = new Map();
for (const file of [...lock.sources, ...lock.generated]) {
  const bytes = readFileSync(path.join(root, file.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Stale source: ${file.path}`);
  sources.set(file.path, bytes);
}
const pairs = [
  ['openapi/scheduled-task-recovery/scheduled-task-recovery.yaml', 'api/openapi/scheduled-task-recovery.yaml'],
  ['sdks/go/openapi/scheduled-task-recovery/types.gen.go', 'internal/contracts/scheduledrecovery/types.gen.go'],
  ['sdks/jsonschema/scheduled-task-recovery.schema.json', 'api/schemas/scheduled-task-recovery.schema.json'],
];
const outputs = pairs.map(([source, target]) => [target, sources.get(source)]);
outputs.push(['api/scheduled-task-recovery.candidate.json', consumerSourceLock(root, 'compatibility/scheduled-task-recovery/source.lock.json', path.join(consumer, 'api/scheduled-task-recovery.candidate.json'), check, { consumer: 'yijie-agent-host', copies: pairs.map(([source, target]) => ({ source, target })) })]);
// All source bytes are checked above. Legacy pins and Runtime are unchanged.
for (const [name, bytes] of outputs) {
  const target = path.join(consumer, name);
  if (check) assert.deepEqual(readFileSync(target), bytes, `Consumer drift: ${name}`);
  else { mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, bytes); }
}
console.log(`Scheduled recovery Host candidate ${check ? 'verified' : 'synchronized'}; release=false.`);

const desktop = path.resolve(root, '../yijie-desktop');
const desktopPairs = [
 ['sdks/rust/scheduled-task-recovery/types.gen.rs','src-tauri/src/chat/schedules/recovery_generated.rs'],
 ['sdks/jsonschema/scheduled-task-recovery.schema.json','contracts/scheduled-task-recovery.schema.json'],
 ['compatibility/scheduled-task-recovery/source.lock.json','contracts/scheduled-task-recovery.candidate.json'],
];
for(const [source,target] of desktopPairs){
 const dest=path.join(desktop,target);const bytes=source.endsWith('/source.lock.json') ? consumerSourceLock(root, source, dest, check) : readFileSync(path.join(root,source));
 if(check) assert.deepEqual(readFileSync(dest),bytes,target);
 else {mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,bytes);}
}
console.log('Scheduled recovery Desktop candidate '+(check?'verified':'synchronized')+'; release=false.');
