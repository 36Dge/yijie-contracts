import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const eventSchema = JSON.parse(
  await readFile("jsonschema/agent/session-event-v3.schema.json", "utf8"),
);
const reportSchema = JSON.parse(
  await readFile("jsonschema/report/report-document-v1.schema.json", "utf8"),
);
const eventFixtureRoot = "tests/fixtures/agent/session-event-v3";
const reportFixtureRoot = "tests/fixtures/report/report-document-v1";

function compile(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const keyword of ["x-yijie-max-utf8-bytes", "x-yijie-max-json-depth"]) {
    ajv.addKeyword({ keyword, schemaType: "number" });
  }
  return ajv.compile(schema);
}

async function readFixture(root, name) {
  return JSON.parse(await readFile(`${root}/${name}`, "utf8"));
}

const validateEvent = compile(eventSchema);
const validateReport = compile(reportSchema);

test("v3 accepts the four synthetic artifact kinds and all lifecycle variants", async () => {
  for (const name of [
    "image-started.json",
    "image-progress.json",
    "image-completed.json",
    "image-failed.json",
    "video-started.json",
    "video-progress.json",
    "video-completed.json",
    "video-failed.json",
    "file-started.json",
    "file-progress.json",
    "file-completed.json",
    "file-failed.json",
    "report-started.json",
    "report-progress.json",
    "report-completed.json",
    "report-failed.json",
  ]) {
    const fixture = await readFixture(eventFixtureRoot, name);
    assert.equal(validateEvent(fixture), true, `${name}: ${JSON.stringify(validateEvent.errors)}`);
    assert.equal(fixture.schema_version, 3);
    assert.equal(fixture.payload.provenance, "synthetic");
  }
});

test("v3 preserves all v2 lifecycle and reasoning variants under explicit version 3", () => {
  const common = {
    schema_version: 3,
    event_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f50",
    stream_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f51",
    sequence: 1,
    occurred_at: "2026-08-20T02:00:00Z",
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
    { ...common, turn_id, item_id, event_type: "item.reasoning_text.delta", terminal: false, payload: { content_index: 0, delta: "reason" } },
    { ...common, turn_id, item_id, event_type: "item.reasoning_text.finalized", terminal: false, payload: { status: "complete", contents: [{ content_index: 0, text: "reason" }] } },
    { ...common, turn_id, item_id, event_type: "item.completed", terminal: false, payload: { item_type: "agentMessage", text: "answer" } },
    { ...common, turn_id, event_type: "turn.completed", terminal: true, payload: { status: "completed" } },
    { ...common, turn_id, event_type: "error", terminal: false, payload: { code: "rate_limited", message: "retry later", will_retry: true } },
    { ...common, event_type: "warning", terminal: false, payload: { message: "context truncated", will_retry: false } },
  ];
  for (const event of events) {
    assert.equal(validateEvent(event), true, `${event.event_type}: ${JSON.stringify(validateEvent.errors)}`);
  }
});

test("v3 artifact wire is closed, relative-only, bounded, and version-isolated", async () => {
  const started = await readFixture(eventFixtureRoot, "image-started.json");
  const progress = await readFixture(eventFixtureRoot, "image-progress.json");
  const image = await readFixture(eventFixtureRoot, "image-completed.json");
  const file = await readFixture(eventFixtureRoot, "file-completed.json");
  const invalid = [
    { ...started, schema_version: 2 },
    { ...started, unexpected: true },
    { ...started, payload: { ...started.payload, kind: "audio" } },
    { ...progress, payload: { ...progress.payload, stage: undefined, progress_percent: undefined } },
    { ...progress, payload: { ...progress.payload, progress_percent: 101 } },
    { ...image, payload: { ...image.payload, content_href: "https://example.invalid/image.png" } },
    { ...image, payload: { ...image.payload, poster_href: "../poster" } },
    { ...image, payload: { ...image.payload, media_type: "video/mp4" } },
    { ...image, payload: { ...image.payload, size_bytes: 20 * 1024 * 1024 + 1 } },
    { ...file, payload: { ...file.payload, media_type: "image/png" } },
    { ...file, payload: { ...file.payload, poster_href: file.payload.content_href.replace("content", "poster") } },
    { ...file, payload: { ...file.payload, size_bytes: 64 * 1024 * 1024 + 1 } },
    { ...file, payload: { ...file.payload, sha256: file.payload.sha256.toUpperCase() } },
    { ...started, payload: { ...started.payload, ordinal: undefined } },
  ];
  for (const event of invalid) {
    assert.equal(validateEvent(event), false, JSON.stringify(event));
  }
});

test("synthetic completed manifests match the canonical local resource bytes", async () => {
  const resources = [
    ["image-completed.json", "tests/fixtures/agent/resources-v3/synthetic-image-1x1.png.base64", true],
    ["video-completed.json", "tests/fixtures/agent/resources-v3/synthetic-video-16x16.mp4.base64", true],
    ["file-completed.json", "tests/fixtures/agent/resources-v3/synthetic-data.csv", false],
    ["report-completed.json", "tests/fixtures/report/report-document-v1/known-valid.json", false],
  ];
  for (const [eventName, resourcePath, encoded] of resources) {
    const event = await readFixture(eventFixtureRoot, eventName);
    const raw = await readFile(resourcePath);
    const bytes = encoded ? Buffer.from(raw.toString("ascii").trim(), "base64") : raw;
    assert.equal(bytes.byteLength, event.payload.size_bytes, eventName);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      event.payload.sha256,
      eventName,
    );
    assert.equal(
      event.payload.content_href,
      `/v3/agent-sessions/${event.agent_session_id}/artifacts/${event.payload.artifact_id}/content`,
    );
    if (event.payload.poster_href) {
      assert.equal(
        event.payload.poster_href,
        `/v3/agent-sessions/${event.agent_session_id}/artifacts/${event.payload.artifact_id}/poster`,
      );
    }
  }
});

test("artifact stream semantics reject progress-before-start, regression, drift, and double terminal", async () => {
  function validateStream(events) {
    let state;
    for (const event of events) {
      const phase = event.event_type.slice("item.artifact.".length);
      const payload = event.payload;
      if (phase === "started") {
        assert.equal(state, undefined, "duplicate start");
        state = {
          artifact_id: payload.artifact_id,
          kind: payload.kind,
          provenance: payload.provenance,
          ordinal: payload.ordinal,
          sequence: event.sequence,
          progress: -1,
          terminal: false,
        };
        continue;
      }
      assert.ok(state, "progress/terminal before start");
      assert.equal(state.terminal, false, "event after terminal");
      assert.ok(event.sequence > state.sequence, "non-monotonic sequence");
      for (const field of ["artifact_id", "kind", "provenance", "ordinal"]) {
        assert.equal(payload[field], state[field], `${field} drift`);
      }
      if (phase === "progress" && payload.progress_percent !== undefined) {
        assert.ok(payload.progress_percent >= state.progress, "progress regression");
        state.progress = payload.progress_percent;
      }
      if (phase === "completed" || phase === "failed") state.terminal = true;
      state.sequence = event.sequence;
    }
    assert.equal(state?.terminal, true, "missing terminal");
  }

  for (const kind of ["image", "video", "file", "report"]) {
    const [started, progress, completed, failed] = await Promise.all([
      readFixture(eventFixtureRoot, `${kind}-started.json`),
      readFixture(eventFixtureRoot, `${kind}-progress.json`),
      readFixture(eventFixtureRoot, `${kind}-completed.json`),
      readFixture(eventFixtureRoot, `${kind}-failed.json`),
    ]);
    validateStream([started, progress, completed]);
    validateStream([started, progress, failed]);
  }

  const [started, progress, completed] = await Promise.all([
    readFixture(eventFixtureRoot, "image-started.json"),
    readFixture(eventFixtureRoot, "image-progress.json"),
    readFixture(eventFixtureRoot, "image-completed.json"),
  ]);
  assert.throws(() => validateStream([progress, completed]), /before start/);
  assert.throws(
    () => validateStream([started, progress, { ...progress, sequence: 13, payload: { ...progress.payload, progress_percent: 49 } }, completed]),
    /regression/,
  );
  assert.throws(
    () => validateStream([started, { ...progress, payload: { ...progress.payload, kind: "file" } }, completed]),
    /kind drift/,
  );
  assert.throws(
    () => validateStream([started, progress, completed, { ...completed, sequence: 14 }]),
    /after terminal/,
  );
});

test("report v1 strictly decodes known sections and fails soft only for optional unknown sections", async () => {
  for (const name of ["known-valid.json", "unknown-optional-valid.json"]) {
    const fixture = await readFixture(reportFixtureRoot, name);
    assert.equal(validateReport(fixture), true, `${name}: ${JSON.stringify(validateReport.errors)}`);
  }
  for (const name of ["unknown-required-invalid.json", "injection-invalid.json"]) {
    const fixture = await readFixture(reportFixtureRoot, name);
    assert.equal(validateReport(fixture), false, `${name} unexpectedly validated`);
  }
  const opaque = reportSchema.definitions.unknownOptionalSection.properties.payload;
  assert.equal(opaque["x-yijie-max-utf8-bytes"], 131072);
  assert.equal(opaque["x-yijie-max-json-depth"], 8);
});

test("OpenAPI freezes the authoritative after cursor, content/poster resources, and idempotent ACK", async () => {
  const host = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));
  const responseFor = (response) =>
    response.$ref
      ? host.components.responses[response.$ref.slice("#/components/responses/".length)]
      : response;
  const events = host.paths["/v3/agent-sessions/{agent_session_id}/events"].get;
  assert.equal(events.operationId, "streamAgentSessionEventsV3");
  assert.ok(events.parameters.some(({ $ref }) => $ref === "#/components/parameters/EventAfter"));
  assert.equal(host.components.parameters.EventAfter.name, "after");
  assert.equal(host.components.parameters.after_sequence, undefined);
  assert.deepEqual(host.components.parameters.EventSchemaVersionV3.schema.enum, [3]);
  assert.equal(
    events.responses["200"].content["text/event-stream"].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event-v3.schema.json",
  );

  for (const suffix of ["content", "poster"]) {
    const path = host.paths[`/v3/agent-sessions/{agent_session_id}/artifacts/{artifact_id}/${suffix}`];
    assert.ok(path.get, `${suffix} GET`);
    assert.ok(path.head, `${suffix} HEAD`);
    for (const operation of [path.get, path.head]) {
      const success = responseFor(operation.responses["200"]);
      assert.equal(success.headers["Cache-Control"].$ref, "#/components/headers/NoStore");
      assert.equal(success.headers["X-Content-Type-Options"].schema.enum[0], "nosniff");
      assert.ok(operation.responses["410"], `${operation.operationId} expiry response`);
    }
  }

  const ack = host.paths["/v3/agent-sessions/{agent_session_id}/artifacts/{artifact_id}/ack"].post;
  assert.equal(ack.operationId, "acknowledgeAgentArtifactV3");
  assert.match(ack.description, /idempotent/i);
  assert.match(ack.responses["409"].description, /artifact_ack_conflict/);
  assert.equal(
    ack.requestBody.content["application/json"].schema.$ref,
    "#/components/schemas/ArtifactAcknowledgementV3Request",
  );

  const dereference = (value, stack = []) => {
    if (Array.isArray(value)) return value.map((item) => dereference(item, stack));
    if (value === null || typeof value !== "object") return value;
    if (typeof value.$ref === "string") {
      const prefix = "#/components/schemas/";
      assert.ok(value.$ref.startsWith(prefix), `unsupported schema reference ${value.$ref}`);
      const name = value.$ref.slice(prefix.length);
      assert.ok(!stack.includes(name), `circular schema reference ${[...stack, name].join(" -> ")}`);
      return dereference(host.components.schemas[name], [...stack, name]);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, dereference(item, stack)]),
    );
  };
  const ackAjv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ackAjv);
  const validateAckRequest = ackAjv.compile(
    dereference(host.components.schemas.ArtifactAcknowledgementV3Request),
  );
  const validateAckResponse = ackAjv.compile(
    dereference(host.components.schemas.ArtifactAcknowledgementV3Response),
  );
  const [ackRequest, ackResponse] = await Promise.all([
    readFixture("tests/fixtures/agent/host-v3", "artifact-ack-request.json"),
    readFixture("tests/fixtures/agent/host-v3", "artifact-ack-response.json"),
  ]);
  assert.equal(validateAckRequest(ackRequest), true, JSON.stringify(validateAckRequest.errors));
  assert.equal(validateAckResponse(ackResponse), true, JSON.stringify(validateAckResponse.errors));
  assert.equal(validateAckRequest({ ...ackRequest, sha256: ackRequest.sha256.toUpperCase() }), false);
  assert.equal(validateAckRequest({ ...ackRequest, local_path: "/private/artifact.png" }), false);
});

test("JSON, Protobuf, and AsyncAPI v3 authorities stay aligned", async () => {
  const [proto, asyncApiText] = await Promise.all([
    readFile("protobuf/yijie/events/v3/agent_session.proto", "utf8"),
    readFile("asyncapi/events.yaml", "utf8"),
  ]);
  const asyncApi = parseYaml(asyncApiText);
  for (const symbol of [
    "AGENT_EVENT_TYPE_ITEM_ARTIFACT_STARTED",
    "AGENT_EVENT_TYPE_ITEM_ARTIFACT_PROGRESS",
    "AGENT_EVENT_TYPE_ITEM_ARTIFACT_COMPLETED",
    "AGENT_EVENT_TYPE_ITEM_ARTIFACT_FAILED",
    "ARTIFACT_KIND_IMAGE",
    "ARTIFACT_KIND_VIDEO",
    "ARTIFACT_KIND_FILE",
    "ARTIFACT_KIND_REPORT",
  ]) {
    assert.match(proto, new RegExp(symbol));
  }
  assert.equal(
    asyncApi.components.messages.AgentSessionEventV3.payload.$ref,
    "../jsonschema/agent/session-event-v3.schema.json",
  );
  assert.equal(
    asyncApi.operations.receiveAgentSessionEventsV3.channel.$ref,
    "#/channels/agentSessionEventsV3",
  );
});
