import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const spec = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));
const fixtureRoot = "tests/fixtures/agent/host-v2";

function dereferenceSchema(value, stack = []) {
  if (Array.isArray(value)) return value.map((item) => dereferenceSchema(item, stack));
  if (value === null || typeof value !== "object") return value;
  if (typeof value.$ref === "string") {
    const prefix = "#/components/schemas/";
    assert.ok(value.$ref.startsWith(prefix), `unsupported schema reference ${value.$ref}`);
    const name = value.$ref.slice(prefix.length);
    assert.ok(!stack.includes(name), `circular schema reference ${[...stack, name].join(" -> ")}`);
    return dereferenceSchema(spec.components.schemas[name], [...stack, name]);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, dereferenceSchema(item, stack)]),
  );
}

function compileSchema(name) {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  return ajv.compile(dereferenceSchema(spec.components.schemas[name], [name]));
}

async function readFixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

function responseFor(operation, status) {
  const response = operation.responses[status];
  if (!response.$ref) return response;
  return spec.components.responses[response.$ref.slice("#/components/responses/".length)];
}

function assertNoStore(operation) {
  for (const status of Object.keys(operation.responses)) {
    assert.equal(
      responseFor(operation, status).headers?.["Cache-Control"]?.$ref,
      "#/components/headers/NoStore",
      `${operation.operationId} ${status}`,
    );
  }
}

test("Agent Host v2 title generation is isolated, strict, bounded, and idempotent", async () => {
  const operation = spec.paths["/v2/agent-sessions/{agent_session_id}/title-generations"].post;
  assert.equal(operation.operationId, "generateAgentSessionTitleV2");
  assert.match(operation.description, /pathless ephemeral Runtime thread/);
  assert.match(operation.description, /invokes no tools/);
  assert.match(operation.description, /does not enable the operation or authorize provider calls/);
  assertNoStore(operation);

  const requestSchema = spec.components.schemas.GenerateTitleV2Request;
  assert.deepEqual(requestSchema.required, ["operation_id", "input"]);
  assert.equal(requestSchema.additionalProperties, false);
  assert.equal(requestSchema.properties.input["x-yijie-max-utf8-bytes"], 8192);
  assert.equal(spec.components.schemas.GenerateTitleV2Response.properties.title["x-yijie-max-graphemes"], 40);

  const validateRequest = compileSchema("GenerateTitleV2Request");
  const validateResponse = compileSchema("GenerateTitleV2Response");
  const request = await readFixture("title-request.json");
  const response = await readFixture("title-response.json");
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateResponse(response), true, JSON.stringify(validateResponse.errors));
  assert.equal(validateRequest({ ...request, project_path: "/private/project" }), false);
  assert.equal(validateResponse({ ...response, ephemeral_thread_id: "secret" }), false);

  assert.match(responseFor(operation, "409").description, /title_operation_conflict/);
  assert.match(responseFor(operation, "422").description, /title_output_invalid/);
  assert.match(responseFor(operation, "503").description, /title_generation_unavailable/);
});

test("Agent Host v2 cleanup cannot claim complete for a partial live-surface result", async () => {
  const operation = spec.paths["/v2/agent-sessions/{agent_session_id}/cleanup-operations"].post;
  assert.equal(operation.operationId, "cleanupAgentSessionV2");
  assert.match(operation.description, /Desktop deletion saga/);
  assert.match(operation.description, /does not claim that Desktop/);
  assert.match(operation.description, /content-free receipt/);
  assert.match(operation.description, /keyed session hash/);
  assert.equal(operation.responses["500"], undefined);
  assertNoStore(operation);

  const validateRequest = compileSchema("CleanupAgentSessionV2Request");
  const validateComplete = compileSchema("CleanupAgentSessionV2CompletedResponse");
  const validateIncomplete = compileSchema("CleanupAgentSessionV2IncompleteResponse");
  const request = await readFixture("cleanup-request.json");
  const complete = await readFixture("cleanup-completed.json");
  const incomplete = await readFixture("cleanup-incomplete.json");
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateComplete(complete), true, JSON.stringify(validateComplete.errors));
  assert.equal(validateIncomplete(incomplete), true, JSON.stringify(validateIncomplete.errors));
  assert.equal(validateComplete(incomplete), false);
  assert.equal(
    validateComplete({
      ...complete,
      surfaces: { ...complete.surfaces, host_replay: "incomplete" },
    }),
    false,
  );
  assert.equal(validateRequest({ ...request, codex_thread_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f62" }), false);
  assert.deepEqual(responseFor(operation, "409")["x-yijie-error-codes"], [
    "cleanup_incomplete",
    "cleanup_operation_conflict",
  ]);
});

test("Agent Host v1 paths and event authority remain unchanged by v2 operations", () => {
  assert.equal(spec.paths["/v1/tasks/{task_id}/agent-sessions"].post.operationId, "startAgentSession");
  assert.equal(spec.paths["/v1/agent-sessions/{agent_session_id}/turns"].post.operationId, "startAgentTurn");
  assert.equal(
    spec.paths["/v1/agent-sessions/{agent_session_id}/events"].get.responses["200"].content[
      "text/event-stream"
    ].schema["x-yijie-event-data-schema"],
    "../../jsonschema/agent/session-event.schema.json",
  );
  const legacyCodes = spec.components.schemas.ErrorResponse.properties.error.properties.code.enum;
  for (const v2Code of [
    "title_operation_conflict",
    "title_generation_unavailable",
    "title_output_invalid",
    "cleanup_operation_conflict",
    "cleanup_incomplete",
  ]) {
    assert.equal(legacyCodes.includes(v2Code), false, v2Code);
    const v2SchemaOwnsCode = Object.values(spec.components.schemas).some((schema) =>
      (schema?.properties?.error?.properties?.code?.enum ?? schema?.properties?.code?.enum ?? []).includes(
        v2Code,
      ),
    );
    assert.equal(
      v2SchemaOwnsCode,
      true,
      `v2 schema owns ${v2Code}`,
    );
  }
});
