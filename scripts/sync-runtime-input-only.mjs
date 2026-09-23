import { consumerSourceLock } from './scheduled-consumer-source.mjs';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockName = 'compatibility/runtime-input-only/source.lock.json';
const lock = JSON.parse(readFileSync(path.join(root, lockName)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const row of [...lock.generators, ...lock.generated]) {
  if (hash(readFileSync(path.join(root, row.path))) !== row.sha256) throw new Error(`Source drift: ${row.path}`);
}
for (const row of lock.native_sources) {
  if (hash(readFileSync(path.resolve(root, '../yijie-codex', row.path))) !== row.sha256) throw new Error(`Native source drift: ${row.path}`);
}
const pairs = [
  ['sdks/go/openapi/runtime-input-only/types.gen.go', 'internal/contracts/runtimeinputonly/types.gen.go'],
  ['sdks/jsonschema/runtime-input-only/request.schema.json', 'internal/contracts/runtimeinputonly/request.schema.json'],
  ['sdks/jsonschema/runtime-input-only/response.schema.json', 'internal/contracts/runtimeinputonly/response.schema.json'],
  [lockName, 'api/runtime-input-only.candidate.json'],
];
for (const [source, destination] of pairs) {
  const target = path.resolve(root, '../yijie-agent-host', destination);
  const bytes = source === lockName ? consumerSourceLock(root,lockName,target,process.argv.includes('--check')) : readFileSync(path.join(root, source));
  if (process.argv.includes('--check')) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`Host projection drift: ${destination}`);
  } else {
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, bytes);
  }
}
const desktopTarget = path.resolve(root, '../yijie-desktop/contracts/runtime-input-only.candidate.json');
const desktopBytes = consumerSourceLock(root,lockName,desktopTarget,process.argv.includes('--check'));
if (process.argv.includes('--check')) {
  if (!readFileSync(desktopTarget).equals(desktopBytes)) throw new Error('Desktop candidate artifact projection drift');
} else {
  mkdirSync(path.dirname(desktopTarget), {recursive: true});
  writeFileSync(desktopTarget, desktopBytes);
}
console.log('Input-only Host projection ' + (process.argv.includes('--check') ? 'verified' : 'synchronized'));
