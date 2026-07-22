import assert from "node:assert/strict";
import test from "node:test";
import { compareAsyncApi } from "../scripts/asyncapi-compatibility.mjs";

function baseline() {
  return {
    asyncapi: "3.0.0",
    channels: {
      taskEvents: {
        address: "task.events",
        messages: {
          taskEvent: { $ref: "#/components/messages/TaskEvent" },
        },
      },
    },
    operations: {
      receiveTaskEvents: {
        action: "receive",
        channel: { $ref: "#/channels/taskEvents" },
        messages: [{ $ref: "#/channels/taskEvents/messages/taskEvent" }],
      },
    },
    components: {
      messages: {
        TaskEvent: {
          name: "TaskEvent",
          contentType: "application/json",
          payload: {
            type: "object",
            required: ["task_id"],
            properties: {
              task_id: { type: "string" },
              status: { type: "string", enum: ["draft", "running"] },
            },
          },
        },
      },
    },
  };
}

test("a missing AsyncAPI baseline and additive changes are compatible", () => {
  const current = baseline();
  assert.deepEqual(compareAsyncApi(null, current), []);

  current.channels.auditEvents = {
    address: "audit.events",
    messages: { auditEvent: { $ref: "#/components/messages/AuditEvent" } },
  };
  current.operations.receiveAuditEvents = {
    action: "receive",
    channel: { $ref: "#/channels/auditEvents" },
  };
  current.components.messages.AuditEvent = {
    name: "AuditEvent",
    payload: { type: "object" },
  };
  current.components.messages.TaskEvent.payload.properties.trace_id = { type: "string" };
  current.components.messages.TaskEvent.payload.properties.status.enum.push("completed");

  assert.deepEqual(compareAsyncApi(baseline(), current), []);
});

test("removed channels, operations, and messages are breaking", () => {
  const current = baseline();
  delete current.channels.taskEvents;
  delete current.operations.receiveTaskEvents;
  delete current.components.messages.TaskEvent;

  const errors = compareAsyncApi(baseline(), current);
  assert.ok(errors.some((error) => error.includes("channels.taskEvents: channel was removed")));
  assert.ok(
    errors.some((error) =>
      error.includes("operations.receiveTaskEvents: operation was removed"),
    ),
  );
  assert.ok(
    errors.some((error) =>
      error.includes("components.messages.TaskEvent: message was removed"),
    ),
  );

  const channelMessageRemoved = baseline();
  delete channelMessageRemoved.channels.taskEvents.messages.taskEvent;
  assert.ok(
    compareAsyncApi(baseline(), channelMessageRemoved).some((error) =>
      error.includes("channels.taskEvents.messages.taskEvent: message was removed"),
    ),
  );
});

test("channel and operation routing changes are breaking", () => {
  const current = baseline();
  current.channels.taskEvents.address = "task.events.v2";
  current.channels.taskEvents.messages.taskEvent.$ref = "#/components/messages/TaskEventV2";
  current.operations.receiveTaskEvents.action = "send";
  current.operations.receiveTaskEvents.channel.$ref = "#/channels/taskEventsV2";
  current.operations.receiveTaskEvents.messages = [];

  const errors = compareAsyncApi(baseline(), current).join("\n");
  assert.match(errors, /address changed/);
  assert.match(errors, /reference changed/);
  assert.match(errors, /action changed/);
  assert.match(errors, /message removed/);
});

test("required, enum, type, and object-policy tightening is breaking", () => {
  const current = baseline();
  const payload = current.components.messages.TaskEvent.payload;
  payload.required.push("status");
  payload.properties.status.enum = ["running"];
  payload.properties.task_id.type = "integer";
  payload.additionalProperties = false;

  const errors = compareAsyncApi(baseline(), current).join("\n");
  assert.match(errors, /new required property: status/);
  assert.match(errors, /enum value removed: "draft"/);
  assert.match(errors, /allowed types narrowed from "string" to "integer"/);
  assert.match(errors, /additional properties are no longer accepted/);
});
