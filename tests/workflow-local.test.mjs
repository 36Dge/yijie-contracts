import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { workflowValidators } from "../scripts/workflow-schema-validator.mjs";

const schema = JSON.parse(readFileSync("sdks/jsonschema/workflow-local.schema.json"));
const validators = workflowValidators();
const validates = name => validators.components[name];
const operation = "15300000-0000-4000-8000-000000000001";

test("workflow source separates native secret responses from renderer views", () => {
  const secret = { session_id: "session-1", workflow_id: "10001", secret: randomBytes(32).toString("hex"), run_epoch: operation, expires_at_ms: 300000 };
  assert.equal(validates("EditorSessionSecret")(secret), true);
  assert.equal(Object.hasOwn(schema.$defs.EditorOpenedView.properties, "secret"), false);
  assert.equal(Object.hasOwn(schema.$defs.EditorExchangeResult.properties, "secret"), false);
});

test("UTF-8 text bounds measure bytes rather than characters", () => {
  const validate = validates("TextInput");
  assert.equal(validate({ input: "a".repeat(4096) }), true);
  assert.equal(validate({ input: "界".repeat(1366) }), false);
});

test("normal editor saves require the expected revision and complete save fields", () => {
  const validate = validates("EditorExchangeInput");
  const common = { bridge_id: "editor-1", generation: 1, protocol_version: 1, request_id: "request-1", operation: "save_draft" };
  assert.equal(validate(common), false);
  assert.equal(validate({ ...common, expected_revision: "draft-1", name: "Text example", canvas: "{}" }), true);
  assert.equal(validate({ ...common, expected_revision: "draft-1", name: "Text example", canvas: "{}", operation_id: operation }), false);
});

test("run queries remain valid independently of an editor lease", () => {
  assert.equal(validates("RunQueryInput")({ kind: "history", workflow_id: "10001", limit: 20 }), true);
  assert.equal(validates("RunQueryInput")({ kind: "operation", operation_id: operation }), true);
  assert.equal(validates("RunQueryInput")({ kind: "run", workflow_id: "10001" }), false);
  assert.equal(validates("RunQueryInput")({ kind: "operation", operation_id: operation, limit: 20 }), false);
});

test("unknown engine status is retained while published versions and receipt semantics stay bounded", () => {
  assert.equal(validates("Run")({ run_id: "run-1", workflow_id: "10001", operation_id: operation, mode: "release", version: "v0.0.1", state: "future_engine_state", terminal: false, started_at_ms: 1 }), true);
  assert.equal(validates("OperationReceipt")({ operation_id: operation, kind: "run", phase: "completed", run_id: "run-1" }), true);
  assert.equal(validates("Version")("v0.0.1"), true);
  assert.equal(validates("Version")("latest"), false);
});

test("MessageChannel response has one typed outcome and generation binding", () => {
  const validate = validators.bridge;
  const message = { protocol_version: 1, request_id: "request-1", kind: "response", bridge_id: "editor-1", generation: 1, response: { request_id: "request-1" } };
  assert.equal(validate(message), true);
  assert.equal(validate({ ...message, error: { code: "session_expired", message: "Reconnect editor" } }), false);
});

test("list summaries exclude bulk content while details retain it", () => {
  assert.equal(Object.hasOwn(schema.$defs.WorkflowSummary.properties, "canvas"), false);
  assert.equal(Object.hasOwn(schema.$defs.Workflow.properties, "canvas"), true);
  for (const field of ["input", "output", "nodes"]) {
    assert.equal(Object.hasOwn(schema.$defs.RunSummary.properties, field), false);
    assert.equal(Object.hasOwn(schema.$defs.Run.properties, field), true);
  }
});
