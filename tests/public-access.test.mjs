import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const publicSpec = parseYaml(await readFile("openapi/public/public.yaml", "utf8"));
const accessFixtureRoot = "tests/fixtures/public/access";

const expectedInitialCapabilities = [
  "knowledge.read",
  "plugin.manage",
  "plugin.read",
  "schedule.read",
  "store.read",
  "task.create",
  "task.read",
  "workspace.use",
];

const expectedErrorFixtures = new Map([
  ["InvalidTenantContext", "error-invalid-tenant-context.json"],
  ["UserBearerUnauthorized", "error-unauthorized.json"],
  ["UserAccessDenied", "error-user-access-denied.json"],
  ["TenantAccessDenied", "error-tenant-access-denied.json"],
  ["AccessInternalError", "error-internal-error.json"],
  ["AuthorizationUnavailable", "error-authorization-unavailable.json"],
]);

async function readFixture(name) {
  return JSON.parse(await readFile(`${accessFixtureRoot}/${name}`, "utf8"));
}

function dereferenceSchema(value, stack = []) {
  if (Array.isArray(value)) return value.map((item) => dereferenceSchema(item, stack));
  if (value === null || typeof value !== "object") return value;

  if (typeof value.$ref === "string") {
    const prefix = "#/components/schemas/";
    assert.ok(value.$ref.startsWith(prefix), `unsupported schema reference ${value.$ref}`);
    const name = value.$ref.slice(prefix.length);
    assert.ok(!stack.includes(name), `circular schema reference ${[...stack, name].join(" -> ")}`);
    const target = publicSpec.components.schemas[name];
    assert.ok(target, `missing schema ${name}`);
    return dereferenceSchema(target, [...stack, name]);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, dereferenceSchema(item, stack)]),
  );
}

function compileSchema(name) {
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addFormat("int32", {
    type: "number",
    validate: (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647,
  });
  ajv.addFormat("int64", {
    type: "number",
    validate: Number.isSafeInteger,
  });
  ajv.addKeyword({ keyword: "x-yijie-initial-values", schemaType: "array" });
  return ajv.compile(dereferenceSchema(publicSpec.components.schemas[name], [name]));
}

function assertNoStore(response) {
  assert.equal(
    response.headers?.["Cache-Control"]?.$ref,
    "#/components/headers/NoStore",
  );
}

test("Public access operations preserve legacy anonymous operations and define exact auth boundaries", () => {
  assert.deepEqual(publicSpec.security, []);
  assert.equal(publicSpec.paths["/v1/tasks"].post.security, undefined);
  assert.equal(publicSpec.paths["/v1/tasks/{task_id}"].get.security, undefined);
  assert.ok(publicSpec.components.schemas.CreateTaskRequest.required.includes("tenant_id"));

  const listTenants = publicSpec.paths["/v1/me/tenants"].get;
  assert.equal(listTenants.operationId, "listMyTenants");
  assert.deepEqual(listTenants.security, [{ userBearer: [] }]);
  assert.equal(listTenants.parameters, undefined);
  assert.equal(listTenants.requestBody, undefined);
  assert.deepEqual(Object.keys(listTenants.responses).sort(), ["200", "401", "403", "500", "503"]);
  assert.equal(
    listTenants.responses["200"].content["application/json"].schema.$ref,
    "#/components/schemas/TenantSelectionList",
  );

  const getCapabilities = publicSpec.paths["/v1/me/capabilities"].get;
  assert.equal(getCapabilities.operationId, "getMyCapabilities");
  assert.deepEqual(getCapabilities.security, [{ userBearer: [] }]);
  assert.deepEqual(getCapabilities.parameters, [
    { $ref: "#/components/parameters/TenantIdHeader" },
  ]);
  assert.equal(getCapabilities.requestBody, undefined);
  assert.deepEqual(
    Object.keys(getCapabilities.responses).sort(),
    ["200", "400", "401", "403", "500", "503"],
  );
  assert.equal(
    getCapabilities.responses["200"].content["application/json"].schema.$ref,
    "#/components/schemas/CapabilityProjection",
  );
  assert.equal(getCapabilities.responses["409"], undefined);

  for (const response of [listTenants.responses["200"], getCapabilities.responses["200"]]) {
    assertNoStore(response);
  }

  assert.deepEqual(publicSpec.components.securitySchemes.userBearer, {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: publicSpec.components.securitySchemes.userBearer.description,
  });
  assert.match(publicSpec.components.securitySchemes.userBearer.description, /RS256/);
  assert.match(publicSpec.components.securitySchemes.userBearer.description, /https:\/\/api\.yijie\.ai/);

  assert.deepEqual(publicSpec.components.parameters.TenantIdHeader, {
    name: "X-Yijie-Tenant-ID",
    in: "header",
    required: true,
    description: publicSpec.components.parameters.TenantIdHeader.description,
    schema: { type: "string", format: "uuid" },
  });
  assert.match(publicSpec.components.parameters.TenantIdHeader.description, /untrusted/i);
});

test("Public access responses pin no-store, bearer challenge, retry, and stable error codes", async () => {
  const listTenants = publicSpec.paths["/v1/me/tenants"].get.responses;
  const getCapabilities = publicSpec.paths["/v1/me/capabilities"].get.responses;
  const expectedRefs = [
    [listTenants, "401", "UserBearerUnauthorized"],
    [listTenants, "403", "UserAccessDenied"],
    [listTenants, "500", "AccessInternalError"],
    [listTenants, "503", "AuthorizationUnavailable"],
    [getCapabilities, "400", "InvalidTenantContext"],
    [getCapabilities, "401", "UserBearerUnauthorized"],
    [getCapabilities, "403", "TenantAccessDenied"],
    [getCapabilities, "500", "AccessInternalError"],
    [getCapabilities, "503", "AuthorizationUnavailable"],
  ];

  for (const [responses, status, name] of expectedRefs) {
    assert.equal(responses[status].$ref, `#/components/responses/${name}`);
  }

  for (const [name, fixtureName] of expectedErrorFixtures) {
    const response = publicSpec.components.responses[name];
    const fixture = await readFixture(fixtureName);
    assertNoStore(response);
    assert.equal(response["x-yijie-error-code"], fixture.code);
    assert.equal(response.content["application/json"].schema.$ref, "#/components/schemas/ErrorResponse");
  }

  assert.equal(
    publicSpec.components.responses.UserBearerUnauthorized.headers["WWW-Authenticate"].$ref,
    "#/components/headers/BearerChallenge",
  );
  assert.equal(
    publicSpec.components.responses.AuthorizationUnavailable.headers["Retry-After"].$ref,
    "#/components/headers/RetryAfter",
  );
});

test("Tenant and capability fixtures validate strict boundaries and open capability values", async () => {
  const validateTenants = compileSchema("TenantSelectionList");
  const validateProjection = compileSchema("CapabilityProjection");
  const validateError = compileSchema("ErrorResponse");

  for (const name of [
    "tenant-list-v1-empty.json",
    "tenant-list-v1-single.json",
    "tenant-list-v1-multiple.json",
  ]) {
    const fixture = await readFixture(name);
    assert.equal(validateTenants(fixture), true, `${name}: ${JSON.stringify(validateTenants.errors)}`);
  }

  for (const name of [
    "capability-v1-ready.json",
    "capability-v1-empty.json",
    "capability-v1-unknown.json",
  ]) {
    const fixture = await readFixture(name);
    assert.equal(
      validateProjection(fixture),
      true,
      `${name}: ${JSON.stringify(validateProjection.errors)}`,
    );
  }

  for (const fixtureName of expectedErrorFixtures.values()) {
    const fixture = await readFixture(fixtureName);
    assert.equal(validateError(fixture), true, `${fixtureName}: ${JSON.stringify(validateError.errors)}`);
  }

  assert.deepEqual(
    publicSpec.components.schemas.CapabilityKey["x-yijie-initial-values"],
    expectedInitialCapabilities,
  );
  assert.ok((await readFixture("capability-v1-unknown.json")).capabilities.includes("analytics.read"));

  assert.equal(validateTenants({ tenants: [], extra: true }), false);
  assert.equal(validateTenants({ tenants: [{ tenant_id: "not-a-uuid", display_name: "Tenant" }] }), false);
  assert.equal(validateTenants({ tenants: [{ tenant_id: "019c0123-4567-7abc-8123-456789abcdef", display_name: "" }] }), false);

  const projection = await readFixture("capability-v1-ready.json");
  assert.equal(validateProjection({ ...projection, authorization_revision: 0 }), false);
  assert.equal(validateProjection({ ...projection, authorization_revision: 9007199254740992 }), false);
  assert.equal(validateProjection({ ...projection, capabilities: ["task.read", "task.read"] }), false);
  assert.equal(validateProjection({ ...projection, capabilities: ["invalid"] }), false);
  assert.equal(
    validateProjection({
      ...projection,
      capabilities: Array.from({ length: 257 }, (_, index) => `domain${index}.read`),
    }),
    false,
  );
});
