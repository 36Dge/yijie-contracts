// FEAT-164 inactive Runtime candidate; existing projections remain untouched.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.resolve(root, '../yijie-codex');
const artifact = '.yijie/build/native-public-messages-r3/aarch64-apple-darwin';
assert.ok(process.argv.slice(2).every(arg => arg === '--check'));
const check = process.argv.includes('--check');
const schema = `${artifact}/generated-json-schema`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(path.join(runtime, name));
const base = JSON.parse(readFileSync(path.join(root, 'compatibility/runtime-input-only/source.lock.json')));
// Verify the retained authoritative projection before admitting an additional artifact.
execFileSync(process.execPath, ['scripts/generate-runtime-input-only.mjs', '--check'], {cwd: root});
const manifestBytes = read(`${artifact}/runtime-manifest.json`);
const manifest = JSON.parse(manifestBytes);
assert.deepEqual(manifest.upstream, base.upstream);
execFileSync("python3",["scripts/verify-web-search-sources-schema.py",path.join(runtime,schema)],{cwd:runtime});
assert.equal(manifest.rustToolchain, '1.95.0');
assert.equal(manifest.runtime.target, base.runtime_artifact.target);
assert.equal(manifest.runtime.version, base.runtime_artifact.version);
assert.equal(hash(read(`${artifact}/codex`)), manifest.runtime.sha256);
assert.equal(statSync(path.join(runtime, artifact, 'codex')).size, manifest.runtime.sizeBytes);
const expectedPatches = [...base.native_sources.filter(row => row.path.endsWith('.patch')).map(row => row.path),
  '.yijie/patches/chat-models/0004-feat-156-upstream-tool-choice.patch',
  '.yijie/patches/chat-models/0005-feat-156-terminal-tool-arguments.patch',
  '.yijie/patches/chat-models/0006-native-web-search-sources.patch',
  '.yijie/patches/chat-models/0007-feat-164-kimi-k31-pro.patch',
  '.yijie/patches/chat-models/0008-feat-164-kimi-responses-include.patch',
  '.yijie/patches/chat-models/0009-feat-164-native-failure-terminals.patch',
  '.yijie/patches/chat-models/0010-feat-164-sanitized-persistence-metrics.patch',
  '.yijie/patches/chat-models/0011-feat-164-graceful-state-close.patch',
  '.yijie/patches/chat-models/0012-web-retrieval-execution-guard.patch',
  '.yijie/patches/chat-models/0013-answer-completion.patch',
  '.yijie/patches/chat-models/0014-execution-progress.patch',
  '.yijie/patches/chat-models/0015-public-progress-completion.patch',
  '.yijie/patches/chat-models/0016-native-public-messages.patch',
  '.yijie/patches/chat-models/0017-native-public-message-validation.patch',
  '.yijie/patches/chat-models/0018-native-public-message-spelling.patch'];
assert.deepEqual(manifest.patches.map(row => row.path), expectedPatches);
for (const row of manifest.patches) assert.equal(hash(read(row.path)), row.sha256, row.path);
const files = readdirSync(path.join(runtime, schema), {recursive: true})
  .filter(name => statSync(path.join(runtime, schema, name)).isFile()).sort();
const tree = createHash('sha256');
for (const name of files) {
  const relative = Buffer.from(name.split(path.sep).join('/'));
  const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(relative.length));
  const bytes = read(`${schema}/${name}`);
  tree.update(length).update(relative).update(Buffer.from(hash(bytes), 'hex'));
}
assert.equal(files.length, manifest.appServer.schemaFileCount);
assert.equal(tree.digest('hex'), manifest.appServer.schemaTreeSha256);
const nativeSources = [...expectedPatches, '.yijie/upstream.env', 'scripts/build-kimi-k31-pro.sh',
  'scripts/build-kimi-k31-pro-r2.sh', 'scripts/write-kimi-k31-pro-r2-runtime-manifest.py',
  'scripts/build-kimi-k31-pro-r3.sh', 'scripts/check-kimi-k31-pro-r3.sh', 'scripts/write-kimi-k31-pro-r3-runtime-manifest.py',
  'scripts/build-kimi-k31-pro-r4.sh', 'scripts/check-kimi-k31-pro-r4.sh', 'scripts/write-kimi-k31-pro-r4-runtime-manifest.py',
  'scripts/build-kimi-k31-pro-r5.sh', 'scripts/check-kimi-k31-pro-r5.sh', 'scripts/write-kimi-k31-pro-r5-runtime-manifest.py',
  'scripts/build-web-retrieval-guard.sh', 'scripts/prepare-web-retrieval-guard.py', 'scripts/write-web-retrieval-guard-runtime-manifest.py',
  'scripts/build-answer-completion.sh', 'scripts/prepare-answer-completion.py', 'scripts/write-answer-completion-runtime-manifest.py',
  'scripts/build-execution-progress.sh', 'scripts/prepare-execution-progress.py', 'scripts/write-execution-progress-runtime-manifest.py',
  'scripts/build-public-progress-completion.sh', 'scripts/prepare-public-progress-completion.py', 'scripts/write-public-progress-completion-runtime-manifest.py',
  'scripts/build-native-public-messages.sh', 'scripts/prepare-native-public-messages.py', 'scripts/write-native-public-messages-runtime-manifest.py',
  'docs/native-public-messages.md',
  'scripts/build-native-public-messages-r2.sh', 'scripts/prepare-native-public-messages-r2.py', 'scripts/write-native-public-messages-r2-runtime-manifest.py',
  'docs/native-public-messages-r2.md',
  'scripts/build-native-public-messages-r3.sh', 'scripts/prepare-native-public-messages-r3.py', 'scripts/write-native-public-messages-r3-runtime-manifest.py',
  'docs/native-public-messages-r3.md',
  'scripts/check-feat164-state-close.py',
  'scripts/write-kimi-k31-pro-runtime-manifest.py',
  'scripts/write-chat-model-stream-runtime-manifest.py', 'scripts/write-web-search-sources-runtime-manifest.py',
  'scripts/verify-web-search-sources-schema.py', 'scripts/write-runtime-manifest.py',
  'scripts/runtime-env.sh', 'scripts/runtime_manifest.py', 'scripts/canonicalize-json.py',
  'scripts/verify-release-lock-drift.py', 'codex-rs/core/config.schema.json',
  `${schema}/v2/TurnStartParams.json`, `${schema}/v2/ConfigBatchWriteParams.json`,
  `${schema}/v2/ConfigWriteResponse.json`, `${artifact}/runtime-manifest.json`];
// Product sources must match one immutable Runtime commit; build artifacts
// remain separately content-addressed and are never substituted into Git.
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: runtime, encoding: 'utf8'}).trim();
for (const name of nativeSources.filter(name => !name.startsWith('.yijie/build/'))) {
  assert.deepEqual(read(name), execFileSync('git', ['show', `${sourceCommit}:${name}`], {cwd: runtime}), name);
}
const go = `// Code generated from the FEAT-164 inactive candidate manifest. DO NOT EDIT.
package runtimekimik31pro
import _ "embed"
// NativeConfigSchema is the exact pinned Runtime schema, not a Host reimplementation.
//go:embed config.schema.json
var NativeConfigSchema []byte
// NativeTurnStartSchema retains the canonical UserInput variants, including Skill.
//go:embed turn-start.schema.json
var NativeTurnStartSchema []byte
//go:embed config-batch-write.schema.json
var NativeConfigBatchWriteSchema []byte
//go:embed config-write-response.schema.json
var NativeConfigWriteResponseSchema []byte
const NativeConfigReloadMethod = "config/batchWrite"
const RuntimeBinarySHA256 = ${JSON.stringify(manifest.runtime.sha256)}
const RuntimeManifestSHA256 = ${JSON.stringify(hash(manifestBytes))}
const RuntimeBinarySize int64 = ${manifest.runtime.sizeBytes}
const RuntimeSchemaFileCount = ${manifest.appServer.schemaFileCount}
const RuntimeSchemaTreeSHA256 = ${JSON.stringify(manifest.appServer.schemaTreeSha256)}
const RuntimePatchManifest = ${JSON.stringify(JSON.stringify(manifest.patches))}
`;
const outputs = {
  'sdks/go/openapi/runtime-kimi-k31-pro/artifact.gen.go': execFileSync('gofmt', [], {input: go, encoding: 'utf8'}),
  'sdks/go/openapi/runtime-kimi-k31-pro/config.schema.json': read('codex-rs/core/config.schema.json'),
  'sdks/go/openapi/runtime-kimi-k31-pro/turn-start.schema.json': read(`${schema}/v2/TurnStartParams.json`),
  'sdks/go/openapi/runtime-kimi-k31-pro/config-batch-write.schema.json': read(`${schema}/v2/ConfigBatchWriteParams.json`),
  'sdks/go/openapi/runtime-kimi-k31-pro/config-write-response.schema.json': read(`${schema}/v2/ConfigWriteResponse.json`),
};
outputs['compatibility/runtime-kimi-k31-pro/source.lock.json'] = JSON.stringify({
  schema_version: 1, feature: 'FEAT-164', mode: 'local_worktree_candidate', release: false,
  authority: 'yijie-codex canonical native-public-messages-r3 candidate retaining the complete prior patch chain; one valid model-authored declaration in either exact v1 dot or hyphen namespace supplies effective public AgentMessage phase and same-turn continuation through the existing Runtime loop; no fuzzy phase inference or unknown-version acceptance; multiple unquoted standalone declarations across either spelling invalidate the declared phase and cannot request continuation, without splitting the real Item or dropping readable text; control lines are consumed in streaming and complete public projections, quoted/code examples stay literal; original provider phase/text/declarations remain in raw model history; native phase and end_turn retain precedence, while unknown messages remain unknown; no Host execution loop, hooks activation, permission change, migration or history rewriting; existing budgets, cancellation and two-attempt answer-only finalization remain authoritative',
  runtime_source: {repository: 'https://github.com/36Dge/yijie-codex.git', base_commit: sourceCommit},
  upstream: manifest.upstream, methods: [...base.methods, 'config/batchWrite'], experimental_api: false,
  wire_authority: {path: 'compatibility/runtime-input-only/source.lock.json', sha256: hash(readFileSync(path.join(root, 'compatibility/runtime-input-only/source.lock.json')))},
  runtime_artifact: manifest.runtime, runtime_manifest_sha256: hash(manifestBytes), runtime_schema: manifest.appServer,
  native_sources: nativeSources.map(name => ({path: name, sha256: hash(read(name))})),
  generators: ['scripts/generate-runtime-kimi-k31-pro.mjs']
    .map(name => ({path: name, sha256: hash(readFileSync(path.join(root, name)))})),
  generated: Object.entries(outputs).map(([name, bytes]) => ({path: name, sha256: hash(bytes)})),
}, null, 2) + '\n';
for (const [name, bytes] of Object.entries(outputs)) {
  const target = path.join(root, name);
  if (check) assert.deepEqual(readFileSync(target), Buffer.from(bytes), name);
  else { mkdirSync(path.dirname(target), {recursive: true}); writeFileSync(target, bytes); }
}
console.log('FEAT-164 inactive Runtime artifact projection ' + (check ? 'verified' : 'generated'));
