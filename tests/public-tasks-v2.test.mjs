import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const spec = parseYaml(await readFile("openapi/public/public.yaml", "utf8"));
const fixtureRoot = "tests/fixtures/public/tasks-v2";

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

function assertNoStore(response) {
  assert.equal(response.headers?.["Cache-Control"]?.$ref, "#/components/headers/NoStore");
}

const forbiddenConversationKeys = [
  "prompt",
  "message",
  "text",
  "raw_reasoning",
  "reasoning",
  "title",
  "project_path",
  "cwd",
  "path",
  "result",
  "error_message",
];

function assertNoForbiddenConversationKeys(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenConversationKeys(item, `${location}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.equal(
      forbiddenConversationKeys.includes(key),
      false,
      `${location} contains forbidden conversation key ${key}`,
    );
    assertNoForbiddenConversationKeys(item, `${location}.${key}`);
  }
}

test("Public Tasks v2 is authenticated, tenant-scoped, creator-private, and idempotent", () => {
  const create = spec.paths["/v2/tasks"].post;
  const get = spec.paths["/v2/tasks/{task_id}"].get;

  assert.equal(create.operationId, "createTaskV2");
  assert.equal(get.operationId, "getTaskV2");
  assert.equal(create["x-yijie-required-capability"], "task.create");
  assert.equal(get["x-yijie-required-capability"], "task.read");
  assert.deepEqual(create.security, [{ userBearer: [] }]);
  assert.deepEqual(get.security, [{ userBearer: [] }]);
  assert.deepEqual(create.parameters, [
    { $ref: "#/components/parameters/TenantIdHeader" },
    { $ref: "#/components/parameters/IdempotencyKeyHeader" },
  ]);
  assert.deepEqual(get.parameters, [{ $ref: "#/components/parameters/TenantIdHeader" }]);
  assert.equal(spec.components.parameters.IdempotencyKeyHeader.required, true);
  assert.deepEqual(spec.components.parameters.IdempotencyKeyHeader.schema, {
    type: "string",
    format: "uuid",
  });

  const request = spec.components.schemas.CreateTaskV2Request;
  assert.deepEqual(request.required, ["task_type", "input"]);
  assert.equal(request.additionalProperties, false);
  assert.equal(request.properties.tenant_id, undefined);
  assert.equal(request.properties.created_by_user_id, undefined);
  assert.equal(request.properties.title, undefined);
  assert.deepEqual(request.properties.task_type.enum, ["conversation"]);
  assert.deepEqual(request.properties.input, {
    $ref: "#/components/schemas/TaskContentReferenceV2",
  });

  const contentReference = spec.components.schemas.TaskContentReferenceV2;
  assert.equal(contentReference.additionalProperties, false);
  assert.deepEqual(contentReference.required, [
    "schema_version",
    "content_mode",
    "client_reference_id",
  ]);
  assert.deepEqual(contentReference.properties.schema_version.enum, [1]);
  assert.deepEqual(contentReference.properties.content_mode.enum, ["local_only"]);
  assert.equal(contentReference.properties.client_reference_id.format, "uuid");
  assert.match(contentReference.description, /must not be derived/);

  const task = spec.components.schemas.TaskV2;
  assert.ok(task.required.includes("tenant_id"));
  assert.ok(task.required.includes("created_by_user_id"));
  assert.equal(task.properties.title, undefined);
  assert.equal(task.properties.result, undefined);
  assert.equal(task.properties.error_message, undefined);
  assert.deepEqual(task.properties.task_type.enum, ["conversation"]);
  assert.deepEqual(task.properties.input, {
    $ref: "#/components/schemas/TaskContentReferenceV2",
  });
  assert.match(task.properties.created_by_user_id.description, /Server-derived/);
  assert.match(get.description, /task\.read_all/);
  assert.match(get.description, /Roles alone do not grant cross-creator access/);
  assert.match(create.description, /control-plane operation accepts metadata only/);
  assert.match(get.description, /response is metadata-only/);
});

test("Public Tasks v2 pins no-store and stable errors without changing anonymous v1", () => {
  const create = spec.paths["/v2/tasks"].post;
  const get = spec.paths["/v2/tasks/{task_id}"].get;

  assert.equal(spec.paths["/v1/tasks"].post.security, undefined);
  assert.equal(spec.paths["/v1/tasks/{task_id}"].get.security, undefined);
  assert.ok(spec.components.schemas.CreateTaskRequest.required.includes("tenant_id"));

  for (const responses of [create.responses, get.responses]) {
    for (const response of Object.values(responses)) {
      const resolved = response.$ref
        ? spec.components.responses[response.$ref.slice("#/components/responses/".length)]
        : response;
      assertNoStore(resolved);
    }
  }

  assert.deepEqual(spec.components.responses.TaskV2BadRequest["x-yijie-error-codes"], [
    "invalid_request",
    "invalid_tenant_context",
  ]);
  assert.equal(
    spec.components.responses.TaskV2Unauthenticated["x-yijie-error-code"],
    "unauthenticated",
  );
  assert.equal(spec.components.responses.TaskV2AccessDenied["x-yijie-error-code"], "access_denied");
  assert.equal(spec.components.responses.TaskV2NotFound["x-yijie-error-code"], "task_not_found");
  assert.equal(
    spec.components.responses.TaskV2IdempotencyConflict["x-yijie-error-code"],
    "idempotency_conflict",
  );
  assert.equal(
    spec.components.responses.TaskV2AuthorizationUnavailable["x-yijie-error-code"],
    "authorization_unavailable",
  );
  assert.deepEqual(spec.components.schemas.TaskV2ErrorResponse.required, ["code"]);
  assert.equal(spec.components.schemas.TaskV2ErrorResponse.additionalProperties, false);
  assert.equal(spec.components.schemas.TaskV2ErrorResponse.properties.message, undefined);
  assert.deepEqual(spec.components.schemas.ErrorResponse.required, ["code", "message"]);
});

test("Public Tasks v2 canonical fixtures are content-free and reject conversation data", async () => {
  const validateRequest = compileSchema("CreateTaskV2Request");
  const validateTask = compileSchema("TaskV2");
  const validateError = compileSchema("TaskV2ErrorResponse");

  const request = await readFixture("create-request.json");
  const task = await readFixture("task-response.json");
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateTask(task), true, JSON.stringify(validateTask.errors));
  const accessDenied = await readFixture("error-access-denied.json");
  const taskNotFound = await readFixture("error-task-not-found.json");
  assert.equal(validateError(accessDenied), true);
  assert.equal(validateError(taskNotFound), true);
  assertNoForbiddenConversationKeys(accessDenied, "access-denied fixture");
  assertNoForbiddenConversationKeys(taskNotFound, "task-not-found fixture");
  assertNoForbiddenConversationKeys(request, "create-request fixture");
  assertNoForbiddenConversationKeys(task, "task-response fixture");

  assert.equal(validateRequest({ ...request, tenant_id: task.tenant_id }), false);
  assert.equal(validateRequest({ ...request, created_by_user_id: task.created_by_user_id }), false);
  assert.equal(validateRequest({ ...request, title: "derived title" }), false);
  for (const key of forbiddenConversationKeys) {
    assert.equal(
      validateRequest({ ...request, input: { ...request.input, [key]: "canary-secret" } }),
      false,
      `request input must reject ${key}`,
    );
  }
  assert.equal(validateRequest({ ...request, input: { ...request.input, tenant_id: task.tenant_id } }), false);
  assert.equal(
    validateRequest({ ...request, input: { ...request.input, created_by_user_id: task.created_by_user_id } }),
    false,
  );
  assert.equal(validateRequest({ ...request, input: { ...request.input, schema_version: 2 } }), false);
  assert.equal(validateRequest({ ...request, input: { ...request.input, content_mode: "cloud" } }), false);
  assert.equal(validateRequest({ ...request, input: { ...request.input, client_reference_id: "not-a-uuid" } }), false);
  assert.equal(validateRequest({ ...request, input: {} }), false);
  assert.equal(validateRequest({ ...request, task_type: "canary-secret" }), false);
  assert.equal(validateTask({ ...task, created_by_user_id: undefined }), false);
  assert.equal(validateTask({ ...task, title: "derived title" }), false);
  assert.equal(validateTask({ ...task, result: { text: "canary-secret" } }), false);
  assert.equal(validateTask({ ...task, error_message: "canary-secret" }), false);
  assert.equal(validateTask({ ...task, unexpected: true }), false);
  assert.equal(validateError({ code: "access_denied", message: "canary-secret" }), false);
});
