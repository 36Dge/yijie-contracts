import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const schema = JSON.parse(
  await readFile("jsonschema/agent/session-event-v2.schema.json", "utf8"),
);
const fixtureRoot = "tests/fixtures/agent/session-event-v2";
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
for (const keyword of [
  "x-yijie-max-reasoning-items-per-turn",
  "x-yijie-max-reasoning-utf8-bytes-per-turn",
  "x-yijie-max-total-utf8-bytes",
  "x-yijie-max-utf8-bytes",
]) {
  ajv.addKeyword({ keyword, schemaType: "number" });
}
ajv.addKeyword({ keyword: "x-yijie-content-index-rule", schemaType: "string" });
const validate = ajv.compile(schema);

async function readFixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, "utf8");
}

function validateFinalizedSemantics(payload) {
  const indexes = payload.contents.map(({ content_index }) => content_index);
  assert.deepEqual(indexes, indexes.map((_, index) => index));
  const totalBytes = payload.contents.reduce((total, part) => {
    assert.ok(utf8Bytes(part.text) <= 65536);
    return total + utf8Bytes(part.text);
  }, 0);
  assert.ok(totalBytes <= 131072);
}

test("Agent session event v2 canonical raw-reasoning fixtures validate", async () => {
  for (const name of [
    "reasoning-delta.json",
    "reasoning-finalized-complete.json",
    "reasoning-finalized-incomplete.json",
    "reasoning-finalized-unavailable.json",
  ]) {
    const fixture = await readFixture(name);
    assert.equal(validate(fixture), true, `${name}: ${JSON.stringify(validate.errors)}`);
    if (fixture.event_type === "item.reasoning_text.delta") {
      assert.ok(utf8Bytes(fixture.payload.delta) <= 16384);
    } else {
      validateFinalizedSemantics(fixture.payload);
    }
  }
});

test("Agent session event v2 preserves all eight v1 lifecycle variants at schema version 2", () => {
  const common = {
    schema_version: 2,
    event_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f50",
    stream_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f51",
    sequence: 1,
    occurred_at: "2026-08-02T10:00:00Z",
    task_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f52",
    agent_session_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f53",
    codex_thread_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f54",
  };
  const turn_id = "019fbd88-cbc3-7bf1-934d-7b05cd693f55";
  const item_id = "agent-message-1";
  const events = [
    { ...common, event_type: "thread.started", terminal: false, payload: { model: "MiniMax-M3", model_provider: "minimax" } },
    { ...common, turn_id, event_type: "turn.started", terminal: false, payload: { status: "in_progress" } },
    { ...common, turn_id, item_id, event_type: "item.started", terminal: false, payload: { item_type: "agentMessage" } },
    { ...common, turn_id, item_id, event_type: "item.agent_message.delta", terminal: false, payload: { delta: "answer" } },
    { ...common, turn_id, item_id, event_type: "item.completed", terminal: false, payload: { item_type: "agentMessage", text: "answer" } },
    { ...common, turn_id, event_type: "turn.completed", terminal: true, payload: { status: "completed" } },
    { ...common, turn_id, event_type: "error", terminal: false, payload: { code: "rate_limited", message: "retry later", will_retry: true } },
    { ...common, event_type: "warning", terminal: false, payload: { message: "context truncated", will_retry: false } },
  ];
  for (const event of events) {
    assert.equal(validate(event), true, `${event.event_type}: ${JSON.stringify(validate.errors)}`);
  }
});

test("Agent session event v2 rejects malformed finalization and closed-union drift", async () => {
  const delta = await readFixture("reasoning-delta.json");
  const complete = await readFixture("reasoning-finalized-complete.json");
  const incomplete = await readFixture("reasoning-finalized-incomplete.json");
  const unavailable = await readFixture("reasoning-finalized-unavailable.json");
  const invalid = [
    { ...delta, schema_version: 1 },
    { ...delta, turn_id: undefined },
    { ...delta, item_id: undefined },
    { ...delta, terminal: true },
    { ...delta, payload: { content_index: 8, delta: "x" } },
    { ...delta, payload: { content_index: 0, delta: "" } },
    { ...delta, unexpected: true },
    { ...complete, payload: { ...complete.payload, reason_code: "runtime_error" } },
    { ...incomplete, payload: { status: "incomplete", contents: incomplete.payload.contents } },
    { ...unavailable, payload: { ...unavailable.payload, contents: [{ content_index: 0, text: "x" }] } },
    { ...unavailable, payload: { status: "unavailable", contents: [] } },
    { ...unavailable, payload: { ...unavailable.payload, reason_code: "unknown_reason" } },
  ];
  for (const event of invalid) assert.equal(validate(event), false, JSON.stringify(event));
});

test("Agent session event v2 freezes byte, part, item, turn, and content-index rules", async () => {
  const payload = schema.definitions.reasoningTextFinalizedPayload;
  assert.equal(schema["x-yijie-max-reasoning-items-per-turn"], 8);
  assert.equal(schema["x-yijie-max-reasoning-utf8-bytes-per-turn"], 262144);
  assert.equal(payload["x-yijie-max-total-utf8-bytes"], 131072);
  assert.equal(payload.properties.contents.maxItems, 8);
  assert.equal(
    payload.properties.contents["x-yijie-content-index-rule"],
    "zero-based-contiguous-ascending-unique",
  );
  assert.equal(schema.definitions.reasoningTextDeltaPayload.properties.delta["x-yijie-max-utf8-bytes"], 16384);
  assert.equal(schema.definitions.reasoningContentPart.properties.text["x-yijie-max-utf8-bytes"], 65536);

  assert.throws(() =>
    validateFinalizedSemantics({
      contents: [
        { content_index: 0, text: "a" },
        { content_index: 2, text: "b" },
      ],
    }),
  );
  assert.throws(() =>
    validateFinalizedSemantics({
      contents: [{ content_index: 0, text: "界".repeat(21846) }],
    }),
  );
});

test("Agent session event v2 JSON, Protobuf, AsyncAPI, and Host negotiation stay aligned", async () => {
  const [proto, asyncApiText, hostOpenApiText] = await Promise.all([
    readFile("protobuf/yijie/events/v2/agent_session.proto", "utf8"),
    readFile("asyncapi/events.yaml", "utf8"),
    readFile("openapi/agent-host/agent-host.yaml", "utf8"),
  ]);
  const asyncApi = parseYaml(asyncApiText);
  const host = parseYaml(hostOpenApiText);

  assert.match(proto, /AGENT_EVENT_TYPE_ITEM_REASONING_TEXT_DELTA = 9;/);
  assert.match(proto, /AGENT_EVENT_TYPE_ITEM_REASONING_TEXT_FINALIZED = 10;/);
  assert.match(proto, /ReasoningTextDeltaPayload reasoning_text_delta = 28;/);
  assert.match(proto, /ReasoningTextFinalizedPayload reasoning_text_finalized = 29;/);
  assert.match(proto, /optional ReasoningReasonCode reason_code = 3;/);
  assert.equal(
    asyncApi.components.messages.AgentSessionEventV2.payload.$ref,
    "../jsonschema/agent/session-event-v2.schema.json",
  );
  assert.equal(
    asyncApi.operations.receiveAgentSessionEventsV2.channel.$ref,
    "#/channels/agentSessionEventsV2",
  );

  const stream = host.paths["/v2/agent-sessions/{agent_session_id}/events"].get;
  assert.equal(stream.operationId, "streamAgentSessionEventsV2");
  assert.ok(
    stream.parameters.some(
      ({ $ref }) => $ref === "#/components/parameters/EventSchemaVersionV2",
    ),
  );
  assert.deepEqual(host.components.parameters.EventSchemaVersionV2.schema.enum, [2]);
  assert.equal(
    stream.responses["200"].content["text/event-stream"].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event-v2.schema.json",
  );

  assert.equal(
    host.paths["/v1/agent-sessions/{agent_session_id}/events"].get.responses["200"].content[
      "text/event-stream"
    ].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event.schema.json",
  );
});
