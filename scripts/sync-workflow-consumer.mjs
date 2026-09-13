import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];
const targets = {
  api: { repo: "yijie-api", files: {
    "sdks/go/openapi/workflow-local/types.gen.go": "internal/contracts/workflowlocal/types.gen.go",
    "sdks/jsonschema/workflow-local.schema.json": "contracts/workflow-local.schema.json",
    "compatibility/workflow-local/source.lock.json": "contracts/workflow-local.source-lock.json",
  } },
  coze: { repo: "yijie-coze", files: {
    "sdks/go/openapi/workflow-local/types.gen.go": "backend/api/model/workflowlocal/types.gen.go",
    "sdks/jsonschema/workflow-local.schema.json": "contracts/workflow-local.schema.json",
    "sdks/openapi/workflow-internal.gen.json": "contracts/workflow-internal.openapi.json",
    "compatibility/workflow-local/source.lock.json": "contracts/workflow-local.source-lock.json",
    "sdks/jsonschema/workflow-editor-bridge-v1.schema.json": "contracts/workflow-editor-bridge-v1.schema.json",
    "sdks/typescript/src/openapi/workflow-local.gen.ts": "frontend/apps/workflow-local/src/generated/workflow-local.gen.ts",
    "sdks/typescript/src/jsonschema/workflow-editor-bridge-v1.gen.ts": { path: "frontend/apps/workflow-local/src/generated/workflow-editor-bridge.gen.ts", imports: { "../openapi/workflow-local.gen.js": "./workflow-local.gen.js" } },
    "sdks/typescript/src/browser/workflow-local-validator.gen.js": "frontend/apps/workflow-local/src/generated/workflow-local.validators.js",
    "sdks/typescript/src/browser/workflow-local-validator.gen.d.ts": { path: "frontend/apps/workflow-local/src/generated/workflow-local.validators.d.ts", imports: { "../openapi/workflow-local.gen.js": "./workflow-local.gen.js", "../jsonschema/workflow-editor-bridge-v1.gen.js": "./workflow-editor-bridge.gen.js" } },
  } },
  desktop: { repo: "yijie-desktop", files: {
    "sdks/rust/workflow-local/types.gen.rs": "src-tauri/src/workflows/generated.rs",
    "sdks/typescript/src/openapi/workflow-local.gen.ts": "src/domain/workflow-local.generated.ts",
    "sdks/jsonschema/workflow-local.schema.json": "contracts/workflow-local.schema.json",
    "sdks/jsonschema/workflow-editor-bridge-v1.schema.json": "contracts/workflow-editor-bridge-v1.schema.json",
    "sdks/typescript/src/jsonschema/workflow-editor-bridge-v1.gen.ts": { path: "src/domain/workflow-editor-bridge.generated.ts", imports: { "../openapi/workflow-local.gen.js": "./workflow-local.generated.js" } },
    "sdks/typescript/src/browser/workflow-local-validator.gen.js": "src/api/generated/workflow-local-validator.gen.js",
    "sdks/typescript/src/browser/workflow-local-validator.gen.d.ts": { path: "src/api/generated/workflow-local-validator.gen.d.ts", imports: { "../openapi/workflow-local.gen.js": "../../domain/workflow-local.generated.js", "../jsonschema/workflow-editor-bridge-v1.gen.js": "../../domain/workflow-editor-bridge.generated.js" } },
  } },
};
const target = targets[name];
if (!target) throw new Error("Use api, coze, or desktop as the explicit workflow consumer.");
const lock = JSON.parse(readFileSync(path.join(root, "compatibility/workflow-local/source.lock.json")));
const hash = data => createHash("sha256").update(data).digest("hex");
for (const file of [...lock.sources, ...lock.generated]) {
  if (hash(readFileSync(path.join(root, file.path))) !== file.sha256) throw new Error(`Source/generated digest differs: ${file.path}. Regenerate before syncing.`);
}
const consumerRoot = path.resolve(root, "..", target.repo);
const check = process.argv.includes("--check");
const lockPath = path.join(consumerRoot, "contracts/workflow-local.lock.json");
const previousLock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {};
const commitArgument = process.argv.indexOf("--source-commit");
const sourceCommit = commitArgument === -1 ? previousLock.source_commit : process.argv[commitArgument + 1];
if (commitArgument !== -1 && !sourceCommit) throw new Error("Missing --source-commit value.");
if (sourceCommit) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Use a full immutable Contracts commit.");
  // Verify every locked source and generated output before any consumer write.
  for (const file of [...lock.sources, ...lock.generated, { path: "compatibility/workflow-local/source.lock.json" }]) {
    const committed = execFileSync("git", ["show", `${sourceCommit}:${file.path}`], { cwd: root });
    if (!committed.equals(readFileSync(path.join(root, file.path)))) throw new Error(`Committed workflow source differs: ${file.path}`);
  }
}
const consumed = [];
for (const [source, mapping] of Object.entries(target.files)) {
  const destination = typeof mapping === "string" ? mapping : mapping.path;
  const original = readFileSync(path.join(root, source));
  let bytes = original;
  if (typeof mapping !== "string") {
    let text = original.toString("utf8");
    for (const [from, to] of Object.entries(mapping.imports)) {
      if (!text.includes(`"${from}"`)) throw new Error(`Expected canonical type import missing: ${source}`);
      text = text.replaceAll(`"${from}"`, `"${to}"`);
    }
    bytes = Buffer.from(text);
  }
  const dest = path.join(consumerRoot, destination);
  if (check) {
    if (hash(readFileSync(dest)) !== hash(bytes)) throw new Error(`Consumer drift: ${destination}`);
  } else {
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
  }
  consumed.push({ source, path: destination, sha256: hash(bytes), ...(typeof mapping === "string" ? {} : { projection: "typescript-imports-v1", source_sha256: hash(original), imports: mapping.imports }) });
}
const consumerLock = JSON.stringify({ ...lock, ...(sourceCommit ? { source_commit: sourceCommit } : {}), consumer: target.repo, consumed }, null, 2) + "\n";
if (check) {
  if (readFileSync(lockPath, "utf8") !== consumerLock) throw new Error("Workflow consumer lock differs.");
} else {
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, consumerLock);
}
console.log(`${check ? "Verified" : "Synced"} ${target.repo} workflow-local ${sourceCommit ?? "local candidate"}; old public/Runtime locks untouched.`);
