import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const compatibilityPath = "compatibility/agent-host-runtime-v1.json";
const compatibilitySchemaPath = "jsonschema/compatibility/agent-host-runtime.schema.json";
const expectedMethods = [
  "skills/config/write",
  "skills/extraRoots/set",
  "skills/list",
  "thread/resume",
  "thread/start",
  "turn/interrupt",
  "turn/start",
];
const expectedNotifications = [
  "error",
  "item/agentMessage/delta",
  "item/completed",
  "item/started",
  "skills/changed",
  "thread/started",
  "turn/completed",
  "turn/started",
  "warning",
];
const execFileAsync = promisify(execFile);

async function loadCompatibility() {
  return JSON.parse(await readFile(compatibilityPath, "utf8"));
}

function methodsFromSchema(schema) {
  return (schema.oneOf ?? [])
    .flatMap((branch) => branch?.properties?.method?.enum ?? [])
    .sort();
}

async function schemaTreeSha256(directory, files) {
  const digest = createHash("sha256");
  for (const relative of [...files].sort()) {
    const encodedPath = Buffer.from(relative, "utf8");
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(encodedPath.length));
    digest.update(length);
    digest.update(encodedPath);
    digest.update(createHash("sha256").update(await readFile(path.join(directory, relative))).digest());
  }
  return digest.digest("hex");
}

async function directoryExists(directory) {
  try {
    await access(directory);
    return true;
  } catch {
    return false;
  }
}

async function findJsonFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await findJsonFiles(directory, child)));
    else if (entry.name.endsWith(".json")) files.push(child);
  }
  return files.sort();
}

test("runtime compatibility manifest is valid and pins the stable projection", async () => {
  const manifest = await loadCompatibility();
  const [schema, packageManifest] = await Promise.all([
    readFile(compatibilitySchemaPath, "utf8").then(JSON.parse),
    readFile("package.json", "utf8").then(JSON.parse),
  ]);
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
  assert.equal(
    manifest.contracts_version,
    packageManifest.version,
    "compatibility manifest must ship with the exact contracts package version",
  );
  assert.deepEqual(manifest.host_projection.runtime_methods, expectedMethods);
  assert.deepEqual(manifest.host_projection.runtime_notifications, expectedNotifications);
});

test("pinned projection exists in a neighboring yijie-codex checkout when available", async (t) => {
  const runtimeRepo = process.env.YIJIE_CODEX_REPO ?? path.resolve("../yijie-codex");
  const schemas = path.join(runtimeRepo, ".yijie/schemas/app-server/generated-json-schema");
  if (!(await directoryExists(schemas))) {
    t.skip(`runtime schema checkout is unavailable at ${runtimeRepo}`);
    return;
  }

  const manifest = await loadCompatibility();
  const { stdout: runtimeHead } = await execFileAsync(
    "git",
    ["-C", runtimeRepo, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  );
  assert.equal(
    runtimeHead.trim(),
    manifest.runtime.repository_commit,
    "compatibility manifest must pin the neighboring Runtime checkout exactly",
  );
  const baseline = JSON.parse(
    await readFile(path.join(runtimeRepo, ".yijie/schemas/app-server/baseline.json"), "utf8"),
  );
  assert.equal(baseline.runtimeVersion, manifest.runtime.version);
  assert.equal(baseline.upstreamTag, manifest.runtime.upstream_tag);
  assert.equal(baseline.upstreamCommit, manifest.runtime.upstream_commit);
  assert.equal(baseline.transport, manifest.runtime.transport);
  assert.equal(baseline.experimentalApi, manifest.runtime.experimental_api);

  const schemaFiles = await findJsonFiles(schemas);
  assert.equal(schemaFiles.length, manifest.runtime.schema_file_count);
  const clientRequest = JSON.parse(await readFile(path.join(schemas, "ClientRequest.json"), "utf8"));
  const serverNotification = JSON.parse(
    await readFile(path.join(schemas, "ServerNotification.json"), "utf8"),
  );
  const clientMethods = new Set(methodsFromSchema(clientRequest));
  const serverMethods = new Set(methodsFromSchema(serverNotification));
  for (const method of expectedMethods) assert.equal(clientMethods.has(method), true, method);
  for (const method of expectedNotifications) assert.equal(serverMethods.has(method), true, method);

  assert.equal(
    await schemaTreeSha256(schemas, schemaFiles),
    manifest.runtime.schema_tree_sha256,
  );
});
