import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import YAML from "yaml";

const native = JSON.parse(fs.readFileSync("openapi/native-conversation-v2/native-conversation-v2.yaml", "utf8"));
const permissions = JSON.parse(fs.readFileSync("openapi/runtime-permissions-v2/runtime-permissions-v2.yaml", "utf8"));
const ajv = new Ajv({strict: false}); addFormats(ajv);
const validate = (spec, name) => ajv.compile({components: spec.components, $ref: `#/components/schemas/${name}`});

test("FEAT-144 keeps supported v1 native and permission source semantics intact", () => {
  for (const file of ["openapi/native-conversation/native-conversation.yaml", "openapi/runtime-permissions/runtime-permissions.yaml"]) {
    const baseline = execFileSync("git", ["show", `db7a607c1c091fc4f4243829d68d5b673eb7e2c3:${file}`]);
    assert.ok(fs.readFileSync(file).equals(baseline));
  }
  const v1 = YAML.parse(fs.readFileSync("openapi/runtime-permissions/runtime-permissions.yaml", "utf8"));
  assert.deepEqual(permissions.components.schemas.PermissionMode, v1.components.schemas.PermissionMode);
  assert.ok(!v1.components.schemas.RuntimeApproval.properties.kind.enum.includes("mcp"));
  assert.ok(native.paths["/v8/agent-sessions/{agent_session_id}/events"]);
  assert.ok(native.paths["/v2/agent-sessions/{agent_session_id}/native-thread"]);
});

test("FEAT-144 native result distinguishes indexed empty text from missing or unsupported result", () => {
  const check = validate(native, "NativeItem");
  const item = {id: "mcp-item", type: "mcpToolCall", status: "completed", availability: "available"};
  for (const resultKind of ["absent", "null", "empty", "unsupported", "omitted"]) {
    assert.equal(check({...item, mcp: {server: "sorftime", tool: "product_detail", resultKind, texts: [], diagnostics: []}}), true);
  }
  const result = {resultKind: "text", texts: [{index: 2, text: ""}, {index: 4, text: "普通商品资料 🌿"}], diagnostics: []};
  assert.equal(check({...item, mcp: result}), true);
  assert.equal(check({...item, mcp: {...result, texts: [{index: 32, text: "outside first32"}]}}), false);
  assert.equal(check({...item, mcp: {...result, texts: Array.from({length: 33}, (_, i) => ({index: i % 32, text: "ordinary"}))}}), false);
  assert.equal(check({...item, mcp: {...result, structuredContent: {price: 0}}}), false);
  assert.equal(check({...item, mcp: {...result, error: "new business error"}}), false);
  assert.match(native.components.schemas.NativeItem.properties.resultSummary.description, /Metadata display only/);
});

test("FEAT-144 MCP approval scope and single native choices are explicit", () => {
  const check = validate(permissions, "RuntimeApprovalSnapshot");
  const request = {id: "019c1a00-0000-7000-8000-000000000001", kind: "mcp", summary: "查询商品", scope: "US", reason: "用户确认本次查询", status: "pending", mcp: {server: "sorftime", tool: "product_detail", asin: "B000000001", marketplace: "US"}};
  assert.equal(check({requests: [request]}), true);
  assert.equal(check({requests: [{...request, mcp: {...request.mcp, marketplace: "GB"}}]}), false);
  const decision = validate(permissions, "RuntimeApprovalDecision");
  for (const d of ["approve_once", "reject", "cancel"]) assert.equal(decision({decision: d}), true);
  assert.equal(decision({decision: "approve_session"}), false);
});

test("FEAT-144 current thread status is a separate closed native observation", () => {
  const check = validate(native, "NativeThreadStatusSnapshot");
  const observation = {schema_version: 2, source: "runtime_read", thread_id: "native-thread", status: "idle"};
  for (const status of ["notLoaded", "idle", "systemError", "active"]) {
    assert.equal(check({...observation, status}), true);
  }
  for (const status of ["completed", "inProgress", "unknown", null]) {
    assert.equal(check({...observation, status}), false);
  }
  const {status, ...missingStatus} = observation;
  assert.equal(check(missingStatus), false);
  assert.equal(check({...observation, source: "runtime_resume"}), false);
  assert.equal(check({...observation, turns: []}), false);
  const operation = native.paths["/v2/agent-sessions/{agent_session_id}/native-thread-status"];
  assert.deepEqual(operation.parameters, native.paths["/v2/agent-sessions/{agent_session_id}/native-thread"].parameters);
  assert.deepEqual(native.security, [{LocalBearer: []}]);
  for (const response of Object.values(operation.get.responses)) {
    assert.deepEqual(response.headers["Cache-Control"].schema.enum, ["no-store"]);
  }
  const projection = JSON.parse(fs.readFileSync("compatibility/agent-host-native-mcp-v2.json", "utf8")).current_thread_status;
  assert.equal(projection.runtime_method, "thread/read");
  assert.equal(projection.include_turns, false);
  assert.equal(projection.source_field, "thread.status.type");
});

test("FEAT-144 status extension keeps every old v2 path, schema and Go client interface unchanged", () => {
  const baselineCommit = "db54c617c65db5431b950eb297ba148a43a8e600";
  const baseline = JSON.parse(execFileSync("git", ["show", `${baselineCommit}:openapi/native-conversation-v2/native-conversation-v2.yaml`], {encoding: "utf8"}));
  for (const [name, schema] of Object.entries(baseline.components.schemas)) {
    assert.deepEqual(native.components.schemas[name], schema, name);
  }
  for (const [name, operation] of Object.entries(baseline.paths)) {
    assert.deepEqual(native.paths[name], operation, name);
  }
  const goPath = "sdks/go/openapi/native-conversation-v2/client.gen.go";
  const oldGo = execFileSync("git", ["show", `${baselineCommit}:${goPath}`], {encoding: "utf8"});
  const newGo = fs.readFileSync(goPath, "utf8");
  for (const name of ["ClientInterface", "ClientWithResponsesInterface", "ClientWithResponses", "NativeThreadSnapshot"]) {
    const definition = new RegExp(`type ${name} (?:struct|interface) \\{[\\s\\S]*?\\n\\}`);
    assert.equal(newGo.match(definition)?.[0], oldGo.match(definition)?.[0], name);
  }
  assert.match(newGo, /type ClientThreadStatusInterface interface/);
  assert.match(newGo, /type ClientWithThreadStatusResponsesInterface interface/);
});
