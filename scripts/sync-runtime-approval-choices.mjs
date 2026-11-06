// Sync the two existing consumers. A worktree candidate is for local verification only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const pinned = args.indexOf("--commit");
const candidate = args.includes("--candidate");
const commit = pinned >= 0 ? args[pinned + 1] : !candidate && args.includes("--check")
  ? JSON.parse(readFileSync(path.resolve(root, "../yijie-desktop/contracts/runtime-approval-choices.lock.json"))).sourceCommit : null;
assert(args.includes("--candidate") ? pinned < 0 : /^[a-f0-9]{40}$/.test(commit ?? ""), "Specify --candidate or --commit <full SHA>");
const spec = "openapi/runtime-approvals-v3/runtime-approvals-v3.yaml";
const old = "openapi/runtime-permissions-v2/runtime-permissions-v2.yaml";
const ts = "sdks/typescript/src/openapi/runtime-approvals-v3.gen.ts";
const sources = {};
for (const name of [spec, old, ts, "sdks/go/openapi/runtime-approvals-v3/client.gen.go",
  "scripts/sync-runtime-approval-choices.mjs", "scripts/generate-core.mjs", "go.mod", "go.sum"]) {
  const bytes = readFileSync(path.join(root, name));
  if (commit) assert(bytes.equals(execFileSync("git", ["show", commit + ":" + name], { cwd: root })), name);
  sources[name] = createHash("sha256").update(bytes).digest("hex");
}
function output(file, bytes) {
  const dest = path.resolve(root, "..", file);
  if (args.includes("--check")) assert(readFileSync(dest).equals(Buffer.from(bytes)), file);
  else { mkdirSync(path.dirname(dest), { recursive: true }); writeFileSync(dest, bytes); }
}
const go = execFileSync("go", ["tool", "oapi-codegen", "-generate", "types", "-package", "runtimeapprovalsv3",
  "-import-mapping", "../runtime-permissions-v2/runtime-permissions-v2.yaml:github.com/36Dge/yijie-agent-host/internal/contracts/runtimepermissionsv2", spec], { cwd: root });
output("yijie-agent-host/internal/contracts/runtimeapprovalsv3/types.gen.go", go);
output("yijie-desktop/src/api/generated/runtime-approvals-v3.gen.ts", readFileSync(path.join(root, ts)));
const receipt = JSON.stringify({ contract: "runtime-approvals-v3", sourceCommit: commit,
  provenance: commit ? "git-commit" : "local-working-tree-candidate", sources,
  hostTypesSha256: createHash("sha256").update(go).digest("hex") }, null, 2) + "\n";
for (const dir of ["yijie-agent-host/api", "yijie-desktop/contracts"]) {
  output(dir + "/runtime-approval-choices." + (commit ? "lock" : "candidate") + ".json", receipt);
  const draft = path.resolve(root, "..", dir, "runtime-approval-choices.candidate.json");
  if (commit && !args.includes("--check") && existsSync(draft)) unlinkSync(draft);
}
