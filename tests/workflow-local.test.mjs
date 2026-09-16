import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { workflowValidators } from "../scripts/workflow-schema-validator.mjs";

const schema = JSON.parse(readFileSync("sdks/jsonschema/workflow-local.schema.json"));
const validators = workflowValidators();
const validates = name => validators.components[name];
const operation = "15300000-0000-4000-8000-000000000001";

test("page protection retains the existing boolean envelope for drafts, UI design and query context", () => {
  const common = { protocol_version: 1, request_id: "protection-1", kind: "dirty_changed", bridge_id: "editor-1", generation: 1 };
  // These descriptions are test cases, not new wire fields or saved content.
  const cases = [
    ["unsaved ordinary draft", true],
    ["in-memory ecommerce UI design", true],
    ["operation query context", true],
    ["no remaining page protection", false],
  ];
  for (const [reason, dirty] of cases) {
    assert.equal(validators.bridge({ ...common, dirty }), true, reason);
  }
});

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

test("history navigation is bound to the editor without an operation or resource payload", () => {
  const message = { protocol_version: 1, request_id: "history-1", kind: "request_history", bridge_id: "editor-1", generation: 1 };
  assert.equal(validators.bridge(message), true);
  for (const field of ["bridge_id", "generation"]) {
    const missing = { ...message };
    delete missing[field];
    assert.equal(validators.bridge(missing), false);
  }
  for (const [field, value] of [["dirty", false], ["request", {}], ["response", {}], ["error", {}], ["workflow_id", "10001"]]) {
    assert.equal(validators.bridge({ ...message, [field]: value }), false);
  }
});

test("list summaries exclude bulk content while details retain it", () => {
  assert.equal(Object.hasOwn(schema.$defs.WorkflowSummary.properties, "canvas"), false);
  assert.equal(Object.hasOwn(schema.$defs.Workflow.properties, "canvas"), true);
  for (const field of ["input", "output", "nodes"]) {
    assert.equal(Object.hasOwn(schema.$defs.RunSummary.properties, field), false);
    assert.equal(Object.hasOwn(schema.$defs.Run.properties, field), true);
  }
});

test("description is optional with a 600 code-point boundary and Unicode names remain compatible", () => {
 const create = validates("CreateInput");
 assert.equal(create({ name: "中文流程" }), true);
 assert.equal(create({ name: "中文流程", description: "界".repeat(600) }), true);
 assert.equal(create({ name: "中文流程", description: "界".repeat(601) }), false);
 assert.equal(create({ name: "旧".repeat(80) }), true);
});

test("deletion is revision-bound and leaves legacy receipt kinds unchanged", () => {
 assert.equal(validates('DeleteInput')({ workflow_id:'10001',expected_revision:'10002' }),true);
 assert.equal(validates('DeleteInput')({ workflow_id:'10001' }),false);
 assert.equal(validates('DeleteResult')({workflow_id:'10001',deleted:true}),true);
 assert.equal(validates('DeleteResult')({workflow_id:'10001',deleted:false}),false);
 assert.equal(validates('OperationKind')('delete'),false);
});
