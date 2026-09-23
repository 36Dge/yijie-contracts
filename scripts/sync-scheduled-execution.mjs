import { consumerSourceLock } from './scheduled-consumer-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const consumer = path.resolve(root, '../yijie-desktop');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('Only --check supported');
const lockName = 'compatibility/scheduled-execution/source.lock.json';
const lockBytes = readFileSync(path.join(root, lockName));
const lock = JSON.parse(lockBytes);
assert.equal(lock.mode, 'local_candidate'); assert.equal(lock.release, false);
for (const file of [...lock.sources, ...lock.generated]) assert.equal(createHash('sha256').update(readFileSync(path.join(root, file.path))).digest('hex'), file.sha256, file.path);
const pairs = [
  ['sdks/rust/scheduled-execution/types.gen.rs', 'src-tauri/src/chat/schedules/execution_generated.rs'],
  ['sdks/typescript/src/jsonschema/scheduled-execution.gen.ts', 'src/domain/scheduled-execution.generated.ts'],
  ['sdks/jsonschema/scheduled-execution.schema.json', 'contracts/scheduled-execution.schema.json'],
  [lockName, 'contracts/scheduled-execution.candidate.json'],
];
for (const [source, target] of pairs) {
  const output = path.join(consumer, target); const bytes = source === lockName ? consumerSourceLock(root, lockName, output, args.includes('--check')) : readFileSync(path.join(root, source));
  if (args.includes('--check')) assert.deepEqual(readFileSync(output), bytes, target);
  else { mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, bytes); }
}
console.log('Scheduled execution Desktop candidate '+(args.includes('--check') ? 'verified' : 'synchronized')+'; release=false.');
