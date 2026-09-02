import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const [
  schemaV6,
  schemaV5,
  protoV6,
  openApi,
  asyncApi,
  generatedIndex,
  generatedEventV6,
  generatedAgentHost,
  generatedRuntimeApprovalCompatibility,
  packageJson,
  compatibility,
] =
  await Promise.all([
    readFile("jsonschema/agent/session-event-v6.schema.json", "utf8").then(JSON.parse),
    readFile("jsonschema/agent/session-event-v5.schema.json", "utf8").then(JSON.parse),
    readFile("protobuf/yijie/events/v6/agent_session.proto", "utf8"),
    readFile("openapi/agent-host/agent-host.yaml", "utf8").then(parseYaml),
    readFile("asyncapi/events.yaml", "utf8").then(parseYaml),
    readFile("sdks/typescript/src/index.ts", "utf8"),
    readFile("sdks/typescript/src/jsonschema/agent-session-event-v6.gen.ts", "utf8"),
    readFile("sdks/typescript/src/openapi/agent-host.gen.ts", "utf8"),
    readFile(
      "sdks/typescript/src/jsonschema/compatibility-agent-host-runtime-approval-v6-v4.gen.ts",
      "utf8",
    ),
    readFile("package.json", "utf8").then(JSON.parse),
    readFile("compatibility/agent-host-runtime-v1.json", "utf8").then(JSON.parse),
  ]);

const fixtureRoot = "tests/fixtures/agent/session-event-v6";
const positiveFixtures = [
  "approval-requested.json",
  "approval-resolved-accepted.json",
  "approval-resolved-cancelled.json",
  "approval-resolved-elsewhere.json",
  "approval-resolved-expired.json",
];

function utf8Bytes(value) {
  return Buffer.byteLength(value, "utf8");
}

function totalBoundedTextBytes(value) {
  if (typeof value === "string") return utf8Bytes(value);
  if (Array.isArray(value)) {
    const contentBytes = value.reduce((total, entry) => total + totalBoundedTextBytes(entry), 0);
    const separatorBytes = value.every((entry) => typeof entry === "string")
      ? Math.max(0, value.length - 1)
      : 0;
    return contentBytes + separatorBytes;
  }
  if (value == null || typeof value !== "object") return 0;
  if (Object.hasOwn(value, "head") || Object.hasOwn(value, "tail")) {
    return utf8Bytes(value.head ?? "") + utf8Bytes(value.tail ?? "");
  }
  if (Array.isArray(value.contents)) return totalBoundedTextBytes(value.contents);
  if (typeof value.text === "string") return utf8Bytes(value.text);
  return Object.values(value).reduce((total, entry) => total + totalBoundedTextBytes(entry), 0);
}

function compile(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const keyword of [
    "x-yijie-max-reasoning-items-per-turn",
    "x-yijie-max-reasoning-utf8-bytes-per-turn",
  ]) ajv.addKeyword({ keyword, schemaType: "number" });
  ajv.addKeyword({
    keyword: "x-yijie-max-sse-data-utf8-bytes",
    schemaType: "number",
    type: "object",
    errors: false,
    validate: (maximum, value) => utf8Bytes(JSON.stringify(value)) <= maximum,
  });
  ajv.addKeyword({
    keyword: "x-yijie-max-utf8-bytes",
    schemaType: "number",
    type: "string",
    errors: false,
    validate: (maximum, value) => utf8Bytes(value) <= maximum,
  });
  ajv.addKeyword({
    keyword: "x-yijie-max-total-utf8-bytes",
    schemaType: "number",
    errors: false,
    validate: (maximum, value) => totalBoundedTextBytes(value) <= maximum,
  });
  ajv.addKeyword({ keyword: "x-yijie-content-index-rule", schemaType: "string" });
  ajv.addKeyword({ keyword: "x-yijie-projection-limit-policy", schemaType: "object" });
  ajv.addKeyword({ keyword: "x-yijie-command-tool-projection-policy", schemaType: "object" });
  ajv.addKeyword({ keyword: "x-yijie-command-approval-policy", schemaType: "object" });
  ajv.addKeyword({
    keyword: "x-yijie-approval-time-window",
    schemaType: "object",
    type: "object",
    errors: false,
    validate: (policy, value) => {
      const requestedAt = Date.parse(value[policy.requested_at_field]);
      const expiresAt = Date.parse(value[policy.expires_at_field]);
      if (!Number.isFinite(requestedAt) || !Number.isFinite(expiresAt)) return false;
      if (expiresAt - requestedAt !== policy.ttl_seconds * 1000) return false;
      if (!policy.resolved_at_field) return true;
      const resolvedAt = Date.parse(value[policy.resolved_at_field]);
      if (!Number.isFinite(resolvedAt) || resolvedAt < requestedAt) return false;
      const isDeadlineOutcome = value[policy.outcome_field] === policy.deadline_outcome;
      return isDeadlineOutcome ? resolvedAt >= expiresAt : resolvedAt < expiresAt;
    },
  });
  return ajv.compile(schema);
}

const validateV6 = compile(schemaV6);
const validateV5 = compile(schemaV5);

async function fixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

function assertValid(value, label) {
  assert.equal(validateV6(value), true, `${label}: ${JSON.stringify(validateV6.errors)}`);
}

function assertInvalid(value, label) {
  assert.equal(validateV6(value), false, `${label}: unexpectedly validated`);
}

test("v6 canonical approval fixtures are the complete closed positive set", async () => {
  assert.deepEqual((await readdir(fixtureRoot)).sort(), positiveFixtures);
  for (const name of positiveFixtures) assertValid(await fixture(name), name);
});

test("v6 freezes the exact FEAT-137 action, decisions, TTL, authority, and Runtime mapping", () => {
  assert.deepEqual(schemaV6["x-yijie-command-approval-policy"], {
    scope: "exact_local_demo_fast_feat_134_feat_136_feat_137",
    action_id: "git_repository_check",
    workspace_scope: "current_workspace",
    decisions: ["accept_once", "cancel_current_turn"],
    ttl_seconds: 120,
    max_pending_per_session: 1,
    pending_authority: "host_memory_only",
    runtime_accept_mapping: "accept",
    runtime_cancel_mapping: "cancel",
    runtime_request_identity_exposed: false,
    runtime_compatibility_authority: "compatibility/agent-host-runtime-approval-v6-v4.json",
    runtime_replay_behavior: "reuse_same_opaque_request_without_ttl_reset",
    runtime_replay_conflict_behavior: "cancel_new_request_and_fail_closed_without_projection",
    second_pending_behavior: "cancel_new_request_and_fail_closed_without_projection",
    raw_fields_are_forbidden: [
      "runtime_request_id",
      "runtime_approval_id",
      "runtime_started_at_ms",
      "command",
      "command_actions",
      "cwd",
      "runtime_environment_id",
      "sandbox_permissions",
      "reason",
      "network_approval_context",
      "proposed_execpolicy_amendment",
      "proposed_network_policy_amendments",
      "available_decisions",
      "additional_permissions",
      "runtime_wire",
    ],
  });
});

test("v6 approval projection is content-free, closed, correlated, and non-terminal", async () => {
  const requested = await fixture("approval-requested.json");
  assert.equal(
    Date.parse(requested.payload.expires_at) - Date.parse(requested.payload.requested_at),
    120_000,
  );
  for (const property of ["turn_id", "item_id"]) {
    const invalid = structuredClone(requested);
    delete invalid[property];
    assertInvalid(invalid, `missing ${property}`);
  }
  for (const property of [
    "runtime_request_id",
    "runtime_approval_id",
    "runtime_started_at_ms",
    "command",
    "command_actions",
    "cwd",
    "runtime_environment_id",
    "sandbox_permissions",
    "reason",
    "network_approval_context",
    "proposed_execpolicy_amendment",
    "proposed_network_policy_amendments",
    "available_decisions",
    "additional_permissions",
    "runtime_wire",
  ]) {
    assertInvalid(
      { ...requested, payload: { ...requested.payload, [property]: "forbidden" } },
      property,
    );
  }
  for (const [property, value] of [
    ["action_id", "arbitrary_command"],
    ["workspace_scope", "absolute_path"],
    ["ttl_seconds", 119],
    ["revision", 2],
    ["decisions", { primary: "cancel_current_turn", secondary: "accept_once" }],
    ["decisions", { primary: "accept_once", secondary: "decline" }],
  ]) {
    assertInvalid({ ...requested, payload: { ...requested.payload, [property]: value } }, property);
  }
  assertInvalid({ ...requested, request_id: "0" }, "approval event top-level request_id");
  assertInvalid(
    { ...requested, payload: { ...requested.payload, expires_at: "2026-08-30T12:02:01Z" } },
    "approval request 121-second time window",
  );
  assertInvalid({ ...requested, terminal: true }, "approval requested terminal=true");
  assertInvalid({ ...requested, event_type: "item/fileChange/requestApproval" }, "FileChange");
});

test("v6 resolution pairs are exact and expiry/cleanup carry no user decision", async () => {
  const accepted = await fixture("approval-resolved-accepted.json");
  const cancelled = await fixture("approval-resolved-cancelled.json");
  const expired = await fixture("approval-resolved-expired.json");
  const elsewhere = await fixture("approval-resolved-elsewhere.json");
  assertInvalid(
    { ...accepted, payload: { ...accepted.payload, decision: "cancel_current_turn" } },
    "accepted with cancel",
  );
  assertInvalid(
    { ...cancelled, payload: { ...cancelled.payload, decision: "accept_once" } },
    "cancelled with accept",
  );
  assertInvalid(
    { ...expired, payload: { ...expired.payload, decision_id: accepted.payload.decision_id, decision: "cancel_current_turn" } },
    "expired with decision",
  );
  assertInvalid(
    { ...elsewhere, payload: { ...elsewhere.payload, decision_id: accepted.payload.decision_id } },
    "resolved elsewhere with decision id",
  );
  assertInvalid(
    { ...accepted, payload: { ...accepted.payload, revision: 1 } },
    "resolved revision does not advance",
  );
  assertInvalid(
    { ...accepted, payload: { ...accepted.payload, resolved_at: accepted.payload.expires_at } },
    "user decision at or after expiry",
  );
  assertInvalid(
    { ...expired, payload: { ...expired.payload, resolved_at: "2026-08-30T12:01:59Z" } },
    "expired before deadline",
  );
  assertInvalid({ ...accepted, request_id: "runtime-jsonrpc-42" }, "resolved Runtime request id");
  assertInvalid({ ...accepted, terminal: true }, "approval resolved terminal=true");
});

test("v6 is isolated: v5 rejects approvals and v6 rejects schema version 5", async () => {
  const requested = await fixture("approval-requested.json");
  assert.equal(validateV5(requested), false);
  assertInvalid({ ...requested, schema_version: 5 }, "v6 with schema version 5");

  const v5FixtureRoot = "tests/fixtures/agent/session-event-v5";
  for (const name of await readdir(v5FixtureRoot)) {
    const inherited = JSON.parse(await readFile(`${v5FixtureRoot}/${name}`, "utf8"));
    inherited.schema_version = 6;
    assertValid(inherited, `inherited ${name}`);
  }
});

test("v6 JSON, Proto, OpenAPI, AsyncAPI, package, and SDK authorities align", () => {
  assert.equal(packageJson.version, "0.7.0");
  assert.equal(openApi.info.version, "0.7.0");
  assert.equal(asyncApi.info.version, "0.7.0");
  assert.equal(schemaV6.properties.schema_version.const, 6);
  assert.match(protoV6, /package yijie\.events\.v6;/);
  assert.match(protoV6, /Always 6\. Consumers negotiate v6/);
  assert.match(protoV6, /AGENT_EVENT_TYPE_APPROVAL_REQUESTED = 18;/);
  assert.match(protoV6, /AGENT_EVENT_TYPE_APPROVAL_RESOLVED = 19;/);
  assert.match(protoV6, /message ApprovalDecisionSet/);
  assert.match(protoV6, /ApprovalDecision primary = 1;/);
  assert.match(protoV6, /ApprovalDecision secondary = 2;/);
  assert.match(protoV6, /ApprovalRequestedPayload approval_requested = 43;/);
  assert.match(protoV6, /ApprovalResolvedPayload approval_resolved = 44;/);

  const route = openApi.paths["/v6/agent-sessions/{agent_session_id}/events"].get;
  assert.equal(route.operationId, "streamAgentSessionEventsV6");
  assert.deepEqual(openApi.components.parameters.EventSchemaVersionV6.schema.enum, [6]);
  assert.equal(
    route.responses["200"].content["text/event-stream"].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event-v6.schema.json",
  );
  assert.equal(asyncApi.channels.agentSessionEventsV6.address, "agent.session.events.v6");
  assert.equal(
    asyncApi.components.messages.AgentSessionEventV6.payload.$ref,
    "../jsonschema/agent/session-event-v6.schema.json",
  );
  assert.equal(
    asyncApi.operations.receiveAgentSessionEventsV6.channel.$ref,
    "#/channels/agentSessionEventsV6",
  );
  assert.match(
    generatedIndex,
    /export \* as AgentSessionEventsV6 from "\.\/protobuf\/yijie\/events\/v6\/agent_session_pb\.js";/,
  );
  assert.match(
    generatedIndex,
    /export \* as AgentSessionEventSchemaV6 from "\.\/jsonschema\/agent-session-event-v6\.gen\.js";/,
  );
  assert.match(
    generatedIndex,
    /export \* as AgentHostRuntimeApprovalCompatibilityV6V4 from "\.\/jsonschema\/compatibility-agent-host-runtime-approval-v6-v4\.gen\.js";/,
  );
  assert.doesNotMatch(
    generatedIndex,
    /export \* from "\.\/jsonschema\/compatibility-agent-host-runtime-approval-v6-v4\.gen\.js";/,
  );
  assert.match(generatedEventV6, /request_id\?: never/);
  assert.match(generatedEventV6, /revision: 1/);
  assert.match(generatedEventV6, /revision: 2/);
  assert.match(generatedEventV6, /primary: "accept_once"/);
  assert.match(generatedEventV6, /secondary: "cancel_current_turn"/);
  assert.match(generatedAgentHost, /decision: "accept_once";[\s\S]*outcome: "accepted_once";/);
  assert.match(
    generatedAgentHost,
    /decision: "cancel_current_turn";[\s\S]*outcome: "cancelled_current_turn";/,
  );
  assert.match(generatedAgentHost, /message: "approval processing failed";/);
  assert.doesNotMatch(generatedRuntimeApprovalCompatibility, /never\[\]/);
  assert.match(generatedRuntimeApprovalCompatibility, /approval_id: "absent_or_null"/);
  assert.match(
    generatedRuntimeApprovalCompatibility,
    /available_decisions: "availableDecisions"/,
  );
});

test("the frozen Runtime compatibility manifest stays exact read-only/never", () => {
  assert.equal(compatibility.runtime.repository_commit, "b2b20e2fc4a0c94834f34d8cc459e488a1b56277");
  assert.equal(compatibility.runtime.version, "0.144.6");
  assert.equal(compatibility.runtime.experimental_api, false);
  assert.equal(compatibility.host_projection.sandbox, "read-only");
  assert.equal(compatibility.host_projection.approval_policy, "never");
});

test("the frozen Runtime stable approval surface maps only through Host-owned v6 identities", async (t) => {
  const runtimeRoot = process.env.YIJIE_CODEX_REPO ?? path.resolve("../yijie-codex");
  const schemaRoot = path.join(runtimeRoot, ".yijie/schemas/app-server/generated-json-schema");
  try {
    await access(schemaRoot);
  } catch {
    t.skip(`Runtime schema checkout unavailable at ${runtimeRoot}`);
    return;
  }
  const params = JSON.parse(
    await readFile(path.join(schemaRoot, "CommandExecutionRequestApprovalParams.json"), "utf8"),
  );
  const response = JSON.parse(
    await readFile(path.join(schemaRoot, "CommandExecutionRequestApprovalResponse.json"), "utf8"),
  );
  assert.deepEqual(
    new Set(params.required),
    new Set(["threadId", "turnId", "itemId", "sandboxPermissions", "startedAtMs"]),
  );
  assert.deepEqual(
    params.definitions.SandboxPermissions.oneOf.flatMap((branch) => branch.enum ?? []),
    ["use_default", "require_escalated", "with_additional_permissions"],
  );
  assert.equal(params.properties.availableDecisions, undefined);
  assert.equal(params.properties.additionalPermissions, undefined);
  const decisions = response.definitions.CommandExecutionApprovalDecision.oneOf.flatMap(
    (branch) => branch.enum ?? [],
  );
  assert.equal(decisions.includes("accept"), true);
  assert.equal(decisions.includes("cancel"), true);
  assert.equal(decisions.includes("decline"), true, "Host must not accidentally map Cancel to Decline");
});
