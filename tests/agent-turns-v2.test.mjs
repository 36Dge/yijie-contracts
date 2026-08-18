import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const spec = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));

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
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(dereferenceSchema(spec.components.schemas[name], [name]));
}

function responseFor(operation, status) {
  const response = operation.responses[status];
  if (!response.$ref) return response;
  return spec.components.responses[response.$ref.slice("#/components/responses/".length)];
}

test("Agent Host v2 turn is a closed ordered multimodal operation", async () => {
  const operation = spec.paths["/v2/agent-sessions/{agent_session_id}/turns"].post;
  assert.equal(operation.operationId, "startAgentTurnV2");
  assert.equal(
    operation.requestBody.content["application/json"].schema.$ref,
    "#/components/schemas/StartTurnV2Request",
  );
  assert.deepEqual(Object.keys(operation.responses), ["202", "400", "401", "404", "409", "500", "502"]);
  for (const status of Object.keys(operation.responses)) {
    assert.equal(
      responseFor(operation, status).headers["Cache-Control"].$ref,
      "#/components/headers/NoStore",
      status,
    );
  }

  const requestSchema = spec.components.schemas.StartTurnV2Request;
  assert.deepEqual(requestSchema.required, ["operation_id", "content_blocks"]);
  assert.equal(requestSchema.additionalProperties, false);
  assert.equal(requestSchema.properties.operation_id.format, "uuid");
  assert.equal(requestSchema.properties.content_blocks.minItems, 1);
  assert.equal(requestSchema.properties.content_blocks.maxItems, 16);
  for (const field of ["trace_id", "request_id", "tenant_id", "user_id", "reasoning_effort"]) {
    assert.ok(requestSchema.properties[field], field);
  }
  assert.match(requestSchema.properties.content_blocks.description, /ordered Runtime input/i);
  assert.match(requestSchema.properties.content_blocks.description, /10 image\/file blocks/);
  assert.match(requestSchema.properties.content_blocks.description, /10 MiB/);
  assert.match(requestSchema.properties.content_blocks.description, /256 KiB/);

  const union = spec.components.schemas.StartTurnV2ContentBlock;
  assert.equal(union.discriminator.propertyName, "type");
  assert.deepEqual(Object.keys(union.discriminator.mapping), ["text", "image", "file"]);

  const validate = compileSchema("StartTurnV2Request");
  const fixture = JSON.parse(
    await readFile("tests/fixtures/agent/host-v2/turn-request.json", "utf8"),
  );
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(
    fixture.content_blocks.map(({ type }) => type),
    ["text", "file", "image"],
  );

  const text = fixture.content_blocks[0];
  const file = fixture.content_blocks[1];
  const image = fixture.content_blocks[2];
  const [imageHeader, imageBase64] = image.data_url.split(",", 2);
  const imageBytes = Buffer.from(imageBase64, "base64");
  assert.equal(imageHeader, `data:${image.media_type};base64`);
  assert.equal(imageBytes.byteLength, image.size_bytes);
  assert.equal(createHash("sha256").update(imageBytes).digest("hex"), image.sha256);
  const syntheticFileBytes = Buffer.from("quarter,total\nQ1,42\n");
  assert.equal(syntheticFileBytes.byteLength, file.size_bytes);
  assert.equal(createHash("sha256").update(syntheticFileBytes).digest("hex"), file.sha256);
  const invalidRequests = [
    Object.fromEntries(Object.entries(fixture).filter(([key]) => key !== "operation_id")),
    { ...fixture, operation_id: "not-a-uuid" },
    { ...fixture, content_blocks: [] },
    { ...fixture, content_blocks: Array.from({ length: 17 }, () => text) },
    { ...fixture, unexpected: true },
    { ...fixture, content_blocks: [{ ...text, unexpected: true }] },
    { ...fixture, content_blocks: [{ type: "audio", text: "unsupported" }] },
    { ...fixture, content_blocks: [{ ...text, text: " \n\t " }] },
    { ...fixture, content_blocks: [{ ...image, size_bytes: 10485761 }] },
    { ...fixture, content_blocks: [{ ...image, sha256: image.sha256.toUpperCase() }] },
    { ...fixture, content_blocks: [{ ...image, data_url: "data:text/plain;base64,aGVsbG8=" }] },
    { ...fixture, content_blocks: [{ ...file, name: "../quarterly-total.csv" }] },
    { ...fixture, content_blocks: [{ ...file, media_type: "application/zip" }] },
    { ...fixture, content_blocks: [{ ...file, context_chunks: [] }] },
    { ...fixture, content_blocks: [{ ...file, context_chunks: ["x".repeat(16385)] }] },
  ];
  for (const request of invalidRequests) {
    assert.equal(validate(request), false, JSON.stringify(request));
  }

  assert.match(spec.components.schemas.StartTurnV2ImageBlock.properties.data_url.description, /header must equal/);
  assert.match(spec.components.schemas.StartTurnV2ImageBlock.properties.data_url.description, /SHA-256/);
  assert.match(operation.description, /does\s+not persist the data URL or context chunks/);
  assert.match(operation.description, /raw file\s+bytes and local paths are never accepted/);
  assert.match(operation.description, /returns the original accepted `turn_id`/);
  assert.match(operation.responses["409"].description, /turn_operation_conflict/);
});

test("Agent Host v1 turn and generated Go enum names remain unchanged by v2", async () => {
  const operation = spec.paths["/v1/agent-sessions/{agent_session_id}/turns"].post;
  assert.equal(operation.operationId, "startAgentTurn");
  assert.equal(
    operation.requestBody.content["application/json"].schema.$ref,
    "#/components/schemas/StartTurnRequest",
  );
  assert.deepEqual(spec.components.schemas.StartTurnRequest.required, ["input"]);
  assert.equal(spec.components.schemas.StartTurnRequest.properties.content_blocks, undefined);

  const goSdk = await readFile("sdks/go/openapi/agent-host/client.gen.go", "utf8");
  assert.match(goSdk, /\bEmpty StartTurnRequestReasoningEffort = ""/);
  assert.match(goSdk, /\bHigh\s+StartTurnRequestReasoningEffort = "high"/);
  assert.match(goSdk, /\bNone\s+StartTurnRequestReasoningEffort = "none"/);
  assert.doesNotMatch(goSdk, /StartTurnRequestReasoningEffortEmpty/);
});
