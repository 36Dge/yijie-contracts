# Agent session events and approvals v6

Status: FEAT-137 source-first candidate on the unpublished `0.7.0` package; not implemented by Host
or Desktop, not tagged/pushed/published, and not enabled for any Runtime, Provider, model, public, or
production entrypoint.

## Authority and impact

`contract-impact = semantic`. V5 is a closed event union, so approval is added only through explicit
v6 negotiation. The authorities are:

- JSON/SSE validity: `jsonschema/agent/session-event-v6.schema.json`;
- typed transport projection: `protobuf/yijie/events/v6/agent_session.proto`, subject to the JSON-
  equivalent semantic gate;
- HTTP framing, pending snapshot, and decision API: `openapi/agent-host/agent-host.yaml`;
- asynchronous consumer projection: `asyncapi/events.yaml` v6 channel/message/operation;
- external Runtime request/response source: frozen `yijie-codex` commit
  `b2b20e2fc4a0c94834f34d8cc459e488a1b56277`, version `0.144.6`, stable API,
  `experimentalApi=false`.

Producer is `yijie-agent-host`; known consumer is `yijie-desktop`. The Host is the only Runtime
mapper and pending/decision authority. Desktop never responds directly to Runtime and never restores
an actionable pending request from SQLCipher or replayed SSE history.

The existing `compatibility/agent-host-runtime-v1.json` remains byte-identical and continues to
describe the currently implemented `read-only/never` Host projection. V6 is source-first only; it
does not claim that the future exact-local `on-request` gate exists yet.

The separate `compatibility/agent-host-runtime-approval-v6.json` is the machine-readable source for
the future mapper. It freezes eligibility, replay identity, response mapping, raw-field exclusions,
and the stable `serverRequest/resolved` acknowledgement without changing the current v1 manifest.
The acknowledgement requires Runtime `requestId` and `threadId`; Host additionally binds the
notification to the same Runtime process generation and compares RequestId by exact JSON type and
value. A normal connection change within that process does not create a new identity generation.

## Frozen phase-one policy

V6 approval is usable only after a later Host implementation proves the exact
`local + demo_fast + FEAT-137 gate` matrix. Sandbox remains `read-only`; default, gate-off, and
non-local profiles remain `approvalPolicy=never`.

The only eligible Runtime request is stable `item/commandExecution/requestApproval` for:

- exact shell-joined command `git rev-parse --is-inside-work-tree`;
- exactly one Runtime `CommandAction::Unknown` containing the same command;
- canonical cwd equal to the Host-known workspace root;
- absent reason, network context, additional permission, exec-policy amendment, and network-policy
  amendment; Runtime approvalId may be absent or null only;
- absent/null environment identity or an exact Host-known local environment identity.

The outer Runtime request has exactly `id`, `method`, and `params`. Eligible params have exactly the
required identity/time/command/action/cwd fields plus optional `approvalId`, `environmentId`, and
ignored `availableDecisions`; every other top-level or params field fails closed even if a future
Runtime schema would otherwise tolerate it. Before fingerprinting or projection, `threadId` must
equal the session-bound Runtime thread, `turnId` the Host active Turn, and `itemId` the expected
Command Item. Any mismatch is cancelled once without a Desktop projection.

Runtime `availableDecisions` is experimental and may appear on actual wire even when omitted from the
stable generated schema. Host must tolerate and ignore it. It never widens the Yijie decision set.
Runtime RequestId, `startedAtMs`, nullable approvalId, command/actions, cwd, environment identity,
reason, network context, permissions, amendments, and raw wire remain in Host pending memory only.

Runtime response/replay authority identity is `(runtime_process_generation, exact-typed RequestId)`;
the Host owns one opaque generation token for each Runtime process lifecycle, independent of client
connection changes. The key is extracted only after exact outer-shape validation and before params
eligibility. Thread, Turn, and Item identities are binding/fingerprint fields, not additional key
parts. An identical replay reuses the same Host `approval_request_id`, revision, requested/deadline values, and remaining
TTL; it never creates another event or resets the clock. For same-key comparison, Host canonicalizes
the exact bound thread/turn/item, command/action, canonical workspace identity, absent/null approvalId to `none`, and
absent/null/exact-local environment identity to the same Host-local identity; `startedAtMs` remains
an exact integer fingerprint field while never becoming the TTL clock. Experimental
`availableDecisions` is excluded from the fingerprint. Same-key identity/fingerprint drift sends one
Runtime `cancel`, atomically resolves the existing pending approval as `resolved_elsewhere`, and
never emits a second requested projection. A distinct second request while the session already has
one pending is cancelled once without projection and leaves the original pending authority intact.
A new Runtime generation creates a new identity domain, so a
reused numeric RequestId cannot collide with the prior process.

## Event surface

V6 preserves every v5 event family and adds two non-terminal events bound to the existing
task/session/thread/turn/item envelope:

- `approval.requested`: Host-minted opaque `approval_request_id`, revision, fixed
  `action_id=git_repository_check`, fixed `workspace_scope=current_workspace`, fixed
  `decisions.primary=accept_once` and `decisions.secondary=cancel_current_turn`, requested/expiry timestamps, and
  `ttl_seconds=120`;
- `approval.resolved`: the same safe identity plus one closed outcome:
  `accepted_once | cancelled_current_turn | expired | resolved_elsewhere`.

Accepted/cancelled outcomes require a Desktop-minted `decision_id` and the matching closed decision.
Expired/resolved-elsewhere outcomes forbid decision fields. Approval events always have
`terminal=false`; only `turn.completed` is Turn-terminal. At-least-once replay is deduplicated by
`event_id`, but replay alone never re-enables an action. Phase-one requested/pending revision is
exactly 1 and resolved revision is exactly 2. Approval events forbid the generic envelope
`request_id`, preventing a Runtime JSON-RPC RequestId from entering the public event shape.

## Pending snapshot and one-shot decision

`GET /v6/agent-sessions/{agent_session_id}/approvals/pending` returns the current Host-generation
`stream_id`, snapshot time, and zero or one memory-only pending record. Empty is authoritative for
that Host generation. Each record repeats only safe opaque identities, fixed action/scope/decisions,
revision, and timing. A non-empty snapshot is valid only while revision is 1, its requested/expiry
timestamps are exactly 120 seconds apart, and `snapshot_at` is within the live interval.

`POST /v6/agent-sessions/{agent_session_id}/approvals/{approval_request_id}/decision` accepts a
closed body containing schema version 6, Desktop-minted `decision_id`, expected Host `stream_id`,
expected pending revision, and exactly one phase-one decision. First valid writer wins. An identical
idempotent retry may return its original response; a reused decision ID with different content returns
`approval_decision_conflict`. Desktop does not automatically retry an unknown transport result and
first reads the pending snapshot.

A 200 response echoes the exact path approval identity, Desktop `decision_id`, expected Host
`stream_id`, request decision, and revision 2. The decision/outcome pair is closed. Host returns 200
only after observing stable Runtime `serverRequest/resolved` for the exact Runtime generation,
RequestId, and thread. Otherwise it returns a closed error and Desktop reconciles by snapshot.
Wrong-generation, wrong-type/wrong-value RequestId, or wrong-thread notifications cannot acknowledge
the decision or permit HTTP 200. A duplicate matching notification is idempotent, and an
acknowledgement timeout returns the closed unavailable result without a 200 before snapshot
reconciliation.
Within the bounded 128-record resolved audit, an identical idempotent retry returns the identical
200 response and different content with the same decision ID returns
`approval_decision_conflict`. After eviction it returns `approval_not_found` and never reopens the
request.

Decision mapping is exact:

| Yijie decision/result | Runtime response | Meaning |
|---|---|---|
| `accept_once` / `accepted_once` | `{ "decision": "accept" }` | Execute this one Command in the existing read-only sandbox |
| `cancel_current_turn` / `cancelled_current_turn` | `{ "decision": "cancel" }` | Do not execute the Command; Runtime interrupts the Turn |
| TTL / `expired` | `{ "decision": "cancel" }` once, only if still pending | Fail closed and release the waiting reverse request |
| Runtime/Item/Turn cleanup / `resolved_elsewhere` | no further response | Authority already resolved the request |

Malformed response fallback and Runtime `decline` are not valid substitutes for Cancel: Runtime
would continue the Turn for decline. Host must closed-validate `accept` or `cancel` before responding.

## TTL, races, and stable errors

TTL is exactly 120 seconds from Host monotonic receive time; Runtime `startedAtMs` is not the TTL
clock. TTL, user decision, Runtime resolution, Item terminal, and Turn terminal participate in one
first-writer-wins state transition. TTL winning sends exactly one Runtime Cancel and resolves as
`expired`; authority cleanup winning resolves as `resolved_elsewhere` and sends nothing further.

The approval-specific closed errors are `unauthorized`, `invalid_approval_request`,
`approval_version_mismatch`, `session_not_found`, `approval_not_found`, `approval_stale`,
`approval_expired`, `approval_already_resolved`, `approval_decision_conflict`,
`approval_unavailable`, and `internal_error`. Each HTTP status references a narrower schema and every
code has one fixed content-free message; arbitrary text is not representable. There is no automatic
retry or Retry-After contract for decisions.

## Data and permission boundary

The new approval event, snapshot, decision, response, error, log, screenshot, persistence, safe-copy,
and audit surfaces forbid Runtime identity/time, raw command/actions, absolute cwd, environment
identity, reason, network context, permission or amendment payloads, `availableDecisions`, secrets,
and raw Runtime wire. This restriction does not remove inherited v5 fields from unrelated v6 events:
for example, `thread.started` still carries its bounded model/provider identity and Command events
still carry the existing safe summary and structured non-absolute cwd. Desktop localizes the fixed
approval `action_id`; arbitrary approval display text is not a wire field.

Pending data is Host memory-only, at most one record per session. Resolved content-free audit is an
implementation responsibility capped at 128 records per session and deleted with the session; it is
not a replay or action-authority API.

Generated Go/TypeScript types are transport conveniences, not validators. Consumers must apply the
JSON-equivalent closed decoder and the documented OpenAPI semantic invariants, including approval
time-window, snapshot, request/response correlation, enum, UUID, and Proto `UNSPECIFIED` rejection,
before apply, rendering, or persistence. The generated Go SDK keeps the established
`ClientInterface` and `ClientWithResponsesInterface` method sets exact for existing mocks/adapters;
v6 methods are opt-in through `ClientV6Interface` and `ClientWithResponsesV6Interface`.

## Compatibility, rollout, and rollback

The v1-v5 JSON/Proto sources and Runtime compatibility manifest are byte-identical to Contracts
baseline `87f94c9aa6d4848cb67aa8a1265bd21474edb0bb`. OpenAPI and AsyncAPI add isolated v6 surfaces
without changing older paths/channels/messages/operations. The package remains the unpublished
`0.7.0` candidate under the repository rule that an untagged candidate may accumulate reviewed
compatible revisions; exact commit and digest are mandatory for downstream consumption.

Rollout is Contracts immutable candidate → Host exact pin/closed mapper/pending authority → Desktop
exact pin/closed consumer → Host-to-Desktop conformance → separately authorized fresh real D4.
Consumer-first activation is mandatory. Rollback disables FEAT-137 and negotiates v5, restoring the
current `read-only/never` behavior without modifying Runtime.

FileChange/Diff, general permission approval, MCP elicitation, requestUserInput, decline-and-continue,
session/persistent approval, network/exec-policy amendment, write/network/sandbox escalation,
unsandboxed retry, Runtime changes, and public/production approval remain out of scope.
