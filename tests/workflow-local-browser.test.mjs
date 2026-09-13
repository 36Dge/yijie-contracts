import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validators, validateBridge } from "../sdks/typescript/src/browser/workflow-local-validator.gen.js";
import { workflowValidators } from "../scripts/workflow-schema-validator.mjs";

test("browser AOT matches source for ordinary Unicode and optional query fields", () => {
  const source = workflowValidators();
  const values = [
    ["TextInput", { input: "界".repeat(1365) }],
    ["TextInput", { input: "界".repeat(1366) }],
    ["CreateInput", { name: "😀".repeat(80) }],
    ["CreateInput", { name: "😀".repeat(81) }],
    ["ListRequest", {}],
    ["RunQueryInput", { kind: "operation", operation_id: "15300000-0000-4000-8000-000000000001" }],
    ["RunQueryInput", { kind: "run", workflow_id: "123", run_id: "456" }],
    ["RunQueryInput", { kind: "history", workflow_id: "123" }],
  ];
  for (const [name, value] of values) assert.equal(validators[name](value), source.components[name](value), name);
  assert.equal(validators.RunQueryInput(values[5][1]), true);
  assert.equal(validators.CreateInput(values[2][1]), true);
});

test("browser AOT validates existing connect ready and normal request-response envelope", () => {
  const common = { protocol_version: 1, request_id: "request-1", bridge_id: "bridge-1", generation: 1 };
  for (const kind of ["connect", "ready", "request_close"]) assert.equal(validateBridge({ ...common, kind }), true);
  assert.equal(validateBridge({ ...common, kind: "dirty_changed", dirty: true }), true);
  assert.equal(validateBridge({ ...common, kind: "request", request: { ...common, operation: "bootstrap" } }), true);
  assert.equal(validateBridge({ ...common, kind: "response", response: { request_id: common.request_id } }), true);
});

test("browser module runs with runtime string code generation disabled", () => {
  const file = "sdks/typescript/src/browser/workflow-local-validator.gen.js";
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(text, /\brequire\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\bBuffer\b|\bprocess\b/);
  execFileSync(process.execPath, ["--disallow-code-generation-from-strings", "--input-type=module", "-e", `import {validators,validateBridge} from './${file}'; if(!validators.TextInput({input:'普通文本'}) || !validateBridge({protocol_version:1,request_id:'r',kind:'connect',bridge_id:'b',generation:1})) process.exitCode=1;`], { stdio: "pipe" });
});

test("canonical browser declarations preserve source optional defaults", () => {
  execFileSync("pnpm", ["exec", "tsc", "--noEmit", "--strict", "--skipLibCheck", "--module", "nodenext", "--moduleResolution", "nodenext", "tests/types/workflow-local-browser.ts"], { stdio: "pipe" });
});
