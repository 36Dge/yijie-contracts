import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

test("listing schema accepts a minimal listing and rejects an invalid URL", async () => {
  const schema = JSON.parse(await readFile("jsonschema/ecommerce/listing.schema.json", "utf8"));
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate({ platform: "amazon", url: "https://www.amazon.com/dp/example" }), true);
  assert.equal(validate({ platform: "amazon", url: "not-a-url" }), false);
});

test("agent session event enforces correlation and delta payloads", async () => {
  const schema = JSON.parse(
    await readFile("jsonschema/agent/session-event.schema.json", "utf8"),
  );
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const event = {
    schema_version: 1,
    event_id: "019c0123-4567-7abc-8123-456789abcdef",
    stream_id: "019c0123-4567-7abc-8123-456789abcdee",
    sequence: 1,
    occurred_at: "2026-07-23T00:00:00Z",
    task_id: "019c0123-4567-7abc-8123-456789abcdea",
    agent_session_id: "019c0123-4567-7abc-8123-456789abcdeb",
    codex_thread_id: "019c0123-4567-7abc-8123-456789abcdec",
    turn_id: "019c0123-4567-7abc-8123-456789abcded",
    item_id: "item-1",
    event_type: "item.agent_message.delta",
    terminal: false,
    payload: { delta: "hello" },
  };

  assert.equal(validate(event), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...event, payload: {} }), false);
  assert.equal(validate({ ...event, unexpected: true }), false);
  assert.equal(validate({ ...event, turn_id: undefined }), false);
  assert.equal(validate({ ...event, payload: { status: "in_progress" } }), false);
  assert.equal(validate({ ...event, terminal: true }), false);
  assert.equal(
    validate({
      ...event,
      event_type: "turn.completed",
      item_id: undefined,
      terminal: true,
      payload: { status: "completed" },
    }),
    true,
    JSON.stringify(validate.errors),
  );
});
