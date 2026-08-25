import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const spec = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));

function responseFor(operation, status) {
  const response = operation.responses[status];
  if (!response?.$ref) return response;
  const prefix = "#/components/responses/";
  assert.ok(response.$ref.startsWith(prefix));
  return spec.components.responses[response.$ref.slice(prefix.length)];
}

function requestSchema(operation) {
  const reference = operation.requestBody.content["application/json"].schema.$ref;
  const prefix = "#/components/schemas/";
  assert.ok(reference.startsWith(prefix));
  return spec.components.schemas[reference.slice(prefix.length)];
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
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addFormat("int32", {
    type: "number",
    validate: (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647,
  });
  return ajv.compile(dereferenceSchema(spec.components.schemas[name], [name]));
}

test("Agent Host Skill operations are owner-only, capability-scoped, pathless, and idempotent", () => {
  const operations = {
    list: spec.paths["/v1/skills"].get,
    scan: spec.paths["/v1/skills/scan-operations"].post,
    install: spec.paths["/v1/skills/{skill_id}/install-operations"].post,
    enabled: spec.paths["/v1/skills/{skill_id}/enabled"].put,
    uninstall: spec.paths["/v1/skills/{skill_id}/uninstall-operations"].post,
  };

  assert.deepEqual(
    Object.fromEntries(Object.entries(operations).map(([name, operation]) => [name, operation.operationId])),
    {
      list: "listManagedSkills",
      scan: "scanManagedSkills",
      install: "installManagedSkill",
      enabled: "setManagedSkillEnabled",
      uninstall: "uninstallManagedSkill",
    },
  );
  assert.equal(operations.list["x-yijie-required-capability"], "plugin.read");
  for (const operation of [operations.scan, operations.install, operations.enabled, operations.uninstall]) {
    assert.equal(operation["x-yijie-required-capability"], "plugin.manage");
    assert.match(operation.description, /operation_id|idempotent/i);
  }
  for (const operation of Object.values(operations)) assertNoStore(operation);

  assert.deepEqual(requestSchema(operations.scan).required, ["operation_id", "reason"]);
  assert.deepEqual(requestSchema(operations.install).required, [
    "operation_id",
    "expected_version",
    "expected_archive_sha256",
    "catalog_revision",
  ]);
  assert.deepEqual(requestSchema(operations.enabled).required, ["operation_id", "enabled"]);
  assert.deepEqual(requestSchema(operations.uninstall).required, ["operation_id"]);
  for (const operation of [operations.scan, operations.install, operations.enabled, operations.uninstall]) {
    const serialized = JSON.stringify(requestSchema(operation));
    assert.doesNotMatch(serialized, /(?:archive_|destination_|source_)?path/i);
    assert.doesNotMatch(serialized, /skill_content|instructions|token/i);
  }

  assert.match(operations.install.description, /same-volume staging/);
  assert.match(operations.install.description, /atomic rename/);
  assert.match(operations.install.description, /redistribution/);
  assert.match(operations.install.description, /catalog-only[\s\S]*skill_not_installable/);
  assert.match(operations.enabled.description, /skills\/config\/write/);
  assert.match(operations.uninstall.description, /never deletes[\s\S]*bundled read-only archive/);
});

test("Agent Host Skill responses keep state bounded and failures content-free", () => {
  const list = spec.paths["/v1/skills"].get;
  const install = spec.paths["/v1/skills/{skill_id}/install-operations"].post;
  assert.equal(
    list.responses["200"].content["application/json"].schema.$ref,
    "#/components/schemas/SkillListResponse",
  );
  assert.deepEqual(Object.keys(install.responses), ["200", "400", "401", "403", "404", "409", "422", "500", "503"]);
  assert.deepEqual(responseFor(install, "422")["x-yijie-error-codes"], [
    "skill_not_installable",
    "bundle_missing",
    "bundle_manifest_invalid",
    "archive_checksum_mismatch",
    "archive_unsafe",
    "archive_too_large",
  ]);

  const managedSkill = spec.components.schemas.ManagedSkill;
  assert.equal(managedSkill.additionalProperties, false);
  assert.deepEqual(managedSkill.properties.installation_status.enum, [
    "not_installed",
    "installing",
    "installed",
    "uninstalling",
    "error",
  ]);
  assert.equal(managedSkill.properties.runtime_visible.type, "boolean");
  assert.deepEqual(managedSkill.properties.catalog_blocked_reason.enum, [
    "source_unverified",
    "license_unverified",
    "distribution_not_authorized",
    "security_review_pending",
    "capability_unavailable",
    "maintenance_ended",
  ]);
  assert.ok(!managedSkill.required.includes("catalog_blocked_reason"));
  assert.doesNotMatch(JSON.stringify(managedSkill), /path|content|token/i);

  const error = spec.components.schemas.SkillErrorResponse;
  assert.equal(error.additionalProperties, false);
  assert.match(error.description, /never contains a path, token, archive bytes, Skill instructions, or Runtime payload/);
  assert.ok(error.properties.error.properties.code.enum.includes("capability_denied"));
  assert.ok(error.properties.error.properties.code.enum.includes("archive_unsafe"));
  assert.ok(error.properties.error.properties.code.enum.includes("runtime_sync_failed"));
});

test("Agent Host Skill canonical request, response, and failure fixtures validate", async () => {
  const fixtureRoot = "tests/fixtures/agent/host-skills-v1";
  const cases = [
    ["SkillScanRequest", "scan-request.json"],
    ["SkillInstallRequest", "install-request.json"],
    ["SkillEnabledRequest", "enabled-request.json"],
    ["SkillUninstallRequest", "uninstall-request.json"],
    ["SkillListResponse", "list-response.json"],
    ["SkillMutationResponse", "mutation-response.json"],
    ["SkillErrorResponse", "error-archive-unsafe.json"],
    ["SkillErrorResponse", "error-skill-not-installable.json"],
  ];
  for (const [schemaName, fixtureName] of cases) {
    const validate = compileSchema(schemaName);
    const fixture = JSON.parse(await readFile(`${fixtureRoot}/${fixtureName}`, "utf8"));
    assert.equal(validate(fixture), true, `${fixtureName}: ${JSON.stringify(validate.errors)}`);
  }

  const install = JSON.parse(await readFile(`${fixtureRoot}/install-request.json`, "utf8"));
  const validateInstall = compileSchema("SkillInstallRequest");
  assert.equal(validateInstall({ ...install, archive_path: "/tmp/skill.zip" }), false);
  assert.equal(validateInstall({ ...install, operation_id: "not-a-uuid" }), false);
});

test("Agent Host list fixture is the exact 38-Skill catalog projection", async () => {
  const manifestBytes = await readFile(
    "tests/fixtures/skills/bundle-v2/manifest-catalog-38.json",
  );
  const manifest = JSON.parse(manifestBytes);
  const list = JSON.parse(
    await readFile("tests/fixtures/agent/host-skills-v1/list-response.json", "utf8"),
  );
  const install = JSON.parse(
    await readFile("tests/fixtures/agent/host-skills-v1/install-request.json", "utf8"),
  );
  assert.equal(list.skills.length, 38);
  assert.equal(
    list.catalog_revision,
    createHash("sha256").update(manifestBytes).digest("hex"),
  );
  assert.deepEqual(
    list.skills.map(({ id, runtime_name, version, catalog_status }) => ({
      id,
      runtime_name,
      version,
      catalog_status,
    })),
    manifest.skills.map(({ id, runtime_name, version, release }) => ({
      id,
      runtime_name,
      version,
      catalog_status: release.catalog_status,
    })),
  );

  for (const [index, skill] of list.skills.entries()) {
    const source = manifest.skills[index];
    if (source.release.catalog_status === "blocked") {
      assert.equal(skill.catalog_blocked_reason, source.release.blocked_reason, source.id);
      assert.equal(skill.installation_status, "not_installed", source.id);
      assert.equal(skill.enabled, false, source.id);
      assert.equal(skill.runtime_visible, false, source.id);
    } else {
      assert.equal(skill.catalog_blocked_reason, undefined, source.id);
    }
  }

  const copywriting = manifest.skills.find(
    ({ id }) => id === "yijie.content-marketing.copywriting",
  );
  assert.equal(install.expected_version, copywriting.version);
  assert.equal(install.expected_archive_sha256, copywriting.archive.sha256);
  assert.equal(install.catalog_revision, list.catalog_revision);

  const blockedError = JSON.parse(
    await readFile(
      "tests/fixtures/agent/host-skills-v1/error-skill-not-installable.json",
      "utf8",
    ),
  );
  assert.equal(blockedError.error.code, "skill_not_installable");
  assert.ok(responseFor(spec.paths["/v1/skills/{skill_id}/install-operations"].post, "422")[
    "x-yijie-error-codes"
  ].includes(blockedError.error.code));
});
