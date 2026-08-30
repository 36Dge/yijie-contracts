import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const document = parseYaml(await readFile("openapi/agent-host/agent-host.yaml", "utf8"));
const fixtureRoot = "tests/fixtures/agent/host-v6";
const positiveFixtures = [
  "decision-accept-request.json",
  "decision-accept-response.json",
  "decision-cancel-request.json",
  "decision-cancel-response.json",
  "error-already-resolved.json",
  "error-approval-not-found.json",
  "error-decision-conflict.json",
  "error-expired.json",
  "error-internal.json",
  "error-invalid-request.json",
  "error-session-not-found.json",
  "error-stale.json",
  "error-unauthorized.json",
  "error-unavailable.json",
  "error-version-mismatch.json",
  "pending-empty.json",
  "pending-snapshot.json",
];

function dereference(value) {
  if (Array.isArray(value)) return value.map(dereference);
  if (value == null || typeof value !== "object") return value;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
    const name = value.$ref.split("/").at(-1);
    return dereference(document.components.schemas[name]);
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, dereference(entry)]));
}

function compile(name) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addFormat("int64", true);
  ajv.addKeyword({
    keyword: "x-yijie-approval-snapshot-invariants",
    schemaType: "object",
    type: "object",
    errors: false,
    validate: (policy, value) => {
      const snapshotAt = Date.parse(value[policy.snapshot_at_field]);
      if (!Number.isFinite(snapshotAt)) return false;
      return value[policy.pending_field].every((pending) => {
        const requestedAt = Date.parse(pending[policy.requested_at_field]);
        const expiresAt = Date.parse(pending[policy.expires_at_field]);
        return (
          Number.isFinite(requestedAt) &&
          Number.isFinite(expiresAt) &&
          expiresAt - requestedAt === policy.ttl_seconds * 1000 &&
          snapshotAt >= requestedAt &&
          snapshotAt < expiresAt
        );
      });
    },
  });
  ajv.addKeyword({ keyword: "x-yijie-correlation-policy", schemaType: "object" });
  ajv.addKeyword({ keyword: "x-yijie-idempotency-policy", schemaType: "object" });
  return ajv.compile(dereference(document.components.schemas[name]));
}

const validators = {
  pending: compile("PendingApprovalSnapshotV6"),
  request: compile("ApprovalDecisionV6Request"),
  response: compile("ApprovalDecisionV6Response"),
  errorBadRequest: compile("ApprovalBadRequestErrorResponseV6"),
  errorUnauthorized: compile("ApprovalUnauthorizedErrorResponseV6"),
  errorSessionNotFound: compile("ApprovalSessionNotFoundErrorResponseV6"),
  errorNotFound: compile("ApprovalNotFoundErrorResponseV6"),
  errorConflict: compile("ApprovalConflictErrorResponseV6"),
  errorUnavailable: compile("ApprovalUnavailableErrorResponseV6"),
  errorInternal: compile("ApprovalInternalErrorResponseV6"),
};

const errorFixtureValidators = new Map([
  ["error-unauthorized.json", validators.errorUnauthorized],
  ["error-invalid-request.json", validators.errorBadRequest],
  ["error-version-mismatch.json", validators.errorBadRequest],
  ["error-session-not-found.json", validators.errorSessionNotFound],
  ["error-approval-not-found.json", validators.errorNotFound],
  ["error-stale.json", validators.errorConflict],
  ["error-expired.json", validators.errorConflict],
  ["error-already-resolved.json", validators.errorConflict],
  ["error-decision-conflict.json", validators.errorConflict],
  ["error-unavailable.json", validators.errorUnavailable],
  ["error-internal.json", validators.errorInternal],
]);

async function fixture(name) {
  return JSON.parse(await readFile(`${fixtureRoot}/${name}`, "utf8"));
}

function assertValid(validator, value, label) {
  assert.equal(validator(value), true, `${label}: ${JSON.stringify(validator.errors)}`);
}

function assertInvalid(validator, value, label) {
  assert.equal(validator(value), false, `${label}: unexpectedly validated`);
}

function decisionFingerprint(approvalRequestId, request) {
  return JSON.stringify([
    approvalRequestId,
    request.schema_version,
    request.expected_stream_id,
    request.expected_revision,
    request.decision,
  ]);
}

function decisionResponseCorrelates(approvalRequestId, request, response) {
  return (
    response.approval_request_id === approvalRequestId &&
    response.decision_id === request.decision_id &&
    response.stream_id === request.expected_stream_id &&
    response.revision === request.expected_revision + 1 &&
    response.decision === request.decision &&
    response.outcome ===
      (request.decision === "accept_once" ? "accepted_once" : "cancelled_current_turn")
  );
}

function applyDecision(ledger, approvalRequestId, request, response) {
  const fingerprint = decisionFingerprint(approvalRequestId, request);
  const existingDecision = ledger.byDecisionId.get(request.decision_id);
  if (existingDecision) {
    return existingDecision.fingerprint === fingerprint
      ? { kind: "identical_replay", response: structuredClone(existingDecision.response) }
      : { kind: "error", code: "approval_decision_conflict" };
  }
  if (ledger.byApprovalId.has(approvalRequestId)) {
    return { kind: "error", code: "approval_already_resolved" };
  }
  if (!ledger.pending.has(approvalRequestId)) {
    return { kind: "error", code: "approval_not_found" };
  }
  assert.equal(decisionResponseCorrelates(approvalRequestId, request, response), true);
  const record = { fingerprint, response: structuredClone(response) };
  ledger.byDecisionId.set(request.decision_id, record);
  ledger.byApprovalId.set(approvalRequestId, request.decision_id);
  ledger.pending.delete(approvalRequestId);
  return { kind: "accepted", response: structuredClone(response) };
}

function evictResolvedDecision(ledger, approvalRequestId) {
  const decisionId = ledger.byApprovalId.get(approvalRequestId);
  ledger.byApprovalId.delete(approvalRequestId);
  if (decisionId) ledger.byDecisionId.delete(decisionId);
}

test("v6 approval HTTP fixtures are the complete closed positive set", async () => {
  assert.deepEqual((await readdir(fixtureRoot)).sort(), positiveFixtures);
  for (const name of ["pending-empty.json", "pending-snapshot.json"]) {
    assertValid(validators.pending, await fixture(name), name);
  }
  for (const name of ["decision-accept-request.json", "decision-cancel-request.json"]) {
    assertValid(validators.request, await fixture(name), name);
  }
  for (const name of ["decision-accept-response.json", "decision-cancel-response.json"]) {
    assertValid(validators.response, await fixture(name), name);
  }
  for (const [name, statusValidator] of errorFixtureValidators) {
    const value = await fixture(name);
    assertValid(statusValidator, value, `${name} status-specific`);
  }
});

test("pending snapshot is memory-only, one-at-a-time, fixed-action authority", async () => {
  const snapshot = await fixture("pending-snapshot.json");
  const pending = snapshot.pending[0];
  assert.deepEqual(pending.decisions, {
    primary: "accept_once",
    secondary: "cancel_current_turn",
  });
  assert.equal(Date.parse(pending.expires_at) - Date.parse(pending.requested_at), 120_000);
  assertInvalid(validators.pending, { ...snapshot, pending: [pending, pending] }, "two pending approvals");
  assertInvalid(
    validators.pending,
    { ...snapshot, pending: [{ ...pending, decisions: { primary: "cancel_current_turn", secondary: "accept_once" } }] },
    "swapped decisions",
  );
  assertInvalid(
    validators.pending,
    { ...snapshot, snapshot_at: pending.expires_at },
    "expired pending snapshot",
  );
  assertInvalid(
    validators.pending,
    { ...snapshot, pending: [{ ...pending, expires_at: "2026-08-30T12:02:01Z" }] },
    "121-second pending window",
  );
  assertInvalid(
    validators.pending,
    { ...snapshot, pending: [{ ...pending, revision: 2 }] },
    "pending revision two",
  );
  for (const property of [
    "runtime_request_id",
    "runtime_approval_id",
    "runtime_started_at_ms",
    "command",
    "command_actions",
    "cwd",
    "runtime_environment_id",
    "reason",
    "network_approval_context",
    "proposed_execpolicy_amendment",
    "proposed_network_policy_amendments",
    "available_decisions",
    "additional_permissions",
    "runtime_wire",
  ]) {
    assertInvalid(
      validators.pending,
      { ...snapshot, pending: [{ ...pending, [property]: "forbidden" }] },
      property,
    );
  }
});

test("one-shot decision request is versioned, generation-bound, revision-bound, and closed", async () => {
  const request = await fixture("decision-accept-request.json");
  for (const property of [
    "schema_version",
    "decision_id",
    "expected_stream_id",
    "expected_revision",
    "decision",
  ]) {
    const invalid = structuredClone(request);
    delete invalid[property];
    assertInvalid(validators.request, invalid, `missing ${property}`);
  }
  assertInvalid(validators.request, { ...request, schema_version: 5 }, "v5 decision body");
  assertInvalid(validators.request, { ...request, decision: "decline" }, "decline");
  assertInvalid(validators.request, { ...request, decision: "accept_for_session" }, "session approval");
  assertInvalid(validators.request, { ...request, command: "git status" }, "raw command");
  assertInvalid(validators.request, { ...request, expected_revision: 2 }, "non-pending revision");
});

test("decision responses are closed and correlate exactly with their request and path", async () => {
  const pathApprovalRequestId = "66666666-6666-4666-8666-666666666666";
  for (const kind of ["accept", "cancel"]) {
    const request = await fixture(`decision-${kind}-request.json`);
    const response = await fixture(`decision-${kind}-response.json`);
    assertValid(validators.response, response, `${kind} response`);
    assert.equal(response.approval_request_id, pathApprovalRequestId);
    assert.equal(response.decision_id, request.decision_id);
    assert.equal(response.stream_id, request.expected_stream_id);
    assert.equal(response.revision, request.expected_revision + 1);
    assert.equal(response.decision, request.decision);
    assert.equal(
      response.outcome,
      request.decision === "accept_once" ? "accepted_once" : "cancelled_current_turn",
    );
    assert.equal(decisionResponseCorrelates(pathApprovalRequestId, request, response), true);

    for (const [label, mutation] of [
      ["path approval id", { approval_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      ["decision id", { decision_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }],
      ["stream id", { stream_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
    ]) {
      const semanticallyWrong = { ...response, ...mutation };
      assertValid(validators.response, semanticallyWrong, `${kind} ${label} remains standalone-valid`);
      assert.equal(
        decisionResponseCorrelates(pathApprovalRequestId, request, semanticallyWrong),
        false,
        `${kind} ${label} must fail contextual correlation`,
      );
    }
  }
  const accepted = await fixture("decision-accept-response.json");
  assertInvalid(
    validators.response,
    { ...accepted, decision: "accept_once", outcome: "cancelled_current_turn" },
    "accept with cancelled outcome",
  );
  assertInvalid(validators.response, { ...accepted, revision: 999 }, "revision jump");
});

test("decision idempotency is session-scoped, fingerprinted, bounded, and never reopens authority", async () => {
  const approvalRequestId = "66666666-6666-4666-8666-666666666666";
  const request = await fixture("decision-accept-request.json");
  const response = await fixture("decision-accept-response.json");
  const ledger = {
    pending: new Set([approvalRequestId]),
    byDecisionId: new Map(),
    byApprovalId: new Map(),
  };
  const accepted = applyDecision(ledger, approvalRequestId, request, response);
  assert.equal(accepted.kind, "accepted");
  const replay = applyDecision(ledger, approvalRequestId, structuredClone(request), {
    ...response,
    resolved_at: "2099-01-01T00:00:00Z",
  });
  assert.equal(replay.kind, "identical_replay");
  assert.deepEqual(replay.response, response, "identical retry returns the original response bytes/value");

  const conflicting = structuredClone(request);
  conflicting.decision = "cancel_current_turn";
  assert.deepEqual(applyDecision(ledger, approvalRequestId, conflicting, response), {
    kind: "error",
    code: "approval_decision_conflict",
  });

  const newDecisionId = structuredClone(request);
  newDecisionId.decision_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.deepEqual(applyDecision(ledger, approvalRequestId, newDecisionId, response), {
    kind: "error",
    code: "approval_already_resolved",
  });

  evictResolvedDecision(ledger, approvalRequestId);
  assert.deepEqual(applyDecision(ledger, approvalRequestId, request, response), {
    kind: "error",
    code: "approval_not_found",
  });

  const policy = document.components.schemas.ApprovalDecisionV6Request["x-yijie-idempotency-policy"];
  assert.equal(policy.scope, "agent_session");
  assert.deepEqual(policy.canonical_fingerprint_fields, {
    approval_request_id: "path_approval_request_id",
    schema_version: "schema_version",
    expected_stream_id: "expected_stream_id",
    expected_revision: "expected_revision",
    decision: "decision",
  });
  assert.equal(policy.same_id_same_fingerprint, "identical_original_200_while_resolved_audit_retained");
  assert.equal(policy.retry_after_audit_eviction, "approval_not_found");
});

test("approval errors are stable and content-free", async () => {
  const expired = await fixture("error-expired.json");
  assertInvalid(
    validators.errorConflict,
    { error: { ...expired.error, code: "runtime_raw_error" } },
    "unknown error code",
  );
  assertInvalid(
    validators.errorConflict,
    { error: { ...expired.error, cwd: "/private/workspace" } },
    "raw path detail",
  );
  assertInvalid(
    validators.errorConflict,
    { error: { ...expired.error, message: "secret=token cwd=/private/workspace" } },
    "free-form secret/path message",
  );
  assertInvalid(validators.errorUnauthorized, expired, "expired body under HTTP 401");
  assertInvalid(
    validators.errorConflict,
    await fixture("error-unauthorized.json"),
    "unauthorized body under HTTP 409",
  );
});

test("OpenAPI exposes only owner-only v6 snapshot and decision operations with no-store", () => {
  const pendingPath = document.paths["/v6/agent-sessions/{agent_session_id}/approvals/pending"].get;
  const decisionPath =
    document.paths[
      "/v6/agent-sessions/{agent_session_id}/approvals/{approval_request_id}/decision"
    ].post;
  assert.deepEqual(document.security, [{ localBearer: [] }]);
  assert.equal(pendingPath.operationId, "getPendingAgentApprovalsV6");
  assert.equal(decisionPath.operationId, "decideAgentApprovalV6");
  assert.equal(
    pendingPath.responses["200"].content["application/json"].schema.$ref,
    "#/components/schemas/PendingApprovalSnapshotV6",
  );
  assert.equal(
    decisionPath.requestBody.content["application/json"].schema.$ref,
    "#/components/schemas/ApprovalDecisionV6Request",
  );
  assert.equal(
    pendingPath.responses["404"].$ref,
    "#/components/responses/ApprovalSessionNotFoundV6",
  );
  assert.equal(
    decisionPath.responses["404"].$ref,
    "#/components/responses/ApprovalNotFoundV6",
  );
  assert.match(decisionPath.description, /serverRequest\/resolved/);
  for (const response of [pendingPath.responses["200"], decisionPath.responses["200"]]) {
    assert.equal(response.headers["Cache-Control"].$ref, "#/components/headers/NoStore");
  }
  assert.deepEqual(document.components.schemas.ApprovalDecisionSetV6.required, [
    "primary",
    "secondary",
  ]);
  assert.deepEqual(
    document.components.schemas.ApprovalDecisionSetV6.properties.primary.enum,
    ["accept_once"],
  );
  assert.deepEqual(
    document.components.schemas.ApprovalDecisionSetV6.properties.secondary.enum,
    ["cancel_current_turn"],
  );
  assert.deepEqual(document.components.responses.ApprovalConflictV6["x-yijie-error-codes"], [
    "approval_stale",
    "approval_expired",
    "approval_already_resolved",
    "approval_decision_conflict",
  ]);
  assert.equal(
    document.components.responses.ApprovalUnavailableV6.headers["Retry-After"],
    undefined,
    "decision transport is reconciled by snapshot, not automatic retry",
  );
  assert.equal(
    document.components.responses.ApprovalUnauthorizedV6.content["application/json"].schema.$ref,
    "#/components/schemas/ApprovalUnauthorizedErrorResponseV6",
  );
  assert.equal(
    document.components.responses.ApprovalConflictV6.content["application/json"].schema.$ref,
    "#/components/schemas/ApprovalConflictErrorResponseV6",
  );
  const legacyCodes = document.components.schemas.ErrorResponse.properties.error.properties.code.enum;
  assert.equal(legacyCodes.some((code) => code.startsWith("approval_")), false);
});
