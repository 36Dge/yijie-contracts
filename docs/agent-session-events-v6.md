# Agent session events and approvals v6

Status: FEAT-137 deterministic-D4-producer candidate on the unpublished `0.7.0` package. Reviewed Host and
Desktop candidates exist, but this revised source must be immutably frozen and exactly repinned
before cross-repository conformance or a fresh D4. It is not tagged/pushed/published or enabled for
any public or production entrypoint.

## Authority and impact

`contract-impact = semantic`. V5 is a closed event union, so approval is added only through explicit
v6 negotiation. The authorities are:

- JSON/SSE validity: `jsonschema/agent/session-event-v6.schema.json`;
- typed transport projection: `protobuf/yijie/events/v6/agent_session.proto`, subject to the JSON-
  equivalent semantic gate;
- HTTP framing, pending snapshot, and decision API: `openapi/agent-host/agent-host.yaml`;
- asynchronous consumer projection: `asyncapi/events.yaml` v6 channel/message/operation;
- external Runtime request/response source: provisional pre-repair `yijie-codex` pin
  `9ed24710d73f22a9b269092b8cdf2225199ea222`, tree
  `984e0f5bb48aaa953ed3a329614d00e5905514fb`, version `0.144.6`, stable API,
  `experimentalApi=false`. This pin and its artifact digests are placeholders until the final clean
  Runtime repair is frozen and v4 is repinned; they are not current immutable authority.

Producer is `yijie-agent-host`; known consumer is `yijie-desktop`. The Host is the only Runtime
mapper and pending/decision authority. Desktop never responds directly to Runtime and never restores
an actionable pending request from SQLCipher or replayed SSE history.

The existing `compatibility/agent-host-runtime-v1.json` remains byte-identical and continues to
describe the default `read-only/never` Host projection. V6 separately activates `on-request` only
inside the exact local/demo_fast FEAT-134/136/137 gate.

The separate `compatibility/agent-host-runtime-approval-v6-v4.json` is the machine-readable source for
the repaired producer and mapper. The original `agent-host-runtime-approval-v6.json`, v2 and v3
projections, and their schemas remain
byte-identical as the superseded source-first compatibility record, so the unpublished candidate
does not narrow an existing schema. V4 retains v3 stable `sandboxPermissions` provenance and adds
only the default-off deterministic D4 producer composition. Response mapping, public v6 payload/API
shape, raw-field exclusions, and stable `serverRequest/resolved` acknowledgement remain unchanged.
The acknowledgement requires Runtime `requestId` and `threadId`; Host additionally binds the
notification to the same Runtime process generation and compares RequestId by exact JSON type and
value. A normal connection change within that process does not create a new identity generation.

## Candidate phase-one policy (PENDING Runtime freeze)

V6 approval is usable only after Host/Desktop exact-pin conformance proves the
`local + demo_fast + FEAT-134 + FEAT-136 + FEAT-137` gate matrix. Sandbox remains `read-only`;
default, gate-off, and non-local profiles remain `approvalPolicy=never`.

The deterministic producer composes the pinned Runtime's existing exec-policy `Prompt` mechanism
with two default-off process gates. Host accepts
`YIJIE_FEAT137_D4_DETERMINISTIC_PRODUCER_ENABLED=true` only after exact
local/demo_fast FEAT-134/136/137 activation, strips ambient values, and injects child-only
`YIJIE_FEAT137_DETERMINISTIC_APPROVAL_PRODUCER=1` exactly once. Runtime gate-on exposes only one
strict, closed, zero-argument `exec_command` on the first sampling step, forces
`tool_choice=required` and `parallel_tool_calls=false`, ignores Provider arguments, and constructs
the fixed `use_default` action. After the first call, Runtime disables sampling, exposes no tools,
and permits zero additional Provider requests for that TurnContext.
Gate-off preserves the ordinary tools, `tool_choice=auto`, parallel setting, and Provider arguments
byte-for-byte.

The candidate also closes the managed Runtime surface before any contributor can widen it. Its
exact MiniMax config disables `hooks`, `plugins`, `apps`, `tool_suggest`, and `shell_snapshot`;
Runtime additionally prevents hook/plugin discovery and plugin hooks, returns an empty MCP
composition before extension contributors are invoked, exposes zero configured/runtime/effective
MCP servers and connector projections, and creates no shell snapshot. Request and stream retries are
both exactly zero, automatic 401 recovery is disabled and produces zero Provider requests, and all
four constraints are revalidated with the closed managed config immediately before Runtime spawn.
These Provider retry/recovery limits are distinct from the already-closed decision POST rule, which
also has no automatic retry.

Remote-control closure is layered. The private Runtime gate is self-contained authority and forces
`DisabledEphemeral` before initialize can resolve authentication, database state, or a persisted
remote WebSocket preference. As defense in depth, Host strips ambient
`CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED`, injects its only accepted value `1` exactly once
into the exact D4 Runtime child, Runtime removes it after reading, and every spawned Command child
scrubs it. Gate-off never injects this variable and retains the historical remote-control path.

Gate-on provider transport logging is content-free for SSE and WebSocket data, payload telemetry
callbacks are suppressed, and only content-free lifecycle telemetry remains. Raw tool-input deltas
are not published; the admitted materialized item is replaced with the fixed Runtime-owned
projection before `items_added`, LastResponse, rollout/session history, hooks, OTEL, or dispatch.
Each response stream admits exactly one canonical plain `exec_command` Done with a nonempty call ID,
while a turn-global compare-and-swap admits only one Provider request for the whole TurnContext,
including steer/follow-up reuse. Empty IDs, namespaced/hidden/duplicate/non-command tool-like items
fail closed; a post-tool or second-stream completion cannot start a follow-up request. Provider
terminal and handler terminal each require the exact admitted lifecycle, and a fatal boundary
returns before an unpolled tool future can request approval or run.

The private Runtime gate is checked before prewarm, authentication, or TurnContext construction may
produce side effects; each of those startup producer side-effect counts is exactly zero. Across the
entire gate-on TurnContext, including steer/follow-up reuse, Provider requests are exactly one and
have a hard maximum of one. Automatic pre-sampling compaction is disabled and creates zero requests;
post-tool final-answer sampling is disabled and creates zero requests; automatic 401 recovery is
also disabled and creates zero requests; follow-up Provider requests are zero. With the gate off,
startup behavior, Provider request cardinality, post-tool sampling, 401 recovery, historical managed
config bytes, provider
tools/choice/parallel/arguments/output items, process environment and argv/shell behavior, extension
contributors, transport logs/telemetry, automatic compaction, public v6/stable schemas, permissions,
and approval decisions all retain their ordinary behavior.

Host also manages an exact `rules/default.rules` entry only inside the authority gate for argv
`["git", "rev-parse", "--is-inside-work-tree"]`, with `sandbox_permissions=use_default` and no
sandbox override. Its fixed justification is `Confirm the one read-only repository check.`; the
load-time match example is the exact argv and non-match examples are `git status` and
`git show HEAD`. This producer does not elevate permissions, request `require_escalated`, or widen
the Host command allowlist. Runtime `prefix_rule` matching is prefix-based; `match/not_match` are
rule-load examples, not runtime exact-match enforcement. Exact authority is layered: Runtime first
performs the turn-scoped atomic admission and pre-sink fixed replacement; Host then applies the
closed wrapper plus exactly-one `CommandAction` allowlist and must cancel any trailing-argument or
otherwise widened request. Neither gate is a public or production entrypoint.

The only eligible Runtime request is stable `item/commandExecution/requestApproval` for:

- exact pinned macOS transport string
  `/bin/zsh -lc 'git rev-parse --is-inside-work-tree'`;
- exactly one Runtime `CommandAction::Unknown` containing
  `git rev-parse --is-inside-work-tree`; this action is the sole business authority and the shell
  wrapper is non-authoritative transport presentation;
- canonical cwd equal to the Host-known workspace root;
- absent/null reason, or a valid UTF-8 reason bounded to 512 bytes with NUL forbidden; Host validates
  it and immediately discards it before fingerprinting, logging, storage, projection, or errors;
- absent network context, additional permission, exec-policy amendment, and network-policy
  amendment; Runtime approvalId may be absent or null only;
- present environment identity exactly equal to `local`.
- present stable `sandboxPermissions` exactly equal to `use_default`; `require_escalated`,
  `with_additional_permissions`, unknown, or missing values are cancelled once without Desktop
  projection.

The outer Runtime request has exactly `id`, `method`, and `params`. Eligible params have exactly the
required identity/time/command/action/cwd/`sandboxPermissions` fields plus schema-optional `approvalId`, `environmentId`,
bounded `reason`, and ignored `availableDecisions`. Eligibility further requires the actual pinned
wire's `environmentId=local`; every other top-level or params field fails closed even if a future
Runtime schema would otherwise tolerate it. Before fingerprinting or projection, `threadId` must
equal the session-bound Runtime thread, `turnId` the Host active Turn, and `itemId` the expected
Command Item. Any mismatch is cancelled once without a Desktop projection.

Runtime `availableDecisions` is experimental and may appear on actual wire even when omitted from the
stable generated schema. Host must tolerate and ignore it. It never widens the Yijie decision set.
Runtime RequestId, `startedAtMs`, nullable approvalId, normalized action authority, cwd and
environment identity remain in Host pending memory only. The wrapper and reason are validated then
discarded; network context, permissions, amendments, and unknown raw fields are rejected.

Runtime response/replay authority identity is `(runtime_process_generation, exact-typed RequestId)`;
the Host owns one opaque generation token for each Runtime process lifecycle, independent of client
connection changes. The key is extracted only after exact outer-shape validation and before params
eligibility. Thread, Turn, and Item identities are binding/fingerprint fields, not additional key
parts. An identical replay reuses the same Host `approval_request_id`, revision, requested/deadline values, and remaining
TTL; it never creates another event or resets the clock. For same-key comparison, Host canonicalizes
the exact bound thread/turn/item, the normalized single command action, canonical workspace identity, absent/null approvalId to `none`, and
exact `local` environment identity and exact `use_default` sandbox provenance; `startedAtMs` remains
an exact integer fingerprint field while never becoming the TTL clock. Experimental
`availableDecisions` and validated `reason` are excluded from the fingerprint. A changed or widened
`sandboxPermissions` value is not equivalent replay. Same-key identity/fingerprint drift sends one
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

The v4 managed-surface, confidentiality, compaction, retry, layered-admission, and gate-off clauses
remain `PENDING` until a clean final Runtime commit/tree and stable artifact replace the provisional
pins and the freeze-required checks pass. Final evidence must run the focused compatibility suite
with `YIJIE_REQUIRE_FEAT137_RUNTIME_ARTIFACT=1`; in that mode a missing Runtime binary or artifact
manifest is a failure rather than an optional skip.

Rollout is final Runtime immutable freeze → revised Contracts immutable candidate → Host exact pin/closed mapper/pending authority → Desktop
exact pin/closed consumer → Host-to-Desktop conformance → separately authorized fresh real D4.
Consumer-first activation is mandatory. Rollback disables FEAT-137 and negotiates v5, restoring the
current `read-only/never` behavior without modifying Runtime.

FileChange/Diff, general permission approval, MCP elicitation, requestUserInput, decline-and-continue,
session/persistent approval, network/exec-policy amendment, write/network/sandbox escalation,
unsandboxed retry, Runtime changes, and public/production approval remain out of scope.
