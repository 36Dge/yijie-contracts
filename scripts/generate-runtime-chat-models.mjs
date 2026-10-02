// FEAT-156 artifact-only projection. Native wire stays in runtime-input-only.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.resolve(root, '../yijie-codex');
const artifact = '.yijie/build/chat-models-stream-args/aarch64-apple-darwin';
const schema = `${artifact}/generated-json-schema`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(path.join(runtime, name));
const base = JSON.parse(readFileSync(path.join(root, 'compatibility/runtime-input-only/source.lock.json')));
// Verify the retained authoritative projection before admitting an additional artifact.
execFileSync(process.execPath, ['scripts/generate-runtime-input-only.mjs', '--check'], {cwd: root});
const manifestBytes = read(`${artifact}/runtime-manifest.json`);
const manifest = JSON.parse(manifestBytes);
assert.deepEqual(manifest.upstream, base.upstream);
assert.deepEqual(manifest.appServer, base.runtime_schema);
assert.equal(manifest.rustToolchain, '1.95.0');
assert.equal(manifest.runtime.target, base.runtime_artifact.target);
assert.equal(manifest.runtime.version, base.runtime_artifact.version);
assert.equal(hash(read(`${artifact}/codex`)), manifest.runtime.sha256);
assert.equal(statSync(path.join(runtime, artifact, 'codex')).size, manifest.runtime.sizeBytes);
const expectedPatches = [...base.native_sources.filter(row => row.path.endsWith('.patch')).map(row => row.path),
  '.yijie/patches/chat-models/0004-feat-156-upstream-tool-choice.patch',
  '.yijie/patches/chat-models/0005-feat-156-terminal-tool-arguments.patch'];
assert.deepEqual(manifest.patches.map(row => row.path), expectedPatches);
for (const row of manifest.patches) assert.equal(hash(read(row.path)), row.sha256, row.path);
const files = readdirSync(path.join(runtime, schema), {recursive: true})
  .filter(name => statSync(path.join(runtime, schema, name)).isFile()).sort();
const tree = createHash('sha256');
for (const name of files) {
  const relative = Buffer.from(name.split(path.sep).join('/'));
  const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(relative.length));
  const bytes = read(`${schema}/${name}`);
  assert.deepEqual(bytes, read(`.yijie/schemas/input-only-app-server/generated-json-schema/${name}`), name);
  tree.update(length).update(relative).update(Buffer.from(hash(bytes), 'hex'));
}
assert.equal(files.length, 269);
assert.equal(tree.digest('hex'), manifest.appServer.schemaTreeSha256);
const nativeSources = [...expectedPatches, '.yijie/upstream.env', 'scripts/build-chat-model-stream-args.sh',
  'scripts/write-chat-model-stream-runtime-manifest.py', 'scripts/write-runtime-manifest.py',
  'scripts/runtime-env.sh', 'scripts/runtime_manifest.py', 'scripts/canonicalize-json.py',
  'scripts/verify-release-lock-drift.py', `${artifact}/runtime-manifest.json`];
const go = `// Code generated from the FEAT-156 native artifact manifest. DO NOT EDIT.
package runtimechatmodels
const RuntimeBinarySHA256 = ${JSON.stringify(manifest.runtime.sha256)}
const RuntimeManifestSHA256 = ${JSON.stringify(hash(manifestBytes))}
const RuntimeBinarySize int64 = ${manifest.runtime.sizeBytes}
const RuntimeSchemaFileCount = ${manifest.appServer.schemaFileCount}
const RuntimeSchemaTreeSHA256 = ${JSON.stringify(manifest.appServer.schemaTreeSha256)}
const RuntimePatchManifest = ${JSON.stringify(JSON.stringify(manifest.patches))}
`;
const outputs = {'sdks/go/openapi/runtime-chat-models/artifact.gen.go': execFileSync('gofmt', [], {input: go, encoding: 'utf8'})};
outputs['compatibility/runtime-chat-models/source.lock.json'] = JSON.stringify({
  schema_version: 1, feature: 'FEAT-156', mode: 'local_worktree_candidate', release: false,
  authority: 'yijie-codex canonical artifact; unchanged runtime-input-only wire authority',
  runtime_source: {repository: 'https://github.com/36Dge/yijie-codex.git', base_commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: runtime, encoding: 'utf8'}).trim()},
  upstream: manifest.upstream, methods: base.methods, experimental_api: false,
  wire_authority: {path: 'compatibility/runtime-input-only/source.lock.json', sha256: hash(readFileSync(path.join(root, 'compatibility/runtime-input-only/source.lock.json')))},
  runtime_artifact: manifest.runtime, runtime_manifest_sha256: hash(manifestBytes), runtime_schema: manifest.appServer,
  native_sources: nativeSources.map(name => ({path: name, sha256: hash(read(name))})),
  generators: ['scripts/generate-runtime-chat-models.mjs', 'scripts/sync-runtime-chat-models.mjs', 'scripts/chat-model-consumer-source.mjs']
    .map(name => ({path: name, sha256: hash(readFileSync(path.join(root, name)))})),
  generated: Object.entries(outputs).map(([name, bytes]) => ({path: name, sha256: hash(bytes)})),
}, null, 2) + '\n';
for (const [name, bytes] of Object.entries(outputs)) {
  const target = path.join(root, name);
  if (process.argv.includes('--check')) assert.deepEqual(readFileSync(target), Buffer.from(bytes), name);
  else { mkdirSync(path.dirname(target), {recursive: true}); writeFileSync(target, bytes); }
}
console.log('FEAT-156 Runtime artifact projection ' + (process.argv.includes('--check') ? 'verified' : 'generated'));
