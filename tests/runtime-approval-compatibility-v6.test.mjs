import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const manifestPath = "compatibility/agent-host-runtime-approval-v6-v2.json";
const schemaPath = "jsonschema/compatibility/agent-host-runtime-approval-v6-v2.schema.json";
const runtimeRoot = process.env.YIJIE_CODEX_REPO ?? path.resolve("../yijie-codex");
const runtimeSchemaRoot = path.join(runtimeRoot, ".yijie/schemas/app-server/generated-json-schema");
const execFileAsync = promisify(execFile);

async function loadJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function findJsonFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await findJsonFiles(directory, child)));
    else if (entry.name.endsWith(".json")) files.push(child);
  }
  return files.sort();
}

async function schemaTreeSha256(directory, files) {
  const digest = createHash("sha256");
  for (const relative of [...files].sort()) {
    const encodedPath = Buffer.from(relative, "utf8");
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(encodedPath.length));
    digest.update(length);
    digest.update(encodedPath);
    digest.update(createHash("sha256").update(await readFile(path.join(directory, relative))).digest());
  }
  return digest.digest("hex");
}

async function fileSha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function methodsFromSchema(schema) {
  return (schema.oneOf ?? []).flatMap((branch) => branch?.properties?.method?.enum ?? []);
}

function eligibleRuntimeRequest(request, host) {
  const policy = host.policy;
  if (request == null || typeof request !== "object" || Array.isArray(request)) return false;
  const outerFields = Object.values(policy.wireShape.outer_required_fields).sort();
  if (Object.keys(request).sort().join(",") !== outerFields.join(",")) return false;
  if (request.method !== policy.method) return false;
  if (!(typeof request.id === "string" || Number.isSafeInteger(request.id))) return false;
  const params = request.params;
  if (params == null || typeof params !== "object" || Array.isArray(params)) return false;
  const allowedParams = new Set([
    ...Object.values(policy.wireShape.params_required_fields),
    ...Object.values(policy.wireShape.params_optional_fields),
  ]);
  if (Object.keys(params).some((field) => !allowedParams.has(field))) return false;
  if (Object.values(policy.wireShape.params_required_fields).some((field) => !Object.hasOwn(params, field))) {
    return false;
  }
  if (!["threadId", "turnId", "itemId"].every((key) => typeof params[key] === "string" && params[key])) {
    return false;
  }
  if (
    params.threadId !== host.runtimeThreadId ||
    params.turnId !== host.activeTurnId ||
    params.itemId !== host.expectedCommandItemId
  ) {
    return false;
  }
  if (!Number.isSafeInteger(params.startedAtMs)) return false;
  if (params.command !== policy.commandWire || host.canonicalizeCwd(params.cwd) !== host.workspaceRoot) {
    return false;
  }
  if (params.approvalId != null) return false;
  if (params.environmentId !== host.environmentId) return false;
  if (
    params.reason != null &&
    (typeof params.reason !== "string" ||
      Buffer.byteLength(params.reason, "utf8") > policy.maxReasonUtf8Bytes ||
      params.reason.includes("\0"))
  ) {
    return false;
  }
  if (!Array.isArray(params.commandActions) || params.commandActions.length !== 1) return false;
  const [action] = params.commandActions;
  if (
    action == null ||
    typeof action !== "object" ||
    Array.isArray(action) ||
    Object.keys(action).sort().join(",") !== "command,type" ||
    action.type !== "unknown" ||
    action.command !== policy.actionCommand
  ) {
    return false;
  }
  for (const field of policy.mustBeAbsent) {
    if (Object.hasOwn(params, field)) return false;
  }
  return true;
}

function runtimeReplayFingerprint(request, host) {
  assert.equal(eligibleRuntimeRequest(request, host), true, "fingerprint input must be exactly eligible");
  return JSON.stringify({
    threadId: host.runtimeThreadId,
    turnId: host.activeTurnId,
    itemId: host.expectedCommandItemId,
    command: request.params.commandActions[0].command,
    commandActions: [
      { type: "unknown", command: request.params.commandActions[0].command },
    ],
    cwd: host.workspaceIdentity,
    environmentId: host.localEnvironmentIdentity,
    approvalId: null,
    startedAtMs: request.params.startedAtMs,
  });
}

function resolutionAcknowledgementMatches(expected, runtimeGeneration, notification) {
  return (
    runtimeGeneration === expected.runtimeGeneration &&
    notification?.method === "serverRequest/resolved" &&
    notification.params?.requestId === expected.requestId &&
    notification.params?.threadId === expected.threadId
  );
}

function runtimeReplayKey(runtimeGeneration, request) {
  return JSON.stringify([runtimeGeneration, request.id]);
}

function classifyRuntimeReplay(existing, runtimeGeneration, request, host) {
  const key = runtimeReplayKey(runtimeGeneration, request);
  if (existing && existing.key === key) {
    if (!eligibleRuntimeRequest(request, host)) {
      return { kind: "same_key_conflict", response: "cancel_once", outcome: "resolved_elsewhere" };
    }
    return runtimeReplayFingerprint(request, host) === existing.fingerprint
      ? { kind: "reuse_pending_without_ttl_reset" }
      : { kind: "same_key_conflict", response: "cancel_once", outcome: "resolved_elsewhere" };
  }
  if (!eligibleRuntimeRequest(request, host)) return { kind: "reject_without_projection" };
  if (existing) return { kind: "second_pending_cancel_without_projection" };
  return { kind: "new_pending", key, fingerprint: runtimeReplayFingerprint(request, host) };
}

test("the independent FEAT-137 Runtime approval projection is closed and exact", async () => {
  const [manifest, schema, packageManifest] = await Promise.all([
    loadJson(manifestPath),
    loadJson(schemaPath),
    loadJson("package.json"),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
  assert.equal(manifest.contracts_version, packageManifest.version);

  const mutations = [
    ["method", (value) => (value.reverse_request.method = "item/fileChange/requestApproval")],
    ["runtime pin", (value) => (value.runtime.repository_commit = "0".repeat(40))],
    ["gate composition", (value) => value.activation.required_feature_gates.pop()],
    ["gate identity", (value) => (value.activation.required_feature_gates[0] = "FEAT-133")],
    ["gate order", (value) => value.activation.required_feature_gates.reverse()],
    ["command wire", (value) => (value.reverse_request.eligibility.command.wire = "git status")],
    [
      "command authority",
      (value) => (value.reverse_request.eligibility.command.business_authority = "command"),
    ],
    ["action count", (value) => (value.reverse_request.eligibility.command_actions.exact_count = 2)],
    ["approval id", (value) => (value.reverse_request.eligibility.approval_id = "required_null")],
    ["cwd", (value) => (value.reverse_request.eligibility.cwd = "runtime_supplied")],
    ["environment", (value) => (value.reverse_request.eligibility.environment_id = "any")],
    ["reason bound", (value) => (value.reverse_request.eligibility.reason.max_utf8_bytes = 513)],
    ["producer", (value) => (value.activation.producer.sandbox_permissions = "require_escalated")],
    ["producer scope", (value) => (value.activation.producer.installation_scope = "local")],
    [
      "producer reason",
      (value) => (value.activation.producer.justification = "Approve elevated access."),
    ],
    ["producer example", (value) => value.activation.producer.load_time_examples.not_match.pop()],
    ["producer match", (value) => (value.activation.producer.runtime_match_semantics = "exact")],
    ["producer authority", (value) => (value.activation.producer.exact_admission_authority = "runtime_rule")],
    ["available decisions", (value) => (value.reverse_request.eligibility.ignored_if_present = {})],
    ["accept mapping", (value) => (value.runtime_response.accept_once.decision = "decline")],
    ["cancel mapping", (value) => (value.runtime_response.cancel_current_turn.decision = "decline")],
    ["TTL", (value) => (value.lifecycle.ttl_seconds = 119)],
    ["TTL clock", (value) => (value.lifecycle.ttl_clock = "runtime_startedAtMs")],
    ["replay", (value) => (value.reverse_request.correlation.same_key_replay = "mint_new")],
    [
      "replay fingerprint",
      (value) =>
        (value.reverse_request.correlation.replay_payload_equivalence.canonical_fields.started_at_ms =
          "ignored"),
    ],
    [
      "unknown params",
      (value) => (value.reverse_request.wire_shape.params_additional_properties = "allowed"),
    ],
    [
      "identity binding",
      (value) => (value.reverse_request.identity_binding.thread_id = "any_thread"),
    ],
    [
      "ack generation",
      (value) =>
        (value.lifecycle.resolution_acknowledgement.correlation.runtime_generation =
          "same_transport_connection"),
    ],
    ["pending", (value) => (value.lifecycle.max_pending_per_session = 2)],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    assert.equal(validate(candidate), false, `${label}: mutated projection unexpectedly validated`);
  }
});

test("the frozen Runtime schemas and stable reverse-request shape match the projection", async (t) => {
  if (!(await exists(runtimeSchemaRoot))) {
    t.skip(`Runtime schema checkout is unavailable at ${runtimeRoot}`);
    return;
  }
  const manifest = await loadJson(manifestPath);
  const { stdout } = await execFileAsync("git", ["-C", runtimeRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  assert.equal(stdout.trim(), manifest.runtime.repository_commit);

  const files = await findJsonFiles(runtimeSchemaRoot);
  assert.equal(files.length, manifest.runtime.schema_file_count);
  assert.equal(await schemaTreeSha256(runtimeSchemaRoot, files), manifest.runtime.schema_tree_sha256);
  for (const [name, digest] of Object.entries(manifest.runtime.schema_artifacts)) {
    assert.equal(await fileSha256(path.join(runtimeSchemaRoot, name)), digest, name);
  }

  const [serverRequest, params, response, serverNotification] = await Promise.all([
    loadJson(path.join(runtimeSchemaRoot, "ServerRequest.json")),
    loadJson(path.join(runtimeSchemaRoot, "CommandExecutionRequestApprovalParams.json")),
    loadJson(path.join(runtimeSchemaRoot, "CommandExecutionRequestApprovalResponse.json")),
    loadJson(path.join(runtimeSchemaRoot, "ServerNotification.json")),
  ]);
  assert.equal(methodsFromSchema(serverRequest).includes(manifest.reverse_request.method), true);
  assert.deepEqual(params.required, Object.values(manifest.reverse_request.stable_required_params));
  assert.equal(params.properties.approvalId.type.includes("null"), true);
  assert.equal(params.properties.environmentId.type.includes("null"), true);
  assert.equal(params.properties.reason.type.includes("null"), true);
  assert.equal(params.properties.reason.type.includes("string"), true);
  assert.equal(params.properties.command.type.includes("null"), true);
  assert.equal(params.properties.cwd.anyOf.some((entry) => entry.type === "null"), true);
  assert.equal(params.properties.commandActions.type.includes("null"), true);
  assert.equal(params.properties.availableDecisions, undefined);
  assert.equal(params.properties.additionalPermissions, undefined);

  const decisions = response.definitions.CommandExecutionApprovalDecision.oneOf.flatMap(
    (branch) => branch.enum ?? [],
  );
  assert.deepEqual(
    decisions,
    ["accept", "acceptForSession", "decline", "cancel"],
    "object amendment decisions stay stable but are intentionally absent from the string-only list",
  );
  assert.equal(methodsFromSchema(serverNotification).includes("serverRequest/resolved"), true);
  const resolved = serverNotification.definitions.ServerRequestResolvedNotification;
  assert.deepEqual(resolved.required, ["requestId", "threadId"]);
  const requestId = serverNotification.definitions.RequestId;
  assert.deepEqual(
    requestId.anyOf.map((branch) => branch.type),
    ["string", "integer"],
  );
  assert.equal(resolved.properties.threadId.type, "string");
});

test("canonical request eligibility is exact while availableDecisions is tolerated and ignored", async () => {
  const manifest = await loadJson(manifestPath);
  const host = {
    workspaceRoot: "/synthetic/workspace",
    workspaceIdentity: "workspace-identity-1",
    environmentId: "local",
    localEnvironmentIdentity: "local-environment-identity-1",
    runtimeThreadId: "thread-1",
    activeTurnId: "turn-1",
    expectedCommandItemId: "item-1",
    canonicalizeCwd: (value) =>
      value === "/synthetic/workspace" || value === "/synthetic/workspace-link"
        ? "/synthetic/workspace"
        : null,
    policy: {
      method: manifest.reverse_request.method,
      commandWire: manifest.reverse_request.eligibility.command.wire,
      actionCommand: manifest.reverse_request.eligibility.command_actions.command,
      maxReasonUtf8Bytes: manifest.reverse_request.eligibility.reason.max_utf8_bytes,
      mustBeAbsent: Object.values(manifest.reverse_request.eligibility.must_be_absent),
      wireShape: manifest.reverse_request.wire_shape,
    },
  };
  const canonical = {
    id: 7,
    method: manifest.reverse_request.method,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      startedAtMs: 1,
      approvalId: null,
      environmentId: host.environmentId,
      command: manifest.reverse_request.eligibility.command.wire,
      cwd: host.workspaceRoot,
      commandActions: [
        { type: "unknown", command: manifest.reverse_request.eligibility.command_actions.command },
      ],
      availableDecisions: ["acceptForSession", "decline"],
    },
  };
  assert.equal(eligibleRuntimeRequest(canonical, host), true);
  assert.equal(
    eligibleRuntimeRequest({ ...canonical, id: "request-7" }, host),
    true,
    "stable RequestId also permits strings",
  );

  const invalidMutations = [
    (value) => (value.jsonrpc = "2.0"),
    (value) => (value.params.command = "git rev-parse --is-inside-work-tree"),
    (value) => (value.params.command = "/bin/zsh -c 'git rev-parse --is-inside-work-tree'"),
    (value) => (value.params.command = "/bin/bash -lc 'git rev-parse --is-inside-work-tree'"),
    (value) => (value.params.command = "/bin/zsh -lc 'git rev-parse --is-inside-work-tree --verify'"),
    (value) => (value.params.cwd = "/synthetic/other"),
    (value) => (value.params.approvalId = "subcommand-callback"),
    (value) => (value.params.environmentId = "remote-environment"),
    (value) => delete value.params.environmentId,
    (value) => (value.params.environmentId = null),
    (value) => (value.params.commandActions = []),
    (value) => value.params.commandActions.push(structuredClone(value.params.commandActions[0])),
    (value) => (value.params.commandActions[0].type = "read"),
    (value) => (value.params.commandActions[0].command = "git status"),
    (value) => (value.params.commandActions[0].path = "/private/path"),
    (value) => (value.params.reason = 7),
    (value) => (value.params.reason = `bounded${"x".repeat(506)}\0`),
    (value) => (value.params.reason = "é".repeat(257)),
    (value) => (value.params.networkApprovalContext = { host: "example.test" }),
    (value) => (value.params.additionalPermissions = { fileSystem: { read: ["/private"] } }),
    (value) => (value.params.proposedExecpolicyAmendment = ["git"]),
    (value) => (value.params.proposedNetworkPolicyAmendments = [{ host: "example.test" }]),
    (value) => (value.unknownTopLevel = true),
    (value) => (value.params.futurePermissionSemantics = { allow: true }),
    (value) => (value.params.threadId = "thread-2"),
    (value) => (value.params.turnId = "turn-2"),
    (value) => (value.params.itemId = "item-2"),
  ];
  for (const mutate of invalidMutations) {
    const candidate = structuredClone(canonical);
    mutate(candidate);
    assert.equal(eligibleRuntimeRequest(candidate, host), false);
  }
  const withoutApprovalId = structuredClone(canonical);
  delete withoutApprovalId.params.approvalId;
  assert.equal(eligibleRuntimeRequest(withoutApprovalId, host), true);
  for (const field of Object.values(manifest.reverse_request.eligibility.must_be_absent)) {
    const candidate = structuredClone(canonical);
    candidate.params[field] = null;
    assert.equal(eligibleRuntimeRequest(candidate, host), false, `${field} must be absent, not null`);
  }

  const equivalentReplays = [];
  for (const approvalId of [undefined, null]) {
    for (const reason of [undefined, null, "Confirm the one read-only repository check.", "é".repeat(256)]) {
      for (const availableDecisions of [undefined, [], ["decline"], ["acceptForSession", "cancel"]]) {
        const candidate = structuredClone(canonical);
        if (approvalId === undefined) delete candidate.params.approvalId;
        else candidate.params.approvalId = approvalId;
        if (reason === undefined) delete candidate.params.reason;
        else candidate.params.reason = reason;
        if (availableDecisions === undefined) delete candidate.params.availableDecisions;
        else candidate.params.availableDecisions = availableDecisions;
        assert.equal(eligibleRuntimeRequest(candidate, host), true);
        equivalentReplays.push(candidate);
      }
    }
  }
  const canonicalFingerprint = runtimeReplayFingerprint(canonical, host);
  const existing = {
    key: runtimeReplayKey("runtime-process-1", canonical),
    fingerprint: canonicalFingerprint,
  };
  for (const replay of equivalentReplays) {
    assert.equal(runtimeReplayFingerprint(replay, host), canonicalFingerprint);
    assert.deepEqual(classifyRuntimeReplay(existing, "runtime-process-1", replay, host), {
      kind: "reuse_pending_without_ttl_reset",
    });
  }
  const reorderedActionMembers = structuredClone(canonical);
  reorderedActionMembers.params.commandActions = [
    { command: manifest.reverse_request.eligibility.command_actions.command, type: "unknown" },
  ];
  assert.equal(eligibleRuntimeRequest(reorderedActionMembers, host), true);
  assert.equal(runtimeReplayFingerprint(reorderedActionMembers, host), canonicalFingerprint);
  const canonicalCwdAlias = structuredClone(canonical);
  canonicalCwdAlias.params.cwd = "/synthetic/workspace-link";
  assert.equal(eligibleRuntimeRequest(canonicalCwdAlias, host), true);
  assert.equal(runtimeReplayFingerprint(canonicalCwdAlias, host), canonicalFingerprint);
  const canonicalizationFailure = structuredClone(canonical);
  canonicalizationFailure.params.cwd = "/synthetic/workspace/../untrusted";
  assert.equal(eligibleRuntimeRequest(canonicalizationFailure, host), false);
  const driftedStartedAt = structuredClone(canonical);
  driftedStartedAt.params.startedAtMs += 1;
  assert.notEqual(runtimeReplayFingerprint(driftedStartedAt, host), canonicalFingerprint);
  assert.deepEqual(classifyRuntimeReplay(existing, "runtime-process-1", driftedStartedAt, host), {
    kind: "same_key_conflict",
    response: "cancel_once",
    outcome: "resolved_elsewhere",
  });
  for (const field of ["threadId", "turnId", "itemId"]) {
    const identityDrift = structuredClone(canonical);
    identityDrift.params[field] += "-drift";
    assert.deepEqual(classifyRuntimeReplay(existing, "runtime-process-1", identityDrift, host), {
      kind: "same_key_conflict",
      response: "cancel_once",
      outcome: "resolved_elsewhere",
    });
  }
  const distinctRequest = structuredClone(canonical);
  distinctRequest.id = 8;
  assert.deepEqual(classifyRuntimeReplay(existing, "runtime-process-1", distinctRequest, host), {
    kind: "second_pending_cancel_without_projection",
  });
});

test("Runtime replay keys are generation-scoped and preserve same-key pending authority", async () => {
  const manifest = await loadJson(manifestPath);
  const request = {
    id: 0,
    params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1" },
  };
  const key = runtimeReplayKey("runtime-generation-1", request);
  assert.equal(key, runtimeReplayKey("runtime-generation-1", structuredClone(request)));
  assert.notEqual(key, runtimeReplayKey("runtime-generation-2", request));
  assert.notEqual(
    key,
    runtimeReplayKey("runtime-generation-1", { ...request, id: "0" }),
    "RequestId JSON type is part of the response-authority key",
  );
  for (const field of ["threadId", "turnId", "itemId"]) {
    const identityDrift = structuredClone(request);
    identityDrift.params[field] += "-drift";
    assert.equal(
      key,
      runtimeReplayKey("runtime-generation-1", identityDrift),
      `${field} drift remains the same Runtime response-authority key`,
    );
  }
  assert.deepEqual(manifest.reverse_request.correlation.replay_key_fields, {
    runtime_generation: "runtime_generation",
    request_id: "request_id",
  });
  assert.equal(
    manifest.reverse_request.correlation.replay_key_extraction_order,
    "after_exact_outer_shape_before_params_eligibility",
  );
  assert.equal(
    manifest.reverse_request.correlation.same_key_replay,
    "reuse_approval_request_id_revision_requested_at_and_expires_at",
  );
  assert.equal(
    manifest.reverse_request.correlation.same_key_payload_conflict,
    "cancel_original_once_resolve_existing_pending_elsewhere_without_new_requested_projection",
  );
  assert.equal(
    manifest.reverse_request.correlation.replay_payload_equivalence.ignored_fields.available_decisions,
    "availableDecisions",
  );
  assert.equal(
    manifest.reverse_request.correlation.replay_payload_equivalence.canonical_fields.started_at_ms,
    "exact_integer_value",
  );
  assert.equal(manifest.lifecycle.max_pending_per_session, 1);
  assert.equal(
    manifest.lifecycle.pending_overflow,
    "cancel_new_request_once_without_desktop_projection",
  );
});

test("Runtime resolution acknowledgement is process-generation, RequestId-type, and thread bound", async () => {
  const manifest = await loadJson(manifestPath);
  const policy = manifest.lifecycle.resolution_acknowledgement;
  assert.equal(policy.method, "serverRequest/resolved");
  assert.equal(policy.correlation.runtime_generation, "same_runtime_process_generation");
  assert.equal(policy.correlation.request_id, "exact_json_type_and_value");
  const expected = {
    runtimeGeneration: "runtime-process-1",
    requestId: 7,
    threadId: "thread-1",
  };
  const notification = {
    method: policy.method,
    params: { requestId: 7, threadId: "thread-1" },
  };
  assert.equal(resolutionAcknowledgementMatches(expected, "runtime-process-1", notification), true);
  assert.equal(resolutionAcknowledgementMatches(expected, "runtime-process-2", notification), false);
  assert.equal(
    resolutionAcknowledgementMatches(expected, "runtime-process-1", {
      ...notification,
      params: { ...notification.params, requestId: "7" },
    }),
    false,
  );
  assert.equal(
    resolutionAcknowledgementMatches(expected, "runtime-process-1", {
      ...notification,
      params: { ...notification.params, requestId: 8 },
    }),
    false,
  );
  assert.equal(
    resolutionAcknowledgementMatches(expected, "runtime-process-1", {
      ...notification,
      params: { ...notification.params, threadId: "thread-2" },
    }),
    false,
  );
  assert.equal(policy.duplicate_behavior, "idempotent_no_second_transition");
  assert.equal(
    policy.timeout_behavior,
    "approval_unavailable_without_http_200_then_snapshot_reconcile",
  );
});
