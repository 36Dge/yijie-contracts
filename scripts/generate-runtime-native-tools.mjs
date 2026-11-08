// Canonical local-development projection of the four approved native tool groups.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fork = path.resolve(root, "../yijie-codex");
const family = "compatibility/runtime-native-tools";
const check = process.argv.includes("--check");
const sync = process.argv.includes("--sync");
assert(process.argv.slice(2).every(arg => ["--check", "--sync"].includes(arg)));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const read = (base, name) => readFileSync(path.join(base, name));
const current = JSON.parse(read(fork, ".yijie/build/native-tools-v1/current.json"));
assert.equal(current.schema_version, 1);
assert.match(current.source_sha256, /^[a-f0-9]{64}$/);
assert.equal(current.artifact, current.source_sha256 + "/aarch64-apple-darwin");
const artifact = path.join(fork, ".yijie/build/native-tools-v1", current.artifact);
const nativePatches = [".yijie/patches/chat-models/0020-native-tool-integration.patch", ".yijie/patches/chat-models/0021-native-tool-policy-audit.patch"];
const inputNames = [...nativePatches,
  "scripts/build-native-tools.sh", "scripts/prepare-native-tools.py", "scripts/write-native-tools-runtime-manifest.py"];
const inputHash = createHash("sha256");
for (const name of inputNames) inputHash.update(name).update("\0").update(read(fork, name));
assert.equal(inputHash.digest("hex"), current.source_sha256, "native candidate source changed");
const manifestBytes = read(artifact, "runtime-manifest.json");
const manifest = JSON.parse(manifestBytes);
const previous = JSON.parse(read(root, "compatibility/runtime-host-images/source.lock.json"));
assert.deepEqual(manifest.patches.slice(0, previous.patches.length), previous.patches);
assert.deepEqual(manifest.patches.slice(previous.patches.length).map(p => p.path), nativePatches);
assert.equal(manifest.appServer.experimentalApi, false);
assert.equal(manifest.appServer.transport, "stdio");
for (const p of manifest.patches) assert.equal(hash(read(fork, p.path)), p.sha256, p.path);
const binary = read(artifact, "codex");
assert.equal(binary.length, manifest.runtime.sizeBytes);
assert.equal(hash(binary), manifest.runtime.sha256);
const schemaRoot = path.join(artifact, "generated-json-schema");
const schemas = readdirSync(schemaRoot, { recursive: true }).filter(p => p.endsWith(".json")).sort();
const tree = createHash("sha256");
for (const name of schemas) {
  const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(Buffer.byteLength(name)));
  tree.update(size).update(name).update(Buffer.from(hash(read(schemaRoot, name)), "hex"));
}
assert.equal(schemas.length, manifest.appServer.schemaFileCount);
assert.equal(tree.digest("hex"), manifest.appServer.schemaTreeSha256);
const profileBytes = read(root, family + "/profile.json");
const profile = JSON.parse(profileBytes);
assert.equal(profile.feature, "FEAT-169");
assert.equal(profile.release, false);
const configBytes = read(artifact, "config.schema.json");
const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
for (const [name, max] of [["uint", Number.MAX_SAFE_INTEGER], ["uint64", Number.MAX_SAFE_INTEGER], ["uint32", 0xffffffff], ["uint16", 0xffff]]) {
  ajv.addFormat(name, { type: "number", validate: value => Number.isSafeInteger(value) && value >= 0 && value <= max });
}
const valid = ajv.compile(JSON.parse(configBytes));
assert(valid(profile.native_config), JSON.stringify(valid.errors));
const threadBytes = read(schemaRoot, "v2/ThreadReadResponse.json");
const threadSchema = JSON.parse(threadBytes);
assert.equal(threadSchema.properties.thread.$ref, "#/definitions/Thread");
for (const field of ["id", "parentThreadId", "turns"]) assert(field in threadSchema.definitions.Thread.properties);
for (const field of ["id", "status"]) assert(field in threadSchema.definitions.Turn.properties);
assert.equal(threadSchema.definitions.Thread.properties.id.type, "string");
assert.deepEqual(threadSchema.definitions.Thread.properties.parentThreadId.type, ["string", "null"]);
assert.equal(threadSchema.definitions.Thread.properties.turns.type, "array");
assert.equal(threadSchema.definitions.Thread.properties.turns.items.$ref, "#/definitions/Turn");
assert.equal(threadSchema.definitions.Turn.properties.id.type, "string");
assert.equal(threadSchema.definitions.Turn.properties.status.$ref, "#/definitions/TurnStatus");
assert(threadSchema.definitions.TurnStatus.enum.includes("inProgress"));
const sources = Object.fromEntries([...new Set([...manifest.patches.map(p => p.path), ...inputNames])].sort().map(name => [name, hash(read(fork, name))]));
const lock = {
  schema_version: 1, feature: "FEAT-169", mode: "local_worktree_candidate", release: false,
  runtime_source: { base_commit: execFileSync("git", ["-C", fork, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sources },
  upstream: manifest.upstream, runtime_artifact: manifest.runtime,
  runtime_manifest_sha256: hash(manifestBytes), runtime_schema: manifest.appServer,
  runtime_relative_path: ".yijie/build/native-tools-v1/" + current.artifact,
  patches: manifest.patches, config_schema_sha256: hash(configBytes),
  thread_read_schema_sha256: hash(threadBytes), profile_sha256: hash(profileBytes),
  generator_sha256: hash(readFileSync(fileURLToPath(import.meta.url)))
};
const go = execFileSync("gofmt", { input: `// Code generated from the canonical FEAT-169 candidate. DO NOT EDIT.
package runtimenativetools
import _ "embed"
const RuntimeManifestSHA256 = ${JSON.stringify(lock.runtime_manifest_sha256)}
const RuntimeBinarySHA256 = ${JSON.stringify(manifest.runtime.sha256)}
const RuntimeBinarySize int64 = ${manifest.runtime.sizeBytes}
const RuntimeSchemaTreeSHA256 = ${JSON.stringify(manifest.appServer.schemaTreeSha256)}
const RuntimeSchemaFileCount = ${manifest.appServer.schemaFileCount}
const RuntimePatchManifest = ${JSON.stringify(JSON.stringify(manifest.patches))}
//go:embed profile.json
var Profile []byte
//go:embed config.schema.json
var ConfigSchema []byte
//go:embed thread-read.schema.json
var ThreadReadSchema []byte
// These selected fields are checked against the canonical ThreadReadResponse.
// Unknown canonical fields are intentionally ignored, never treated as authority.
type ThreadIdentity struct { ID string \`json:"id"\`; ParentThreadID *string \`json:"parentThreadId"\`; Turns []TurnIdentity \`json:"turns"\` }
type TurnIdentity struct { ID string \`json:"id"\`; Status string \`json:"status"\` }
type ThreadReadProjection struct { Thread ThreadIdentity \`json:"thread"\` }
` });
const outputs = new Map([[family + "/source.lock.json", json(lock)]]);
if(sync || check) outputs.set("../yijie-desktop/contracts/runtime-native-tools.candidate.json", json(lock));
for (const dir of ["sdks/go/openapi/runtime-native-tools", ...((sync || check) ? ["../yijie-agent-host/internal/contracts/runtimenativetools"] : [])]) {
  for (const [file, bytes] of [["types.gen.go", go], ["profile.json", profileBytes], ["config.schema.json", configBytes], ["thread-read.schema.json", threadBytes]]) outputs.set(dir + "/" + file, bytes);
}
for (const [name, bytes] of outputs) {
  const target = path.resolve(root, name);
  if (check) assert.deepEqual(readFileSync(target), bytes, name);
  else { mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, bytes); }
}
console.log("FEAT-169 canonical native tool profile and consumers " + (check ? "verified" : "generated") + "; local development only.");
