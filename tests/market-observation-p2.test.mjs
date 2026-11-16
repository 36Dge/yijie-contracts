import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import { loadMarketHostSource as loadV1 } from "../scripts/market-host-source.mjs";
import { loadMarketHostSource as loadV2 } from "../scripts/market-host-v2-source.mjs";

const fixture = JSON.parse(readFileSync("fixtures/market-host/normal-wire.json"));
const broker = JSON.parse(readFileSync("fixtures/market-broker-control/normal-wire.json"));
const call = broker.PendingCallResponse.data.identity;
const fact = { schemaVersion: 1, approvalId: broker.DecideCallRequest.payload.approvalRef, decisionId: broker.DecideCallRequest.payload.decisionId,
  callRef: call.callRef, serviceId: call.serviceId, reference: call.reference, nativeThreadId: call.nativeThreadId, nativeTurnId: call.nativeTurnId,
  turnOperationId: call.binding.turnOperationId, selectionDigest: call.binding.selectionDigest, toolName: call.toolName,
  argsDigest: call.argsDigest, argsEncoding: call.argsEncoding, decision: "approve_once", kind: "requested", observedAtUnixMs: 1800000000000 };
function validator(schema, name) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
  ajv.addFormat("int64", { type: "number", validate: Number.isSafeInteger }); ajv.addSchema(schema);
  return ajv.getSchema(schema.$id + "#/$defs/" + name);
}
test("decision evidence has no execution capability and distinguishes intent from confirmation", () => {
  for (const source of [loadV1(), loadV2()]) {
    const valid = validator(source.schema, "DecisionFact");
    for (const kind of ["requested", "acknowledged", "unconfirmed"]) assert(valid({ ...fact, kind }), JSON.stringify(valid.errors));
    const keys = Object.keys(source.source.$defs.DecisionFact.properties);
    for (const forbidden of ["credentialRef", "capabilityRef", "scope", "arguments", "admissionConsumed", "executionState"]) assert(!keys.includes(forbidden));
    const missing = { ...fact }; delete missing.decisionId; assert.equal(valid(missing), false);
  }
});
test("old requests and explicit lightweight/event/history reads share the same scoped command", () => {
  for (const source of [loadV1(), loadV2()]) {
    const valid = validator(source.schema, "NativeObserveRequest");
    assert(valid(fixture.NativeObserveRequest));
    for (const mode of ["none", "events", "history"]) assert(valid({ ...fixture.NativeObserveRequest, payload: { ...fixture.NativeObserveRequest.payload, toolsRead: mode } }));
  }
});
test("additive display and read-only facts remain readable by pre-P2 response schemas", () => {
  const baseline = "2592f5d5b07fcd92de10d25c4dcf73bd1ce03cb5";
  for (const [family, current] of [["market-host", loadV1()], ["market-host-v2", loadV2()]]) {
    const previous = JSON.parse(execFileSync("git", ["show", `${baseline}:sdks/jsonschema/${family}.schema.json`], { maxBuffer: 16 << 20 }));
    const response = structuredClone(fixture.NativeObserveResponse);
    response.data.decisionFacts = [fact]; response.data.decisionFactsTruncated = false;
    response.data.tools = { agentSessionId: call.binding.context.agentSessionId, nativeTurnId: call.nativeTurnId, truncated: false, items: [{
      nativeItemId: "ordinary-item", nativeThreadId: call.nativeThreadId, nativeTurnId: call.nativeTurnId, serverName: "yijie_market",
      toolName: call.toolName, state: "completed", truncated: false, resultTextSource: "structured", resultText: '{"rows":[1]}',
    }] };
    for (const schema of [previous, current.schema]) {
      const valid = validator(schema, "NativeObserveResponse"); assert(valid(response), JSON.stringify(valid.errors));
    }
    const offline = { ...response, data: { managed: true, selectionDisplay: response.data.selectionDisplay, decisionFacts: [fact], remoteIssue: "not_ready" } };
    const valid = validator(current.schema, "NativeObserveResponse"); assert(valid(offline), JSON.stringify(valid.errors));
  }
});
