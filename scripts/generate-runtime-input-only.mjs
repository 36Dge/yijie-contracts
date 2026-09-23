// Native Runtime source/schema remain authoritative. This leaf generator
// imports only the explicitly reviewed input-only policy surface.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.resolve(root, '../yijie-codex');
const runtimeCommit = 'fb79b1d53501ec90084b584af5fdbe221c7a25aa';
const nativeDir = '.yijie/schemas/input-only-app-server/generated-json-schema';
const artifactDir = '.yijie/build/input-only/aarch64-apple-darwin';
const hash = data => createHash('sha256').update(data).digest('hex');
const read = name => readFileSync(path.join(runtime, name));
const manifestBytes = read(`${artifactDir}/runtime-manifest.json`);
const manifest = JSON.parse(manifestBytes);
const schemaFiles = readdirSync(path.join(runtime, nativeDir), {recursive: true})
  .filter(name => statSync(path.join(runtime, nativeDir, name)).isFile()).sort();
const tree = createHash('sha256');
for (const name of schemaFiles) {
  const relative = Buffer.from(name.split(path.sep).join('/'));
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(relative.length));
  tree.update(length).update(relative).update(Buffer.from(hash(read(`${nativeDir}/${name}`)), 'hex'));
}
if (schemaFiles.length !== manifest.appServer.schemaFileCount ||
    tree.digest('hex') !== manifest.appServer.schemaTreeSha256) {
  throw new Error('Native schema tree differs from the artifact manifest');
}
const method = 'thread/inputOnlyPolicy/read';
const requestName = 'ThreadInputOnlyPolicyReadParams';
const responseName = 'ThreadInputOnlyPolicyReadResponse';
const requestBytes = read(`${nativeDir}/v2/${requestName}.json`);
const responseBytes = read(`${nativeDir}/v2/${responseName}.json`);
const request = JSON.parse(requestBytes);
const response = JSON.parse(responseBytes);
const requests = JSON.parse(read(`${nativeDir}/ClientRequest.json`));
if (!requests.oneOf.some(row => row.properties?.method?.enum?.includes(method))) {
  throw new Error('Native stable method is missing');
}
const activePatchPaths = [
  '.yijie/patches/0001-feat-126-filter-persistent-diagnostics.patch',
  '.yijie/patches/0002-feat-136-unified-exec-pre-emitter-command-lifecycle.patch',
  '.yijie/patches/input-only/0003-input-only-execution.patch',
];
if (manifest.appServer.experimentalApi !== false ||
    JSON.stringify(manifest.patches.map(row => row.path)) !== JSON.stringify(activePatchPaths)) {
  throw new Error('Input-only requires the stable, non-retired native patch set');
}
for (const row of manifest.patches) {
  if (hash(read(row.path)) !== row.sha256) throw new Error(`Native patch drift: ${row.path}`);
}
const definitions = new Map([
  ...Object.entries(request.definitions ?? {}),
  ...Object.entries(response.definitions ?? {}),
  [requestName, request], [responseName, response],
]);
const pascal = name => name[0].toUpperCase() + name.slice(1);
function goType(value) {
  if (value.$ref) return value.$ref.split('/').at(-1);
  if (value.anyOf?.length === 2 && value.anyOf.some(row => row.type === 'null')) {
    return `*${goType(value.anyOf.find(row => row.type !== 'null'))}`;
  }
  if (value.type === 'array') return `[]${goType(value.items)}`;
  if (value.type === 'string') return 'string';
  if (value.type === 'boolean') return 'bool';
  if (value.type === 'integer' && value.format === 'uint32') return 'uint32';
  throw new Error(`Unsupported native schema type: ${JSON.stringify(value)}`);
}
let go = '// Code generated from the native input-only stable schema. DO NOT EDIT.\npackage runtimeinputonly\n';
for (const [name, schema] of definitions) {
  if (schema.type !== 'object') {
    go += `type ${name} = ${goType(schema)}\n`;
    continue;
  }
  go += `type ${name} struct {\n`;
  for (const [field, value] of Object.entries(schema.properties)) {
    let type = goType(value);
    const required = schema.required?.includes(field);
    if (!required && !type.startsWith('*')) type = `*${type}`;
    go += `${pascal(field)} ${type} \`json:"${field}${required ? '' : ',omitempty'}"\`\n`;
  }
  go += '}\n';
}
go += `const Method = ${JSON.stringify(method)}\n`;
go += `const RuntimeBinarySHA256 = ${JSON.stringify(manifest.runtime.sha256)}\n`;
go += `const RuntimeManifestSHA256 = ${JSON.stringify(hash(manifestBytes))}\n`;
go += `const RuntimeBinarySize int64 = ${manifest.runtime.sizeBytes}\n`;
go += `const RuntimeSchemaFileCount = ${manifest.appServer.schemaFileCount}\n`;
go += `const RuntimeSchemaTreeSHA256 = ${JSON.stringify(manifest.appServer.schemaTreeSha256)}\n`;
go += `const RuntimePatchManifest = ${JSON.stringify(JSON.stringify(manifest.patches))}\n`;
const outputs = {
  'sdks/go/openapi/runtime-input-only/types.gen.go': execFileSync('gofmt', [], {input: go, encoding: 'utf8'}),
  'sdks/jsonschema/runtime-input-only/request.schema.json': requestBytes,
  'sdks/jsonschema/runtime-input-only/response.schema.json': responseBytes,
};
const nativeSources = [
  ...manifest.patches.map(row => row.path),
  'scripts/build-input-only.sh', 'scripts/write-runtime-manifest.py', '.yijie/upstream.env',
  'scripts/runtime-env.sh', 'scripts/canonicalize-json.py', 'scripts/verify-release-lock-drift.py', 'scripts/runtime_manifest.py',
  `${nativeDir}/ClientRequest.json`, `${nativeDir}/v2/${requestName}.json`,
  `${nativeDir}/v2/${responseName}.json`, `${artifactDir}/runtime-manifest.json`,
];
// The artifact remains the already-qualified bytes. Prove its source and every
// canonical schema against the committed Runtime, without rewriting the binary.
for (const name of [...nativeSources.filter(name => !name.startsWith('.yijie/build/')), ...schemaFiles.map(name => `${nativeDir}/${name}`)]) {
  const committed = execFileSync('git', ['show', `${runtimeCommit}:${name}`], {cwd: runtime, maxBuffer: 16 * 1024 * 1024});
  if (!committed.equals(read(name))) throw new Error(`Committed Runtime source drift: ${name}`);
}
outputs['compatibility/runtime-input-only/source.lock.json'] = JSON.stringify({
  schema_version: 1, mode: 'local_candidate', release: false,
  authority: 'yijie-codex canonical stable schema; no Host-defined native DTO',
  active_base_commit: 'b2b20e2fc4a0c94834f34d8cc459e488a1b56277',
  runtime_source: {repository: 'https://github.com/36Dge/yijie-codex.git', full_commit: runtimeCommit},
  upstream: manifest.upstream,
  methods: [method], experimental_api: false,
  runtime_artifact: manifest.runtime,
  runtime_manifest_sha256: hash(manifestBytes),
  runtime_schema: manifest.appServer,
  native_sources: nativeSources.map(name => ({path: name, sha256: hash(read(name))})),
  generators: ['scripts/generate-runtime-input-only.mjs', 'scripts/sync-runtime-input-only.mjs', 'scripts/scheduled-consumer-source.mjs']
    .map(name => ({path: name, sha256: hash(readFileSync(path.join(root, name)))})),
  generated: Object.entries(outputs).map(([name, bytes]) => ({path: name, sha256: hash(bytes)})),
}, null, 2) + '\n';
for (const [name, bytes] of Object.entries(outputs)) {
  const target = path.join(root, name);
  if (process.argv.includes('--check')) {
    if (!readFileSync(target).equals(Buffer.from(bytes))) throw new Error(`Generation drift: ${name}`);
  } else {
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, bytes);
  }
}
console.log('Native input-only projection ' + (process.argv.includes('--check') ? 'verified' : 'generated'));
