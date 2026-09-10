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
