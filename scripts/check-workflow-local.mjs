import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { workflowValidators } from "./workflow-schema-validator.mjs";

const lockPath = "compatibility/workflow-local/source.lock.json";
const lock = JSON.parse(readFileSync(lockPath));
const files = [...lock.generated.map(file => file.path), lockPath];
const before = new Map(files.map(file => [file, readFileSync(file)]));
execFileSync(process.execPath, ["scripts/generate-workflow-local.mjs", "--base-commit", lock.base_commit], { stdio: "inherit" });
for (const [file, bytes] of before) {
  if (!bytes.equals(readFileSync(file))) throw new Error(`Stale workflow output: ${file}`);
}
const { components } = workflowValidators();
console.log(`Verified deterministic workflow outputs and ${Object.keys(components).length} component validators plus editor bridge.`);
