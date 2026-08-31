import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const checker = path.resolve("scripts/check-jsonschema-breaking.mjs");

async function createFixture(t, schema) {
  const directory = await mkdtemp(path.join(tmpdir(), "yijie-jsonschema-breaking-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "scripts"), { recursive: true });
  await mkdir(path.join(directory, "jsonschema"), { recursive: true });
  await copyFile(checker, path.join(directory, "scripts/check-jsonschema-breaking.mjs"));
  await writeFile(
    path.join(directory, "jsonschema/example.schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
  await exec("git", ["init", "--initial-branch=main"], { cwd: directory });
  await exec("git", ["config", "user.email", "contracts-test@example.invalid"], {
    cwd: directory,
  });
  await exec("git", ["config", "user.name", "Contracts Test"], { cwd: directory });
  await exec("git", ["add", "."], { cwd: directory });
  await exec("git", ["commit", "-m", "baseline"], { cwd: directory });
  return directory;
}

async function replaceSchema(directory, schema) {
  await writeFile(
    path.join(directory, "jsonschema/example.schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
}

async function check(directory) {
  return exec(process.execPath, ["scripts/check-jsonschema-breaking.mjs", "main"], {
    cwd: directory,
  });
}

function baselineSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://contracts.yijie.ai/example.schema.json",
    type: "object",
    properties: {
      id: { type: "string" },
      state: { type: "string", enum: ["draft", "running"] },
      values: { type: "array" },
      frozen_tuple: { const: ["alpha", "beta"] },
    },
  };
}

test("JSON Schema checker accepts additive and loosening changes", async (t) => {
  const baseline = baselineSchema();
  const directory = await createFixture(t, baseline);
  await replaceSchema(directory, {
    ...baseline,
    properties: {
      ...baseline.properties,
      id: { type: ["string", "null"] },
      optional_note: { type: "string" },
    },
  });
  const { stdout } = await check(directory);
  assert.match(stdout, /No breaking JSON Schema changes/);
});

test("JSON Schema checker rejects common object and scalar tightening", async (t) => {
  const baseline = baselineSchema();
  const directory = await createFixture(t, baseline);
  await replaceSchema(directory, {
    ...baseline,
    additionalProperties: { type: "string" },
    required: ["id"],
    properties: {
      ...baseline.properties,
      id: { type: "string", minLength: 1 },
      state: { type: "string", enum: ["running"] },
    },
  });
  await assert.rejects(check(directory), (error) => {
    assert.match(error.stderr, /new required property: id/);
    assert.match(error.stderr, /minLength became more restrictive/);
    assert.match(error.stderr, /enum value removed: "draft"/);
    assert.match(error.stderr, /additional properties are now schema-constrained/);
    return true;
  });
});

test("JSON Schema checker rejects reference, array, and dependency restrictions", async (t) => {
  const baseline = {
    ...baselineSchema(),
    properties: {
      record: { $ref: "#/$defs/Legacy" },
      values: { type: "array" },
    },
    $defs: {
      Legacy: { type: "object" },
      Replacement: { type: "object" },
    },
  };
  const directory = await createFixture(t, baseline);
  await replaceSchema(directory, {
    ...baseline,
    properties: {
      ...baseline.properties,
      record: { $ref: "#/$defs/Replacement" },
      values: { type: "array", items: { type: "string" } },
    },
    dependentRequired: { record: ["values"] },
  });
  await assert.rejects(check(directory), (error) => {
    assert.match(error.stderr, /\$ref changed/);
    assert.match(error.stderr, /items restriction was added/);
    assert.match(error.stderr, /dependentRequired\.record: new required property: values/);
    return true;
  });
});

test("JSON Schema checker rejects a removed schema file", async (t) => {
  const directory = await createFixture(t, baselineSchema());
  await rm(path.join(directory, "jsonschema/example.schema.json"));
  await assert.rejects(check(directory), (error) => {
    assert.match(error.stderr, /schema file was removed/);
    return true;
  });
});
