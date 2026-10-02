import {consumerSourceLock} from './chat-model-consumer-source.mjs';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, ['scripts/generate-runtime-chat-models.mjs', '--check'], {cwd: root});
const lockName = 'compatibility/runtime-chat-models/source.lock.json';
const check = process.argv.includes('--check');
for (const [source, destination] of [
  ['sdks/go/openapi/runtime-chat-models/artifact.gen.go', '../yijie-agent-host/internal/contracts/runtimechatmodels/artifact.gen.go'],
  [lockName, '../yijie-agent-host/api/runtime-chat-models.candidate.json'],
  [lockName, '../yijie-desktop/contracts/runtime-chat-models.candidate.json'],
]) {
  const target = path.resolve(root, destination);
  const bytes = source === lockName ? consumerSourceLock(root, lockName, target, check) : readFileSync(path.join(root, source));
  if (check) assert.deepEqual(readFileSync(target), bytes, destination);
  else { mkdirSync(path.dirname(target), {recursive: true}); writeFileSync(target, bytes); }
}
console.log('FEAT-156 Runtime consumers ' + (check ? 'verified' : 'synchronized'));
