import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const [schemaV5, schemaV4, protoV5, agentHostOpenApi, eventsAsyncApi, packageJson, generatedIndex, v5ContractDoc] = await Promise.all([
  readFile("jsonschema/agent/session-event-v5.schema.json", "utf8").then(JSON.parse),
  readFile("jsonschema/agent/session-event-v4.schema.json", "utf8").then(JSON.parse),
  readFile("protobuf/yijie/events/v5/agent_session.proto", "utf8"),
  readFile("openapi/agent-host/agent-host.yaml", "utf8").then(parseYaml),
  readFile("asyncapi/events.yaml", "utf8").then(parseYaml),
  readFile("package.json", "utf8").then(JSON.parse),
  readFile("sdks/typescript/src/index.ts", "utf8"),
  readFile("docs/agent-session-events-v5.md", "utf8"),
]);

const fixtureRoot = "tests/fixtures/agent/session-event-v5";
const positiveFixtures = [
  "command-completed.json",
  "command-declined.json",
  "command-failed-head-tail.json",
  "command-output-delta.json",
  "command-started.json",
  "tool-completed-known.json",
  "tool-declined-reserved-fixture-only.json",
  "tool-failed-result.json",
  "tool-progress.json",
  "tool-started-known.json",
  "tool-unknown-failed.json",
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
  return Object.values(value).reduce(
    (total, entry) => total + totalBoundedTextBytes(entry),
    0,
  );
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
  return ajv.compile(schema);
}

const validateV5 = compile(schemaV5);
const validateV4 = compile(schemaV4);

async function fixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

function withoutProperty(value, property) {
  const result = structuredClone(value);
  delete result[property];
  return result;
}

function assertValid(event, label = event.event_type) {
  assert.equal(validateV5(event), true, `${label}: ${JSON.stringify(validateV5.errors)}`);
}

function assertInvalid(event, label) {
  assert.equal(validateV5(event), false, `${label}: event unexpectedly validated`);
}

function multibyteAtOrBelow(maximum) {
  return "界".repeat(Math.floor(maximum / 3));
}

function multibyteAbove(maximum) {
  return "界".repeat(Math.floor(maximum / 3) + 1);
}

test("v5 canonical Command and Tool fixtures are the complete positive fixture set", async () => {
  assert.deepEqual((await readdir(fixtureRoot)).sort(), positiveFixtures);
  for (const name of positiveFixtures) assertValid(await fixture(name), name);

  const reservedDeclined = await fixture("tool-declined-reserved-fixture-only.json");
  assert.equal(reservedDeclined.payload.status, "declined");
  assert.equal(reservedDeclined.payload.error.code, "tool_declined");
  assert.equal(
    schemaV5["x-yijie-command-tool-projection-policy"].tool_declined_status,
    "reserved_without_current_runtime_producer",
    "the fixture validates a reserved contract status and is not producer evidence",
  );
});

test("v5 freezes Command and Tool projection caps, identity, and replay policy", () => {
  assert.equal(schemaV5["x-yijie-max-sse-data-utf8-bytes"], 1 << 20);
  assert.equal(
    schemaV5["x-yijie-projection-limit-policy"].scope,
    "inherited_non_command_tool_variants",
  );
  assert.equal(schemaV5["x-yijie-projection-limit-policy"].mode, "reject_without_truncation");
  assert.deepEqual(schemaV5["x-yijie-command-tool-projection-policy"], {
    scope: "command_and_tool_variants",
    mode: "redact_then_truncate",
    takes_precedence_within_scope: true,
    sse_measurement: "utf8_bytes_of_compact_json_data_value",
    redaction_before_utf8_measurement_and_truncation: true,
    command_summary_max_utf8_bytes: 4096,
    command_cwd_max_utf8_bytes: 1024,
    command_cwd_separator_utf8_bytes: 1,
    command_output_delta_max_utf8_bytes: 16384,
    command_output_live_aggregate_max_utf8_bytes_per_item: 262144,
    command_output_snapshot_max_utf8_bytes: 262144,
    command_output_head_max_utf8_bytes: 131072,
    command_output_tail_max_utf8_bytes: 131072,
    tool_identity_part_max_utf8_bytes: 256,
    tool_arguments_summary_max_utf8_bytes: 8192,
    tool_progress_summary_max_utf8_bytes: 4096,
    tool_progress_max_events_per_item: 32,
    tool_progress_max_utf8_bytes_per_item: 65536,
    tool_result_summary_max_utf8_bytes: 65536,
    error_summary_max_utf8_bytes: 4096,
    deduplicate_by: "event_id",
    same_content_different_event_ids_are_distinct: true,
    completed_snapshot_is_authoritative: true,
    tool_declined_status: "reserved_without_current_runtime_producer",
    raw_fields_are_forbidden: true,
  });
});

test("v5 JSON, Protobuf, OpenAPI, AsyncAPI, package, and SDK authorities align", () => {
  assert.equal(packageJson.version, "0.7.0");
  assert.equal(agentHostOpenApi.info.version, "0.7.0");
  assert.equal(eventsAsyncApi.info.version, "0.7.0");
  assert.equal(schemaV5.properties.schema_version.const, 5);
  assert.match(protoV5, /package yijie\.events\.v5;/);
  assert.match(protoV5, /Always 5\. Consumers negotiate v5/);

  const route = agentHostOpenApi.paths["/v5/agent-sessions/{agent_session_id}/events"].get;
  assert.equal(route.operationId, "streamAgentSessionEventsV5");
  assert.deepEqual(agentHostOpenApi.components.parameters.EventSchemaVersionV5.schema.enum, [5]);
  assert.equal(
    route.responses["200"].content["text/event-stream"].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event-v5.schema.json",
  );

  assert.equal(eventsAsyncApi.channels.agentSessionEventsV5.address, "agent.session.events.v5");
  assert.equal(
    eventsAsyncApi.components.messages.AgentSessionEventV5.payload.$ref,
    "../jsonschema/agent/session-event-v5.schema.json",
  );
  assert.equal(
    eventsAsyncApi.operations.receiveAgentSessionEventsV5.channel.$ref,
    "#/channels/agentSessionEventsV5",
  );
  assert.match(
    eventsAsyncApi.components.messages.AgentSessionEventV5.description,
    /typed transport projection, not an independent validity authority/,
  );
  assert.match(protoV5, /JSON Schema agent\/session-event-v5 is the semantic validity authority/);
  assert.match(protoV5, /adapters MUST reject unset required/);
  assert.match(v5ContractDoc, /Proto3 encoding alone is not a validator/);
  assert.match(v5ContractDoc, /Receiving syntactically\s+decodable Protobuf is never sufficient authority/);
  assert.match(
    generatedIndex,
    /export \* as AgentSessionEventsV5 from "\.\/protobuf\/yijie\/events\/v5\/agent_session_pb\.js";/,
  );
  assert.match(
    generatedIndex,
    /export \* as AgentSessionEventSchemaV5 from "\.\/jsonschema\/agent-session-event-v5\.gen\.js";/,
  );
});

test("v5 Command lifecycle is closed, path-safe, bounded, and status/error consistent", async () => {
  const [started, delta, completed, failed, declined] = await Promise.all([
    fixture("command-started.json"),
    fixture("command-output-delta.json"),
    fixture("command-completed.json"),
    fixture("command-failed-head-tail.json"),
    fixture("command-declined.json"),
  ]);

  const invalid = [
    [
      { ...started, payload: { ...started.payload, raw_command: "must be rejected" } },
      "raw command",
    ],
    [
      { ...started, payload: { ...started.payload, command: ["git", "status"] } },
      "command argv",
    ],
    [
      { ...started, payload: { ...started.payload, cwd: "/workspace/private" } },
      "absolute cwd string",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "absolute", path: "/workspace/private" },
        },
      },
      "absolute cwd object",
    ],
    [
      {
        ...started,
        payload: { ...started.payload, cwd: { kind: "workspace_relative", segments: [".."] } },
      },
      "parent cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["nested/path"] },
        },
      },
      "slash-bearing cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["volume:name"] },
        },
      },
      "colon-bearing cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["line\nbreak"] },
        },
      },
      "control-character cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["CON"] },
        },
      },
      "Windows device cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["trailing."] },
        },
      },
      "trailing-dot cwd segment",
    ],
    [
      {
        ...started,
        payload: {
          ...started.payload,
          cwd: { kind: "workspace_relative", segments: ["bidi\u202Ename"] },
        },
      },
      "bidi-control cwd segment",
    ],
    [{ ...started, payload: { ...started.payload, _meta: {} } }, "command _meta"],
    [
      { ...started, payload: { ...started.payload, status: "completed" } },
      "started status mismatch",
    ],
    [{ ...delta, payload: { ...delta.payload, raw_output: "must be rejected" } }, "raw output"],
    [{ ...delta, payload: { ...delta.payload, _meta: {} } }, "delta _meta"],
    [
      {
        ...completed,
        payload: {
          ...completed.payload,
          error: { code: "command_failed", summary: "must be rejected" },
        },
      },
      "completed command with error",
    ],
    [
      { ...completed, payload: withoutProperty(completed.payload, "output") },
      "completed command without output",
    ],
    [
      {
        ...declined,
        payload: {
          ...declined.payload,
          output: { retention: "unavailable", truncated: false },
        },
      },
      "unavailable command output without reason",
    ],
    [
      { ...failed, payload: withoutProperty(failed.payload, "output") },
      "failed command without output",
    ],
    [
      { ...declined, payload: withoutProperty(declined.payload, "output") },
      "declined command without output",
    ],
    [
      { ...failed, payload: withoutProperty(failed.payload, "error") },
      "failed command without error",
    ],
    [
      {
        ...failed,
        payload: {
          ...failed.payload,
          error: { code: "command_declined", summary: "wrong status/code pair" },
        },
      },
      "failed command with declined code",
    ],
    [
      {
        ...declined,
        payload: {
          ...declined.payload,
          error: { code: "command_failed", summary: "wrong status/code pair" },
        },
      },
      "declined command with failed code",
    ],
    [
      { ...completed, payload: { ...completed.payload, duration_ms: 9007199254740992 } },
      "Command duration above JSON safe integer",
    ],
    [
      { ...completed, payload: { ...completed.payload, exit_code: 2147483648 } },
      "Command exit code above sint32",
    ],
  ];

  for (const [event, label] of invalid) assertInvalid(event, label);
});

test("v5 Tool lifecycle forbids raw fields and enforces identity/status/error pairs", async () => {
  const [started, progress, completed, failedResult, unknown, declined] = await Promise.all([
    fixture("tool-started-known.json"),
    fixture("tool-progress.json"),
    fixture("tool-completed-known.json"),
    fixture("tool-failed-result.json"),
    fixture("tool-unknown-failed.json"),
    fixture("tool-declined-reserved-fixture-only.json"),
  ]);
  assert.equal(failedResult.payload.status, "failed");
  assert.equal(failedResult.payload.error.code, "tool_failed");
  assert.ok(failedResult.payload.result_summary, "Runtime is_error results retain a safe summary");

  const failedWithoutError = { ...unknown, payload: withoutProperty(unknown.payload, "error") };
  const invalid = [
    [{ ...started, payload: { ...started.payload, raw_arguments: {} } }, "raw arguments"],
    [{ ...started, payload: { ...started.payload, arguments: {} } }, "full arguments"],
    [{ ...started, payload: { ...started.payload, _meta: {} } }, "tool _meta"],
    [
      { ...started, payload: { ...started.payload, status: "completed" } },
      "tool started status mismatch",
    ],
    [{ ...progress, payload: { ...progress.payload, status: "failed" } }, "progress status mismatch"],
    [{ ...progress, payload: { ...progress.payload, progress_index: 32 } }, "progress count overflow"],
    [
      {
        ...completed,
        payload: { ...completed.payload, raw_result: { content: "must be rejected" } },
      },
      "raw result",
    ],
    [
      { ...completed, payload: { ...completed.payload, result: { content: "must be rejected" } } },
      "full result",
    ],
    [
      {
        ...completed,
        payload: {
          ...completed.payload,
          error: { code: "tool_failed", summary: "must be rejected" },
        },
      },
      "completed tool with error",
    ],
    [
      { ...completed, payload: withoutProperty(completed.payload, "result_summary") },
      "completed tool without result summary",
    ],
    [failedWithoutError, "failed tool without error"],
    [
      {
        ...unknown,
        payload: {
          ...unknown.payload,
          identity: {
            resolution: "unknown",
            server_name: "unregistered",
            tool_name: "unknown_operation",
          },
        },
      },
      "unknown identity with source-derived labels",
    ],
    [
      {
        ...unknown,
        payload: {
          ...unknown.payload,
          error: { code: "tool_declined", summary: "wrong status/code pair" },
        },
      },
      "failed tool with declined code",
    ],
    [
      {
        ...declined,
        payload: {
          ...declined.payload,
          error: { code: "tool_failed", summary: "wrong status/code pair" },
        },
      },
      "declined tool with failed code",
    ],
    [
      {
        ...declined,
        payload: { ...declined.payload, result_summary: completed.payload.result_summary },
      },
      "declined tool with result summary",
    ],
    [
      { ...completed, payload: { ...completed.payload, duration_ms: 9007199254740992 } },
      "Tool duration above JSON safe integer",
    ],
  ];
  for (const [event, label] of invalid) assertInvalid(event, label);
});

test("v5 enforces UTF-8 byte caps independently of JSON Schema character counts", async () => {
  const [commandStarted, commandDelta, commandCompleted, commandFailed, toolStarted, toolProgress, toolCompleted] =
    await Promise.all([
      fixture("command-started.json"),
      fixture("command-output-delta.json"),
      fixture("command-completed.json"),
      fixture("command-failed-head-tail.json"),
      fixture("tool-started-known.json"),
      fixture("tool-progress.json"),
      fixture("tool-completed-known.json"),
    ]);

  const withinDelta = {
    ...commandDelta,
    payload: { ...commandDelta.payload, delta: multibyteAtOrBelow(16384) },
  };
  assertValid(withinDelta, "multibyte command delta within 16 KiB");

  const cwdWithinTotal = {
    ...commandStarted,
    payload: {
      ...commandStarted.payload,
      cwd: {
        kind: "workspace_relative",
        segments: Array.from({ length: 5 }, () => "界".repeat(68)),
      },
    },
  };
  assertValid(cwdWithinTotal, "workspace-relative cwd within aggregate byte cap");

  const invalid = [
    [
      {
        ...commandStarted,
        payload: {
          ...commandStarted.payload,
          command_summary: {
            ...commandStarted.payload.command_summary,
            text: multibyteAbove(4096),
          },
        },
      },
      "command summary UTF-8 cap",
    ],
    [
      {
        ...commandStarted,
        payload: {
          ...commandStarted.payload,
          cwd: { kind: "workspace_relative", segments: ["界".repeat(86)] },
        },
      },
      "cwd segment UTF-8 cap",
    ],
    [
      {
        ...commandStarted,
        payload: {
          ...commandStarted.payload,
          cwd: {
            kind: "workspace_relative",
            segments: Array.from({ length: 6 }, () => "界".repeat(57)),
          },
        },
      },
      "cwd aggregate UTF-8 cap",
    ],
    [
      { ...commandDelta, payload: { ...commandDelta.payload, delta: multibyteAbove(16384) } },
      "command delta UTF-8 cap",
    ],
    [
      {
        ...commandCompleted,
        payload: {
          ...commandCompleted.payload,
          output: {
            ...commandCompleted.payload.output,
            text: multibyteAbove(262144),
          },
        },
      },
      "complete command output UTF-8 cap",
    ],
    [
      {
        ...commandFailed,
        payload: {
          ...commandFailed.payload,
          output: { ...commandFailed.payload.output, head: multibyteAbove(131072) },
        },
      },
      "command head UTF-8 cap",
    ],
    [
      {
        ...commandFailed,
        payload: {
          ...commandFailed.payload,
          error: { ...commandFailed.payload.error, summary: multibyteAbove(4096) },
        },
      },
      "command error UTF-8 cap",
    ],
    [
      {
        ...toolStarted,
        payload: {
          ...toolStarted.payload,
          identity: { ...toolStarted.payload.identity, server_name: multibyteAbove(256) },
        },
      },
      "tool identity UTF-8 cap",
    ],
    [
      {
        ...toolStarted,
        payload: {
          ...toolStarted.payload,
          arguments_summary: {
            ...toolStarted.payload.arguments_summary,
            text: multibyteAbove(8192),
          },
        },
      },
      "tool arguments summary UTF-8 cap",
    ],
    [
      {
        ...toolProgress,
        payload: {
          ...toolProgress.payload,
          summary: { ...toolProgress.payload.summary, text: multibyteAbove(4096) },
        },
      },
      "tool progress summary UTF-8 cap",
    ],
    [
      {
        ...toolCompleted,
        payload: {
          ...toolCompleted.payload,
          result_summary: {
            ...toolCompleted.payload.result_summary,
            text: multibyteAbove(65536),
          },
        },
      },
      "tool result summary UTF-8 cap",
    ],
  ];
  for (const [event, label] of invalid) assertInvalid(event, label);
});

test("v5 enforces the 1 MiB compact JSON SSE data-value cap", async () => {
  const base = await fixture("command-output-delta.json");
  const within = {
    ...base,
    event_type: "item.agent_message.delta",
    payload: { delta: "x".repeat(1_000_000) },
  };
  assert.ok(utf8Bytes(JSON.stringify(within)) < 1_048_576);
  assertValid(within, "compact AgentMessage delta within the SSE cap");

  const above = {
    ...within,
    payload: { delta: "x".repeat(1_048_576) },
  };
  assert.ok(utf8Bytes(JSON.stringify(above)) > 1_048_576);
  assertInvalid(above, "compact AgentMessage delta above the SSE cap");
});

test("v5 is separately negotiated: v4 rejects v5 and v5 rejects schema_version 4", async () => {
  for (const name of positiveFixtures) {
    const event = await fixture(name);
    assert.equal(validateV4(event), false, `${name}: v4 accepted a v5 event`);
    assertInvalid({ ...event, schema_version: 4 }, `${name}: v5 accepted schema_version 4`);
  }

  for (const name of await readdir("tests/fixtures/agent/session-event-v4")) {
    if (!name.endsWith(".json")) continue;
    const event = JSON.parse(
      await readFile(`tests/fixtures/agent/session-event-v4/${name}`, "utf8"),
    );
    assertValid({ ...event, schema_version: 5 }, `${name}: v5 keeps this named v4 event family`);
  }

  const known = await fixture("command-output-delta.json");
  const unknown = { ...known, event_type: "item.unknown.delta" };
  assertInvalid(unknown, "unknown v5 event variant");
  assert.equal(validateV5(unknown) ? "apply" : "discard_and_resync", "discard_and_resync");

  const legacyOpenGeneric = {
    ...known,
    schema_version: 4,
    event_type: "item.started",
    payload: { item_type: "legacyExtension", text: "safe legacy display text" },
  };
  assert.equal(validateV4(legacyOpenGeneric), true, JSON.stringify(validateV4.errors));
  assertInvalid(
    { ...legacyOpenGeneric, schema_version: 5 },
    "v5 intentionally closes the formerly open generic Item payload",
  );

  assertValid(
    {
      ...known,
      event_type: "item.started",
      payload: { item_type: "reasoning" },
    },
    "v5 stable generic Item allowlist",
  );
});

test("projection models enforce per-Item live aggregate and progress-count caps", async () => {
  const [delta, progress] = await Promise.all([
    fixture("command-output-delta.json"),
    fixture("tool-progress.json"),
  ]);

  function boundedAccumulator(maxBytes, maxEvents) {
    return {
      bytes: 0,
      events: 0,
      append(text) {
        const nextBytes = this.bytes + utf8Bytes(text);
        if (this.events === maxEvents) return "event_limit_reached";
        if (nextBytes > maxBytes) return "byte_limit_reached";
        this.events += 1;
        this.bytes = nextBytes;
        return "applied";
      },
    };
  }

  const command = boundedAccumulator(262144, Number.POSITIVE_INFINITY);
  const fullDelta = { ...delta, payload: { ...delta.payload, delta: "x".repeat(16384) } };
  assertValid(fullDelta, "maximum-size Command delta");
  for (let index = 0; index < 16; index += 1) assert.equal(command.append(fullDelta.payload.delta), "applied");
  assert.equal(command.bytes, 262144);
  assert.equal(command.append("x"), "byte_limit_reached");
  assert.equal(command.bytes, 262144, "overflow content is not appended silently");

  const toolByBytes = boundedAccumulator(65536, 32);
  const fullProgress = {
    ...progress,
    payload: {
      ...progress.payload,
      summary: { ...progress.payload.summary, text: "p".repeat(4096) },
    },
  };
  assertValid(fullProgress, "maximum-size Tool progress summary");
  for (let index = 0; index < 16; index += 1) assert.equal(toolByBytes.append(fullProgress.payload.summary.text), "applied");
  assert.equal(toolByBytes.bytes, 65536);
  assert.equal(toolByBytes.append("p"), "byte_limit_reached");

  const toolByCount = boundedAccumulator(65536, 32);
  for (let index = 0; index < 32; index += 1) assert.equal(toolByCount.append("p"), "applied");
  assert.equal(toolByCount.append("p"), "event_limit_reached");
});

test("pure Command reducer deduplicates only event_id and treats completed snapshot as authority", async () => {
  const [delta, completed] = await Promise.all([
    fixture("command-output-delta.json"),
    fixture("command-completed.json"),
  ]);

  function createState() {
    return {
      seenEventIds: new Set(),
      items: new Map(),
      recoveryRequired: false,
    };
  }

  function reduce(state, event) {
    if (state.seenEventIds.has(event.event_id)) return "duplicate_event_id";
    state.seenEventIds.add(event.event_id);
    const item = state.items.get(event.item_id) ?? {
      completed: false,
      streamedText: "",
      output: null,
      status: "running",
    };
    if (event.event_type === "item.command_output.delta") {
      if (item.completed) {
        state.recoveryRequired = true;
        return "late_delta_resync_required";
      }
      item.streamedText += event.payload.delta;
      state.items.set(event.item_id, item);
      return "delta_applied";
    }
    if (event.event_type === "item.completed" && event.payload.item_type === "commandExecution") {
      item.completed = true;
      item.status = event.payload.status;
      item.output = structuredClone(event.payload.output ?? null);
      state.items.set(event.item_id, item);
      return "completed_snapshot_applied";
    }
    return "ignored_event_type";
  }

  const state = createState();
  assert.equal(reduce(state, delta), "delta_applied");
  assert.equal(reduce(state, delta), "duplicate_event_id");
  assert.equal(state.items.get(delta.item_id).streamedText, delta.payload.delta);

  const sameTextDifferentId = {
    ...delta,
    event_id: "019fbf59-1000-7000-8000-00000000000b",
    sequence: delta.sequence + 1,
  };
  assertValid(sameTextDifferentId, "same text with a distinct event_id");
  assert.equal(reduce(state, sameTextDifferentId), "delta_applied");
  assert.equal(
    state.items.get(delta.item_id).streamedText,
    delta.payload.delta + sameTextDifferentId.payload.delta,
    "equal content is not a deduplication key",
  );

  assert.equal(reduce(state, completed), "completed_snapshot_applied");
  assert.deepEqual(
    state.items.get(delta.item_id).output,
    completed.payload.output,
    "completed output snapshot replaces any inference from accumulated chunks",
  );
  assert.equal(state.items.get(delta.item_id).status, "completed");

  const lateDelta = {
    ...delta,
    event_id: "019fbf59-1000-7000-8000-00000000000c",
    sequence: completed.sequence + 1,
  };
  const authoritative = structuredClone(state.items.get(delta.item_id).output);
  assert.equal(reduce(state, lateDelta), "late_delta_resync_required");
  assert.equal(state.recoveryRequired, true);
  assert.deepEqual(state.items.get(delta.item_id).output, authoritative);
});

test("v5 event and generic Item allowlists contain no excluded or unknown capability", () => {
  function collectEventTypeConsts(value, result = []) {
    if (Array.isArray(value)) {
      for (const entry of value) collectEventTypeConsts(entry, result);
      return result;
    }
    if (value == null || typeof value !== "object") return result;
    const eventType = value.properties?.event_type;
    if (typeof eventType?.const === "string") result.push(eventType.const);
    for (const child of Object.values(value)) collectEventTypeConsts(child, result);
    return result;
  }

  const topLevelDefinitions = schemaV5.oneOf.map(({ $ref }) => $ref.split("/").at(-1));
  const eventTypes = new Set(
    topLevelDefinitions.flatMap((definition) =>
      collectEventTypeConsts(schemaV5.definitions[definition]),
    ),
  );
  assert.deepEqual([...eventTypes].sort(), [
    "error",
    "item.agent_message.delta",
    "item.artifact.completed",
    "item.artifact.failed",
    "item.artifact.progress",
    "item.artifact.started",
    "item.command_output.delta",
    "item.completed",
    "item.reasoning_text.delta",
    "item.reasoning_text.finalized",
    "item.started",
    "item.tool.progress",
    "thread.started",
    "turn.completed",
    "turn.plan.updated",
    "turn.started",
    "warning",
  ]);
  for (const eventType of eventTypes) {
    assert.doesNotMatch(eventType, /file.?change|diff|patch|approval/i);
  }

  const eventEnum = /enum AgentEventType \{([\s\S]*?)\n\}/.exec(protoV5)?.[1] ?? "";
  const eventPayloads = /oneof payload \{([\s\S]*?)\n  \}/.exec(protoV5)?.[1] ?? "";
  assert.notEqual(eventEnum, "");
  assert.notEqual(eventPayloads, "");
  for (const authority of [eventEnum, eventPayloads]) {
    assert.doesNotMatch(authority, /FILE_CHANGE|file_change|DIFF|diff|PATCH|patch|APPROVAL|approval/);
  }
  for (const pattern of [
    /AGENT_EVENT_TYPE_ITEM_COMMAND_OUTPUT_DELTA = 16;/,
    /AGENT_EVENT_TYPE_ITEM_TOOL_PROGRESS = 17;/,
    /CommandStartedPayload command_started = 35;/,
    /CommandOutputDeltaPayload command_output_delta = 36;/,
    /CommandCompletedPayload command_completed = 37;/,
    /ToolStartedPayload tool_started = 38;/,
    /ToolProgressPayload tool_progress = 39;/,
    /ToolCompletedPayload tool_completed = 40;/,
    /GenericItemLifecyclePayload generic_item_started = 41;/,
    /GenericItemLifecyclePayload generic_item_completed = 42;/,
  ]) assert.match(protoV5, pattern);

  const genericItemTypes =
    schemaV5.definitions.genericItemLifecyclePayloadV5.properties.item_type.enum;
  assert.deepEqual(genericItemTypes, [
    "userMessage",
    "hookPrompt",
    "reasoning",
    "collabAgentToolCall",
    "subAgentActivity",
    "webSearch",
    "imageView",
    "sleep",
    "imageGeneration",
    "enteredReviewMode",
    "exitedReviewMode",
    "contextCompaction",
  ]);
  for (const itemType of genericItemTypes) {
    assert.doesNotMatch(itemType, /file.?change|diff|patch|approval|dynamic.?tool|plan/i);
  }

  const genericProtoEnum = /enum GenericItemType \{([\s\S]*?)\n\}/.exec(protoV5)?.[1] ?? "";
  assert.notEqual(genericProtoEnum, "");
  assert.doesNotMatch(
    genericProtoEnum,
    /FILE_CHANGE|DIFF|PATCH|APPROVAL|DYNAMIC_TOOL|PLAN/,
  );
  assert.doesNotMatch(protoV5, /string item_type\s*=/);
});
