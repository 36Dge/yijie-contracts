import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

test("listing schema accepts a minimal listing and rejects an invalid URL", async () => {
  const schema = JSON.parse(await readFile("jsonschema/ecommerce/listing.schema.json", "utf8"));
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate({ platform: "amazon", url: "https://www.amazon.com/dp/example" }), true);
  assert.equal(validate({ platform: "amazon", url: "not-a-url" }), false);
});

test("agent session event validates every discriminated variant", async () => {
  const schema = JSON.parse(
    await readFile("jsonschema/agent/session-event.schema.json", "utf8"),
  );
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const common = {
    schema_version: 1,
    event_id: "019c0123-4567-7abc-8123-456789abcdef",
    stream_id: "019c0123-4567-7abc-8123-456789abcdee",
    sequence: 1,
    occurred_at: "2026-07-23T00:00:00Z",
    task_id: "019c0123-4567-7abc-8123-456789abcdea",
    agent_session_id: "019c0123-4567-7abc-8123-456789abcdeb",
    codex_thread_id: "019c0123-4567-7abc-8123-456789abcdec",
  };
  const turn_id = "019c0123-4567-7abc-8123-456789abcded";
  const validEvents = [
    {
      ...common,
      event_type: "thread.started",
      terminal: false,
      payload: { model: "MiniMax-M3", model_provider: "minimax" },
    },
    {
      ...common,
      turn_id,
      event_type: "turn.started",
      terminal: false,
      payload: { status: "in_progress" },
    },
    {
      ...common,
      turn_id,
      item_id: "item-1",
      event_type: "item.started",
      terminal: false,
      payload: { item_type: "agentMessage" },
    },
    {
      ...common,
      turn_id,
      item_id: "item-1",
      event_type: "item.agent_message.delta",
      terminal: false,
      payload: { delta: "hello" },
    },
    {
      ...common,
      turn_id,
      item_id: "item-1",
      event_type: "item.completed",
      terminal: false,
      payload: { item_type: "agentMessage", text: "hello" },
    },
    ...["completed", "interrupted", "failed"].map((status) => ({
      ...common,
      turn_id,
      event_type: "turn.completed",
      terminal: true,
      payload: { status },
    })),
    {
      ...common,
      turn_id,
      event_type: "error",
      terminal: false,
      payload: { code: "rate_limited", message: "retry later", will_retry: true },
    },
    {
      ...common,
      event_type: "warning",
      terminal: false,
      payload: { message: "context truncated", will_retry: false },
    },
  ];

  for (const event of validEvents) {
    assert.equal(
      validate(event),
      true,
      `${event.event_type}: ${JSON.stringify(validate.errors)}`,
    );
  }

  const deltaEvent = validEvents.find(
    ({ event_type }) => event_type === "item.agent_message.delta",
  );
  const turnStarted = validEvents.find(({ event_type }) => event_type === "turn.started");
  const turnCompleted = validEvents.find(
    ({ event_type, payload }) =>
      event_type === "turn.completed" && payload.status === "completed",
  );
  const warning = validEvents.find(({ event_type }) => event_type === "warning");

  const invalidEvents = [
    { ...deltaEvent, payload: {} },
    { ...deltaEvent, payload: { status: "in_progress" } },
    { ...deltaEvent, terminal: true },
    { ...deltaEvent, turn_id: undefined },
    { ...deltaEvent, item_id: undefined },
    { ...deltaEvent, unexpected: true },
    { ...turnStarted, payload: { status: "completed" } },
    { ...turnStarted, item_id: "item-not-allowed" },
    { ...turnCompleted, payload: { status: "in_progress" } },
    { ...turnCompleted, terminal: false },
    { ...warning, turn_id },
    { ...warning, payload: { message: "warning", will_retry: true } },
    { ...warning, event_id: "not-a-uuid" },
  ];

  for (const event of invalidEvents) assert.equal(validate(event), false);
});

test("Agent Session JSON Schema, Protobuf, and AsyncAPI stay aligned", async () => {
  const [schemaSource, protoSource, asyncApiSource] = await Promise.all([
    readFile("jsonschema/agent/session-event.schema.json", "utf8"),
    readFile("protobuf/yijie/events/v1/agent_session.proto", "utf8"),
    readFile("asyncapi/events.yaml", "utf8"),
  ]);
  const schema = JSON.parse(schemaSource);
  const asyncApi = parseYaml(asyncApiSource);

  const mappings = [
    {
      eventType: "thread.started",
      protoEnum: "AGENT_EVENT_TYPE_THREAD_STARTED",
      protoField: "thread_started",
      protoPayload: "ThreadStartedPayload",
      schemaPayload: "#/definitions/threadStartedPayload",
      terminal: false,
      contextualIds: [],
    },
    {
      eventType: "turn.started",
      protoEnum: "AGENT_EVENT_TYPE_TURN_STARTED",
      protoField: "turn_started",
      protoPayload: "TurnLifecyclePayload",
      schemaPayload: "#/definitions/turnStartedPayload",
      terminal: false,
      contextualIds: ["turn_id"],
    },
    {
      eventType: "item.started",
      protoEnum: "AGENT_EVENT_TYPE_ITEM_STARTED",
      protoField: "item_started",
      protoPayload: "ItemLifecyclePayload",
      schemaPayload: "#/definitions/itemLifecyclePayload",
      terminal: false,
      contextualIds: ["turn_id", "item_id"],
    },
    {
      eventType: "item.agent_message.delta",
      protoEnum: "AGENT_EVENT_TYPE_ITEM_AGENT_MESSAGE_DELTA",
      protoField: "agent_message_delta",
      protoPayload: "AgentMessageDeltaPayload",
      schemaPayload: "#/definitions/agentMessageDeltaPayload",
      terminal: false,
      contextualIds: ["turn_id", "item_id"],
    },
    {
      eventType: "item.completed",
      protoEnum: "AGENT_EVENT_TYPE_ITEM_COMPLETED",
      protoField: "item_completed",
      protoPayload: "ItemLifecyclePayload",
      schemaPayload: "#/definitions/itemLifecyclePayload",
      terminal: false,
      contextualIds: ["turn_id", "item_id"],
    },
    {
      eventType: "turn.completed",
      protoEnum: "AGENT_EVENT_TYPE_TURN_COMPLETED",
      protoField: "turn_completed",
      protoPayload: "TurnLifecyclePayload",
      schemaPayload: "#/definitions/turnCompletedPayload",
      terminal: true,
      contextualIds: ["turn_id"],
    },
    {
      eventType: "error",
      protoEnum: "AGENT_EVENT_TYPE_ERROR",
      protoField: "error",
      protoPayload: "AgentProblemPayload",
      schemaPayload: "#/definitions/agentProblemPayload",
      terminal: false,
      contextualIds: ["turn_id"],
    },
    {
      eventType: "warning",
      protoEnum: "AGENT_EVENT_TYPE_WARNING",
      protoField: "warning",
      protoPayload: "AgentProblemPayload",
      schemaPayload: "#/definitions/agentWarningPayload",
      terminal: false,
      contextualIds: [],
    },
  ];

  const enumBlock = protoSource.match(/enum AgentEventType \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(enumBlock, "AgentEventType enum is missing");
  const protoEnums = [...enumBlock.matchAll(/^\s*(AGENT_EVENT_TYPE_[A-Z0-9_]+)\s*=\s*\d+;/gm)]
    .map((match) => match[1])
    .filter((name) => name !== "AGENT_EVENT_TYPE_UNSPECIFIED")
    .sort();

  const turnStatusBlock = protoSource.match(/enum AgentTurnStatus \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(turnStatusBlock, "AgentTurnStatus enum is missing");
  const protoTurnStatuses = [
    ...turnStatusBlock.matchAll(/^\s*AGENT_TURN_STATUS_([A-Z0-9_]+)\s*=\s*\d+;/gm),
  ]
    .map((match) => match[1].toLowerCase())
    .filter((status) => status !== "unspecified")
    .sort();

  const payloadBlock = protoSource.match(/oneof payload \{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(payloadBlock, "AgentSessionEvent payload oneof is missing");
  const protoPayloads = new Map(
    [...payloadBlock.matchAll(/^\s*(\w+)\s+(\w+)\s*=\s*\d+;/gm)].map((match) => [
      match[2],
      match[1],
    ]),
  );

  const variants = new Map(
    schema.oneOf.map((variant) => [variant.properties.event_type.const, variant]),
  );
  assert.equal(variants.size, schema.oneOf.length, "event_type values must be unique");
  assert.deepEqual(
    [...variants.keys()].sort(),
    mappings.map(({ eventType }) => eventType).sort(),
  );
  assert.deepEqual(
    protoEnums,
    mappings.map(({ protoEnum }) => protoEnum).sort(),
  );
  assert.deepEqual(
    [...protoPayloads.keys()].sort(),
    mappings.map(({ protoField }) => protoField).sort(),
  );
  const turnStartedStatuses = [
    schema.definitions.turnStartedPayload.properties.status.const,
  ];
  const turnCompletedStatuses =
    schema.definitions.turnCompletedPayload.properties.status.enum;
  assert.deepEqual(turnStartedStatuses, ["in_progress"]);
  assert.deepEqual(turnCompletedStatuses, ["completed", "interrupted", "failed"]);
  assert.deepEqual(
    [...turnStartedStatuses, ...turnCompletedStatuses].sort(),
    protoTurnStatuses,
    "JSON turn status partitions must cover the Protobuf turn status enum",
  );

  for (const mapping of mappings) {
    const variant = variants.get(mapping.eventType);
    assert.ok(variant, `${mapping.eventType} JSON Schema variant is missing`);
    assert.equal(variant.properties.terminal.const, mapping.terminal);
    assert.equal(variant.properties.payload.$ref, mapping.schemaPayload);
    assert.equal(protoPayloads.get(mapping.protoField), mapping.protoPayload);
    for (const id of ["turn_id", "item_id"]) {
      const expected = mapping.contextualIds.includes(id);
      assert.equal(variant.required.includes(id), expected, `${mapping.eventType} required ${id}`);
      assert.equal(id in variant.properties, expected, `${mapping.eventType} permits ${id}`);
    }
  }

  const asyncMessage = asyncApi.components.messages.AgentSessionEvent;
  assert.equal(asyncMessage.contentType, "application/json");
  assert.equal(
    asyncMessage.correlationId.location,
    "$message.payload#/agent_session_id",
  );
  assert.equal(
    asyncMessage.payload.$ref,
    "../jsonschema/agent/session-event.schema.json",
    "AsyncAPI must reuse the authoritative JSON event union",
  );

  assert.match(
    protoSource,
    /optional string failure_code = 11;/,
    "AgentSession.failure_code must remain an optional additive field at tag 11",
  );
});
