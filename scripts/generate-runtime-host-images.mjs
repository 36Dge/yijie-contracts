// Project the fork's generated schemas and immutable local candidate identity.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fork = path.join(root, "../yijie-codex");
const artifact = path.join(fork, ".yijie/build/host-images-v1/aarch64-apple-darwin");
const family = "compatibility/runtime-host-images";
const method = "item/imageGeneration/generate";
const argv = process.argv.slice(2);
const check = argv.includes("--check");
const pin = argv.find(arg => /^--pin=[a-f0-9]{40}$/.test(arg))?.slice(6);
assert.equal(argv.length, Number(check) + Number(Boolean(pin)), "expected [--check] [--pin=<Contracts commit>]");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const runtimeCommit = "7171b0b262c67a72725fa54f9ed39b50edd94b54";
const committed = (repo, revision, file) => execFileSync("git", ["-C", repo, "show", revision + ":" + file], {maxBuffer: 16 * 1024 * 1024});
const manifestBytes = readFileSync(path.join(artifact, "runtime-manifest.json"));
const manifest = JSON.parse(manifestBytes);
const prior = JSON.parse(readFileSync(path.join(root, "compatibility/runtime-kimi-k31-pro/source.lock.json")));
assert.equal(manifest.upstream.commit, prior.upstream.commit);
assert.equal(manifest.appServer.experimentalApi, false);
assert.equal(manifest.appServer.transport, "stdio");
assert.deepEqual(manifest.patches.slice(0, -1), prior.native_sources.filter(r => r.path.endsWith(".patch")));
assert.equal(manifest.patches.at(-1).path, ".yijie/patches/chat-models/0019-host-image-generation.patch");
const runtimeInputs = [...manifest.patches.map(row => row.path), "scripts/build-host-images.sh",
  "scripts/prepare-host-images.py", "scripts/write-host-image-runtime-manifest.py"];
for (const file of runtimeInputs) assert.deepEqual(readFileSync(path.join(fork, file)), committed(fork, runtimeCommit, file), file);
for (const row of manifest.patches) assert.equal(hash(readFileSync(path.join(fork, row.path))), row.sha256);
const binary = readFileSync(path.join(artifact, "codex"));
assert.equal(binary.length, manifest.runtime.sizeBytes);
assert.equal(hash(binary), manifest.runtime.sha256);
const schemaDir = path.join(artifact, "generated-json-schema");
const schemas = readdirSync(schemaDir, {recursive:true}).filter(f => f.endsWith(".json")).sort();
assert.equal(schemas.length, manifest.appServer.schemaFileCount);
const tree = createHash("sha256");
for (const name of schemas) {
  const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(Buffer.byteLength(name)));
  tree.update(size).update(name).update(Buffer.from(hash(readFileSync(path.join(schemaDir, name))), "hex"));
}
assert.equal(tree.digest("hex"), manifest.appServer.schemaTreeSha256);
const request = JSON.parse(readFileSync(path.join(schemaDir,"ServerRequest.json")));
assert(request.oneOf.some(v => v.properties?.method?.enum?.includes(method)));
const projections = new Map();
const structs = [];
for (const name of ["HostImageGenerateParams","HostImageGenerateResponse"]) {
  const bytes = readFileSync(path.join(schemaDir,name + ".json"));
  const schema = JSON.parse(bytes);
  assert.equal(schema.title,name);
  assert.equal(schema.additionalProperties,false);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  const fields = schema.required.map(key => {
    const type = {string:"string",boolean:"bool"}[schema.properties[key].type];
    assert(type);
    const field = (key[0].toUpperCase()+key.slice(1)).replace(/Id$/,"ID");
    return `${field} ${type} \`json:"${key}"\``;
  });
  structs.push(`type ${name} struct {\n${fields.join("\n")}\n}`);
  projections.set(family+"/"+name+".json",bytes);
}
const routesBytes = readFileSync(path.join(root,family,"expert-routes.json"));
const {routes} = JSON.parse(routesBytes);
const identities = new Set();
const routeRows = [];
for (const r of routes) {
  assert.match(r.roleSha256,/^[a-f0-9]{64}$/);
  assert.match(r.version,/^\d+\.\d+\.\d+$/);
  for(const k of ["route","expertId","service","proxy","method"]) assert.match(r[k],/^[a-zA-Z0-9_/-]+$/);
  assert(!identities.has(r.expertId+"@"+r.version));identities.add(r.expertId+"@"+r.version);
  routeRows.push("{"+["route","expertId","version","roleSha256","service","proxy","method"].map(k=>JSON.stringify(r[k])).join(",")+"},");
}
const manifestHash = hash(manifestBytes);
const lock = {
  schema_version:1, feature:"FEAT-168", mode:"immutable_local_candidate", release:false, method,
  expert_routes_sha256:hash(routesBytes), runtime_source:{repository:prior.runtime_source.repository, commit:runtimeCommit}, upstream:prior.upstream, runtime_artifact:manifest.runtime,
  runtime_manifest_sha256:manifestHash, runtime_schema:manifest.appServer, patches:manifest.patches,
  schemas:[...projections].map(([file,bytes])=>({path:file,sha256:hash(bytes)})),
};
const lockBytes=json(lock);
projections.set(family+"/source.lock.json",lockBytes);
const go = execFileSync("gofmt", {input: `// Code generated from the fixed app-server image candidate. DO NOT EDIT.
package runtimehostimages
const Method = ${JSON.stringify(method)}
const RuntimeManifestSHA256 = ${JSON.stringify(manifestHash)}
const RuntimeBinarySHA256 = ${JSON.stringify(manifest.runtime.sha256)}
const RuntimeBinarySize int64 = ${manifest.runtime.sizeBytes}
const RuntimeSchemaTreeSHA256 = ${JSON.stringify(manifest.appServer.schemaTreeSha256)}
const RuntimeSchemaFileCount = ${manifest.appServer.schemaFileCount}
const RuntimePatchManifest = ${JSON.stringify(JSON.stringify(manifest.patches))}
${structs.join("\n")}
type ExpertImageRoute struct {Route, ExpertID, Version, RoleSHA256, Service, Proxy, Method string}
var ExpertImageRoutes = [...]ExpertImageRoute{
${routeRows.join("\n")}
}
`});
projections.set("sdks/go/openapi/runtime-host-images/types.gen.go",go);
projections.set("../yijie-agent-host/internal/contracts/runtimehostimages/types.gen.go",go);
projections.set("../yijie-desktop/contracts/runtime-host-images.candidate.json",lockBytes);
if (pin) {
  const sources = [family+"/expert-routes.json", "scripts/generate-runtime-host-images.mjs",
    ...[...projections.keys()].filter(file => !file.startsWith("../"))];
  for (const file of sources) {
    assert.deepEqual(committed(root, pin, file), readFileSync(path.join(root, file)), "committed Contracts source differs: " + file);
  }
  const receipt = json({feature:"FEAT-168", release:false, source_commit:pin, source_lock_sha256:hash(lockBytes)});
  projections.set("../yijie-agent-host/api/runtime-host-images.candidate.json",receipt);
  projections.set("../yijie-desktop/contracts/host-images-contracts.pin.json",receipt);
}
for (const [file,bytes] of projections) {
  const target = path.resolve(root,file);
  if (check) assert.deepEqual(readFileSync(target), bytes, file);
  else {mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}
}
console.log("FEAT-168 local candidate pin, canonical image method and consumers " + (check?"verified":"generated"));
