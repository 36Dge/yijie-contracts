import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const [schemaV4, schemaV3] = await Promise.all([
  readFile("jsonschema/agent/session-event-v4.schema.json", "utf8").then(JSON.parse),
  readFile("jsonschema/agent/session-event-v3.schema.json", "utf8").then(JSON.parse),
]);
const fixtureRoot = "tests/fixtures/agent/session-event-v4";

function compile(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const keyword of [
    "x-yijie-max-reasoning-items-per-turn",
    "x-yijie-max-reasoning-utf8-bytes-per-turn",
    "x-yijie-max-total-utf8-bytes",
    "x-yijie-max-utf8-bytes",
    "x-yijie-max-sse-data-utf8-bytes",
  ]) ajv.addKeyword({ keyword, schemaType: "number" });
  ajv.addKeyword({ keyword: "x-yijie-content-index-rule", schemaType: "string" });
  ajv.addKeyword({ keyword: "x-yijie-projection-limit-policy", schemaType: "object" });
  return ajv.compile(schema);
}

const validateV4 = compile(schemaV4);
const validateV3 = compile(schemaV3);

async function fixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

test("v4 canonical AgentMessage phase and stable plan fixtures validate", async () => {
  for (const name of [
    "agent-message-commentary-started.json",
    "agent-message-final-completed.json",
    "agent-message-null-phase-started.json",
    "turn-plan-updated.json",
    "turn-plan-cleared.json",
  ]) {
    const event = await fixture(name);
    assert.equal(validateV4(event), true, `${name}: ${JSON.stringify(validateV4.errors)}`);
  }
});

test("v4 AgentMessage lifecycle requires a bounded text and closed phase", async () => {
  const started = await fixture("agent-message-commentary-started.json");
  const completed = await fixture("agent-message-final-completed.json");
  const invalid = [
    { ...started, schema_version: 3 },
    { ...started, payload: { item_type: "agentMessage", text: "" } },
    { ...started, payload: { ...started.payload, phase: "analysis" } },
    { ...started, payload: { ...started.payload, phase: "commentary", extra: true } },
    { ...started, payload: { ...started.payload, text: undefined } },
    { ...completed, payload: { ...completed.payload, phase: undefined } },
  ];
  for (const event of invalid) assert.equal(validateV4(event), false, JSON.stringify(event));

  const nonAgent = {
    ...started,
    item_id: "command-1",
    payload: { item_type: "commandExecution", text: "synthetic metadata" },
  };
  assert.equal(validateV4(nonAgent), true, JSON.stringify(validateV4.errors));
  assert.equal(
    validateV4({ ...nonAgent, payload: { ...nonAgent.payload, phase: null } }),
    false,
    "non-AgentMessage lifecycle must not carry phase",
  );
});

test("v4 plan is a complete ordered snapshot and rejects unstable or experimental shapes", async () => {
  const updated = await fixture("turn-plan-updated.json");
  const cleared = await fixture("turn-plan-cleared.json");
  const withoutExplanation = {
    ...cleared,
    event_id: "019fbf58-10c0-7b00-8000-000000000006",
    payload: { plan: [] },
  };
  assert.equal(validateV4(withoutExplanation), true, JSON.stringify(validateV4.errors));
  assert.equal(
    validateV4({ ...updated, payload: { plan: [{ step: "", status: "pending" }] } }),
    true,
    "stable Runtime allows an empty step; consumers must not invent replacement content",
  );

  const invalid = [
    { ...updated, item_id: "plan-item-must-not-exist" },
    { ...updated, terminal: true },
    { ...updated, payload: { explanation: updated.payload.explanation } },
    { ...updated, payload: { ...updated.payload, plan: [{ step: "x", status: "started" }] } },
    { ...updated, payload: { ...updated.payload, plan: [{ id: "invented", step: "x", status: "pending" }] } },
    { ...updated, event_type: "item.plan.delta", item_id: "experimental-plan-1" },
    { ...updated, event_type: "turn/plan/updated" },
  ];
  for (const event of invalid) assert.equal(validateV4(event), false, JSON.stringify(event));

  function reducePlan(state, event) {
    assert.equal(event.event_type, "turn.plan.updated");
    assert.equal(state?.terminal ?? false, false, "plan update after turn terminal");
    if (state && event.sequence <= state.sequence) return state;
    return {
      sequence: event.sequence,
      explanation: event.payload.explanation ?? null,
      plan: structuredClone(event.payload.plan),
    };
  }
  const current = reducePlan(undefined, updated);
  const ignoredOlder = reducePlan(current, { ...updated, sequence: 1, payload: { plan: [] } });
  assert.deepEqual(ignoredOlder, current, "older at-least-once delivery cannot replace state");
  assert.deepEqual(reducePlan(current, cleared), { sequence: 7, explanation: null, plan: [] });
  assert.throws(() => reducePlan({ sequence: 8, terminal: true }, cleared), /after turn terminal/);
});

test("v4 freezes the 1 MiB serialized SSE cap and fail-closed projection semantics", async () => {
  const updated = await fixture("turn-plan-updated.json");
  const cap = schemaV4["x-yijie-max-sse-data-utf8-bytes"];
  const policy = schemaV4["x-yijie-projection-limit-policy"];
  assert.equal(cap, 1 << 20);
  assert.deepEqual(policy, {
    mode: "reject_without_truncation",
    reasoning_limit_result: "reasoning_finalized_unavailable",
    managed_thread_start_result: "http_500_internal_error",
    thread_problem_event_type: "warning",
    problem_event_type: "error",
    problem_code: "limit_exceeded",
    will_retry: false,
    terminal_status: "failed",
  });

  for (const name of [
    "agent-message-commentary-started.json",
    "agent-message-final-completed.json",
    "agent-message-null-phase-started.json",
    "turn-plan-updated.json",
    "turn-plan-cleared.json",
  ]) {
    assert.ok(Buffer.byteLength(JSON.stringify(await fixture(name)), "utf8") <= cap, name);
  }

  const oversized = {
    ...updated,
    payload: {
      explanation: null,
      plan: Array.from({ length: 128 }, (_, index) => ({
        step: `${index}:` + "界".repeat(16380),
        status: "pending",
      })),
    },
  };
  assert.equal(validateV4(oversized), true, JSON.stringify(validateV4.errors));
  assert.ok(Buffer.byteLength(JSON.stringify(oversized), "utf8") > cap);

  const { item_id: _forbiddenItem, ...turnScoped } = oversized;
  const problem = {
    ...turnScoped,
    event_id: "019fbf58-10c0-7b00-8000-000000000007",
    sequence: oversized.sequence + 1,
    event_type: "error",
    terminal: false,
    payload: {
      code: "limit_exceeded",
      message: "agent event exceeded local projection limit",
      will_retry: false,
    },
  };
  const terminal = {
    ...turnScoped,
    event_id: "019fbf58-10c0-7b00-8000-000000000008",
    sequence: oversized.sequence + 2,
    event_type: "turn.completed",
    terminal: true,
    payload: {
      status: "failed",
      code: "limit_exceeded",
      message: "agent event exceeded local projection limit",
    },
  };
  for (const event of [problem, terminal]) {
    assert.equal(validateV4(event), true, JSON.stringify(validateV4.errors));
    assert.ok(Buffer.byteLength(JSON.stringify(event), "utf8") <= cap);
    assert.equal(JSON.stringify(event).includes("界界界"), false, "failure must not echo rejected content");
  }

  const threadStarted = {
    schema_version: 4,
    event_id: "019fbf58-10c0-7b00-8000-000000000009",
    stream_id: oversized.stream_id,
    sequence: 1,
    occurred_at: oversized.occurred_at,
    task_id: oversized.task_id,
    agent_session_id: oversized.agent_session_id,
    codex_thread_id: oversized.codex_thread_id,
    event_type: "thread.started",
    terminal: false,
    payload: { model: "x".repeat(257), model_provider: "minimax" },
  };
  assert.equal(validateV4(threadStarted), false, "managed thread identity must fail before stream start");

  const oversizedWarning = {
    ...threadStarted,
    payload: { message: "x".repeat(16385), will_retry: false },
    event_type: "warning",
  };
  assert.equal(validateV4(oversizedWarning), false);
  const sanitizedWarning = {
    ...oversizedWarning,
    payload: {
      code: "limit_exceeded",
      message: "agent event exceeded local projection limit",
      will_retry: false,
    },
  };
  assert.equal(validateV4(sanitizedWarning), true, JSON.stringify(validateV4.errors));
  assert.ok(Buffer.byteLength(JSON.stringify(sanitizedWarning), "utf8") <= cap);
  assert.equal(JSON.stringify(sanitizedWarning).includes("x".repeat(512)), false);
});

test("v4 phase reconciliation uses completed lifecycle as the latest authority", async () => {
  const [started, completed] = await Promise.all([
    fixture("agent-message-null-phase-started.json"),
    fixture("agent-message-final-completed.json"),
  ]);
  const completedForSameItem = {
    ...completed,
    item_id: started.item_id,
    sequence: started.sequence + 1,
  };
  const state = new Map();
  for (const event of [started, completedForSameItem]) {
    state.set(event.item_id, {
      sequence: event.sequence,
      phase: event.payload.phase,
      text: event.payload.text,
    });
  }
  assert.deepEqual(state.get(started.item_id), {
    sequence: started.sequence + 1,
    phase: "final_answer",
    text: "synthetic final response",
  });
});

test("v4 freezes inherited raw-reasoning caps and content-index semantics", () => {
  assert.equal(schemaV4["x-yijie-max-reasoning-items-per-turn"], 8);
  assert.equal(schemaV4["x-yijie-max-reasoning-utf8-bytes-per-turn"], 262144);
  assert.equal(schemaV4.definitions.reasoningTextFinalizedPayloadV4["x-yijie-max-total-utf8-bytes"], 131072);
  assert.equal(
    schemaV4.definitions.reasoningTextFinalizedPayloadV4.properties.contents["x-yijie-content-index-rule"],
    "zero-based-contiguous-ascending-unique",
  );
});

test("v4 preserves every v3 lifecycle, reasoning, and artifact variant without widening v3", async () => {
  const [phaseV4, planV4] = await Promise.all([
    fixture("agent-message-commentary-started.json"),
    fixture("turn-plan-updated.json"),
  ]);
  const common = {
    schema_version: 4,
    event_id: "019fbf58-10c0-7b00-8000-000000000020",
    stream_id: "019fbf58-10c0-7b00-8000-000000000021",
    sequence: 1,
    occurred_at: "2026-08-28T06:00:00Z",
    task_id: "019fbf58-10c0-7b00-8000-000000000022",
    agent_session_id: "019fbf58-10c0-7b00-8000-000000000023",
    codex_thread_id: "019fbf58-10c0-7b00-8000-000000000024",
  };
  const turn_id = "019fbf58-10c0-7b00-8000-000000000025";
  const item_id = "agent-message-preserved-1";
  const lifecycle = [
    { ...common, event_type: "thread.started", terminal: false, payload: { model: "MiniMax-M3", model_provider: "minimax" } },
    { ...common, turn_id, event_type: "turn.started", terminal: false, payload: { status: "in_progress" } },
    { ...common, turn_id, item_id, event_type: "item.started", terminal: false, payload: { item_type: "agentMessage", text: "", phase: null } },
    { ...common, turn_id, item_id, event_type: "item.agent_message.delta", terminal: false, payload: { delta: "synthetic" } },
    { ...common, turn_id, item_id, event_type: "item.completed", terminal: false, payload: { item_type: "agentMessage", text: "synthetic", phase: "final_answer" } },
    { ...common, turn_id, event_type: "turn.completed", terminal: true, payload: { status: "completed" } },
    { ...common, turn_id, event_type: "error", terminal: false, payload: { code: "synthetic", message: "synthetic problem", will_retry: false } },
    { ...common, event_type: "warning", terminal: false, payload: { message: "synthetic warning", will_retry: false } },
  ];
  for (const event of lifecycle) {
    assert.equal(validateV4(event), true, `${event.event_type}: ${JSON.stringify(validateV4.errors)}`);
  }

  for (const name of [
    "reasoning-delta.json",
    "reasoning-finalized-complete.json",
    "reasoning-finalized-incomplete.json",
    "reasoning-finalized-unavailable.json",
  ]) {
    const event = JSON.parse(
      await readFile(`tests/fixtures/agent/session-event-v2/${name}`, "utf8"),
    );
    assert.equal(validateV4({ ...event, schema_version: 4 }), true, `${name}: ${JSON.stringify(validateV4.errors)}`);
  }

  for (const name of await readdir("tests/fixtures/agent/session-event-v3")) {
    if (!name.endsWith(".json")) continue;
    const event = JSON.parse(
      await readFile(`tests/fixtures/agent/session-event-v3/${name}`, "utf8"),
    );
    const v4 = { ...event, schema_version: 4 };
    assert.equal(validateV4(v4), true, `${name}: ${JSON.stringify(validateV4.errors)}`);
    if (v4.payload.content_href) assert.match(v4.payload.content_href, /^\/v3\//);
    if (v4.payload.poster_href) assert.match(v4.payload.poster_href, /^\/v3\//);
  }

  assert.equal(validateV3({ ...phaseV4, schema_version: 3 }), false, "v3 must reject phase");
  assert.equal(validateV3({ ...planV4, schema_version: 3 }), false, "v3 must reject plan event");
});

test("pinned Runtime stable phase, plan, and reasoning shapes align when checkout is available", async (t) => {
  const runtimeRepo = process.env.YIJIE_CODEX_REPO ?? path.resolve("../yijie-codex");
  const runtimeSchemaPath = path.join(
    runtimeRepo,
    ".yijie/schemas/app-server/generated-json-schema/ServerNotification.json",
  );
  try {
    await access(runtimeSchemaPath);
  } catch {
    t.skip(`Runtime schema checkout unavailable at ${runtimeSchemaPath}`);
    return;
  }
  const [runtime, compatibility] = await Promise.all([
    readFile(runtimeSchemaPath, "utf8").then(JSON.parse),
    readFile("compatibility/agent-host-runtime-v1.json", "utf8").then(JSON.parse),
  ]);

  assert.deepEqual(
    runtime.definitions.MessagePhase.oneOf.flatMap((branch) => branch.enum ?? []),
    ["commentary", "final_answer"],
  );
  const agentMessage = runtime.definitions.ThreadItem.oneOf.find(
    (branch) => branch.title === "AgentMessageThreadItem",
  );
  assert.ok(agentMessage.required.includes("text"));
  assert.equal(agentMessage.required.includes("phase"), false);
  assert.equal(agentMessage.properties.phase.default, null);

  const runtimePlan = runtime.definitions.TurnPlanUpdatedNotification;
  assert.deepEqual(runtimePlan.required, ["plan", "threadId", "turnId"]);
  assert.deepEqual(runtimePlan.properties.explanation.type, ["string", "null"]);
  assert.equal(runtimePlan.properties.plan.items.$ref, "#/definitions/TurnPlanStep");
  assert.deepEqual(runtime.definitions.TurnPlanStepStatus.enum, ["pending", "inProgress", "completed"]);
  assert.deepEqual(schemaV4.definitions.turnPlanStepV4.properties.status.enum, ["pending", "in_progress", "completed"]);

  const reasoning = runtime.definitions.ReasoningTextDeltaNotification;
  assert.deepEqual(reasoning.required, ["contentIndex", "delta", "itemId", "threadId", "turnId"]);
  assert.equal(reasoning.properties.contentIndex.type, "integer");
  assert.equal(reasoning.properties.delta.type, "string");

  const runtimeMethods = new Set(
    runtime.oneOf.flatMap((branch) => branch.properties?.method?.enum ?? []),
  );
  for (const method of ["turn/plan/updated", "item/reasoning/textDelta", "item/plan/delta"]) {
    assert.equal(runtimeMethods.has(method), true, method);
  }
  const projected = new Set(compatibility.host_projection.runtime_notifications);
  assert.equal(projected.has("turn/plan/updated"), true);
  assert.equal(projected.has("item/reasoning/textDelta"), true);
  assert.equal(projected.has("item/plan/delta"), false, "experimental plan delta must stay excluded");
});

test("JSON, Protobuf, OpenAPI, AsyncAPI, and SDK generation authorities align for v4", async () => {
  const [proto, openApiText, asyncApiText, generator] = await Promise.all([
    readFile("protobuf/yijie/events/v4/agent_session.proto", "utf8"),
    readFile("openapi/agent-host/agent-host.yaml", "utf8"),
    readFile("asyncapi/events.yaml", "utf8"),
    readFile("scripts/generate.mjs", "utf8"),
  ]);
  const host = parseYaml(openApiText);
  const asyncApi = parseYaml(asyncApiText);

  for (const pattern of [
    /AGENT_EVENT_TYPE_TURN_PLAN_UPDATED = 15;/,
    /AGENT_MESSAGE_PHASE_COMMENTARY = 1;/,
    /AGENT_MESSAGE_PHASE_FINAL_ANSWER = 2;/,
    /optional AgentMessagePhase phase = 3;/,
    /repeated TurnPlanStep plan = 1;/,
    /optional string explanation = 2;/,
    /TurnPlanUpdatedPayload turn_plan_updated = 34;/,
  ]) assert.match(proto, pattern);

  const stream = host.paths["/v4/agent-sessions/{agent_session_id}/events"].get;
  assert.equal(stream.operationId, "streamAgentSessionEventsV4");
  assert.ok(stream.parameters.some(({ $ref }) => $ref === "#/components/parameters/EventSchemaVersionV4"));
  assert.deepEqual(host.components.parameters.EventSchemaVersionV4.schema.enum, [4]);
  assert.equal(
    stream.responses["200"].content["text/event-stream"].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event-v4.schema.json",
  );
  assert.equal(
    asyncApi.components.messages.AgentSessionEventV4.payload.$ref,
    "../jsonschema/agent/session-event-v4.schema.json",
  );
  assert.equal(
    asyncApi.operations.receiveAgentSessionEventsV4.channel.$ref,
    "#/channels/agentSessionEventsV4",
  );
  assert.match(generator, /AgentSessionEventsV4/);
  assert.match(generator, /AgentSessionEventSchemaV4/);
});
