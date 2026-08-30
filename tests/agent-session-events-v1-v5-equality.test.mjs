import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse as parseYaml } from "yaml";

const sourceDigests = {
  "jsonschema/agent/session-event.schema.json": "0a618857278185d9907138fac803f8382f3a308cf23e1de26345455d97ea3740",
  "jsonschema/agent/session-event-v2.schema.json": "b7a6494f58e274964ef5520c790f3891836c2f2cf69391ce67e5cfa00211f424",
  "jsonschema/agent/session-event-v3.schema.json": "87b1284056529bde8314e6cfa6ad1fb27ffefef50ea86033875fda795330939f",
  "jsonschema/agent/session-event-v4.schema.json": "d972806e59195c5e1f5fe810db6e1df80be349b77ecc4cf192ed0f391d9ed739",
  "jsonschema/agent/session-event-v5.schema.json": "2f773dd6dc60bc7dc01bcdb434447e945e0a98317534498f54325fcdabb27008",
  "protobuf/yijie/events/v1/agent_session.proto": "671a799cd013ff97c3d30e0edc6a33a76f5fbbe1419065c63da0029b2c59cbdf",
  "protobuf/yijie/events/v2/agent_session.proto": "a18c08df2e2805147768e9e1b7eed4f97e4b7d0aebde5b59170c7ff248f1f383",
  "protobuf/yijie/events/v3/agent_session.proto": "5021a0342b84cdea0e1dd773728e4c8f013ce7d03377ade18f06f6716a81b70d",
  "protobuf/yijie/events/v4/agent_session.proto": "7130ffad6f7d415bbaaf35a10bc380b2b75ecaaa4762dc871ce0a274472ecdea",
  "protobuf/yijie/events/v5/agent_session.proto": "9d4c0e8ed9d39d7eee0f255401e1a7b40b62ad4ed221f2e0d6b6e514859bc65b",
  "compatibility/agent-host-runtime-v1.json": "6cef3f4ac60ec91b9f7f05b188dc677169fc11e0bedf34350f6342a6f50981bb",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function goInterfaceMethods(source, name) {
  const declaration = `type ${name} interface {`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = start + declaration.length;
  const end = source.indexOf("\n}\n", bodyStart);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return source
    .slice(bodyStart, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]/.test(line) && line.includes("("));
}

test("FEAT-137 v6 leaves v1-v5 JSON, Proto, and Runtime compatibility sources byte-identical", async () => {
  for (const [file, expected] of Object.entries(sourceDigests)) {
    assert.equal(sha256(await readFile(file)), expected, file);
  }
});

test("FEAT-137 v6 preserves the published Agent Host Go v2 enum symbol", async () => {
  const generated = await readFile("sdks/go/openapi/agent-host/client.gen.go", "utf8");
  assert.match(
    generated,
    /StreamAgentSessionEventsV2ParamsEventSchemaVersionN2 StreamAgentSessionEventsV2ParamsEventSchemaVersion = 2/,
  );
  assert.match(generated, /case StreamAgentSessionEventsV2ParamsEventSchemaVersionN2:/);
  assert.doesNotMatch(
    generated,
    /^\s*N2 StreamAgentSessionEventsV2ParamsEventSchemaVersion = 2$/m,
    "oapi-codegen's shortened N2 must not replace the established exported SDK identifier",
  );
});

test("FEAT-137 v6 keeps legacy Go client interface method sets exact and opt-in", async () => {
  const generated = await readFile("sdks/go/openapi/agent-host/client.gen.go", "utf8");
  const legacy = goInterfaceMethods(generated, "ClientInterface");
  const legacyWithResponses = goInterfaceMethods(generated, "ClientWithResponsesInterface");
  assert.equal(legacy.length, 38);
  assert.equal(legacyWithResponses.length, 38);
  assert.equal(
    sha256(JSON.stringify(legacy)),
    "2584963fe9d8a80bce9bfba08a6de17b1c7c944c1ef1217ca0cd930c59f464ce",
  );
  assert.equal(
    sha256(JSON.stringify(legacyWithResponses)),
    "f1e3534323b650c2d3005014c01c3208373bb749faa37a975e3f00bbc12b42b8",
  );
  assert.equal(legacy.some((method) => method.includes("V6")), false);
  assert.equal(legacyWithResponses.some((method) => method.includes("V6")), false);

  const v6 = goInterfaceMethods(generated, "ClientV6Interface");
  const v6WithResponses = goInterfaceMethods(generated, "ClientWithResponsesV6Interface");
  assert.equal(v6.length, 4);
  assert.equal(v6WithResponses.length, 4);
  assert.equal(v6.every((method) => method.includes("V6")), true);
  assert.equal(v6WithResponses.every((method) => method.includes("V6")), true);
  assert.match(generated, /type ClientV6Interface interface \{\n\tClientInterface/);
  assert.match(
    generated,
    /type ClientWithResponsesV6Interface interface \{\n\tClientWithResponsesInterface/,
  );
  assert.match(generated, /type ClientWithResponsesV6 struct \{\n\t\*ClientWithResponses/);
  assert.match(
    generated,
    /func \(c \*ClientWithResponsesV6\) GetPendingAgentApprovalsV6WithResponse\(/,
  );
  assert.doesNotMatch(
    generated,
    /func \(c \*ClientWithResponses\) [A-Za-z0-9_]*V6(?:WithBody)?WithResponse\(/,
  );
  assert.match(generated, /_ ClientInterface\s+= \(\*Client\)\(nil\)/);
  assert.match(generated, /_ ClientV6Interface\s+= \(\*Client\)\(nil\)/);
  assert.match(
    generated,
    /_ ClientWithResponsesV6Interface = \(\*ClientWithResponsesV6\)\(nil\)/,
  );
});

test("FEAT-137 v6 leaves every pre-v6 OpenAPI surface semantically identical", async () => {
  const document = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));
  delete document.paths["/v6/agent-sessions/{agent_session_id}/events"];
  delete document.paths["/v6/agent-sessions/{agent_session_id}/approvals/pending"];
  delete document.paths["/v6/agent-sessions/{agent_session_id}/approvals/{approval_request_id}/decision"];
  document.tags = document.tags.filter(({ name }) => name !== "Approvals");
  document.info.description = document.info.description.replace(
    "v1, v2, v3, v4, v5, or v6 JSON Schema",
    "v1, v2, v3, v4, or v5 JSON Schema",
  );
  delete document.components.parameters.EventSchemaVersionV6;
  delete document.components.parameters.ApprovalRequestIdV6;
  for (const name of [
    "ApprovalBadRequestV6",
    "ApprovalUnauthorizedV6",
    "ApprovalSessionNotFoundV6",
    "ApprovalNotFoundV6",
    "ApprovalConflictV6",
    "ApprovalUnavailableV6",
    "ApprovalInternalErrorV6",
  ]) delete document.components.responses[name];
  for (const name of [
    "ApprovalDecisionNameV6",
    "ApprovalDecisionSetV6",
    "PendingApprovalV6",
    "PendingApprovalSnapshotV6",
    "ApprovalDecisionV6Request",
    "ApprovalDecisionV6Response",
    "ApprovalErrorResponseV6",
    "ApprovalBadRequestErrorResponseV6",
    "ApprovalUnauthorizedErrorResponseV6",
    "ApprovalSessionNotFoundErrorResponseV6",
    "ApprovalNotFoundErrorResponseV6",
    "ApprovalConflictErrorResponseV6",
    "ApprovalUnavailableErrorResponseV6",
    "ApprovalInternalErrorResponseV6",
    "ApprovalUnauthorizedErrorV6",
    "ApprovalInvalidRequestErrorV6",
    "ApprovalVersionMismatchErrorV6",
    "ApprovalSessionNotFoundErrorV6",
    "ApprovalNotFoundErrorV6",
    "ApprovalStaleErrorV6",
    "ApprovalExpiredErrorV6",
    "ApprovalAlreadyResolvedErrorV6",
    "ApprovalDecisionConflictErrorV6",
    "ApprovalUnavailableErrorV6",
    "ApprovalInternalErrorV6",
  ]) delete document.components.schemas[name];
  assert.equal(
    sha256(JSON.stringify(document)),
    "b4a37d94d0dc5c2fd1a14b9c638e3d521410214a68af63c328b8fa2cc3cabe4f",
  );
});

test("FEAT-137 v6 leaves every pre-v6 AsyncAPI surface semantically identical", async () => {
  const document = parseYaml(await readFile("asyncapi/events.yaml", "utf8"));
  delete document.channels.agentSessionEventsV6;
  delete document.operations.receiveAgentSessionEventsV6;
  delete document.components.messages.AgentSessionEventV6;
  assert.equal(
    sha256(JSON.stringify(document)),
    "336f11f3db23136c7be82bbef884d622ef673a6996647c382bfb6c784e14e430",
  );
});
