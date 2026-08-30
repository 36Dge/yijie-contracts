# Agent Session Events v5

`AgentSessionEventV5` is the explicitly negotiated FEAT-136 local candidate. Its authoritative JSON
wire is `jsonschema/agent/session-event-v5.schema.json`; AsyncAPI v5 references that authority, and
Protobuf v5 is a typed transport projection subject to the same semantic validation. V1 through v4
paths, schema IDs, packages, and unions remain separate and valid.
V5 carries the named v4 event families, closes the generic Item branch to a stable allowlist, and is
not emitted unless a consumer selects the v5 path and schema-version guard.

## Scope and authority

V5 specifies a bounded, sanitized Command and generic Tool presentation boundary for the existing
Agent session stream. It does not forward Runtime `ThreadItem` JSON. A conforming Host must map only
fields expressly allowed by the v5 JSON Schema, and Desktop must validate that projection before
persistence or rendering. This Contracts slice defines that obligation; it does not implement or
prove the Host sanitizer.

- Host produces the normalized HTTP/SSE stream; Desktop is the known consumer.
- The pinned Codex app-server schema remains the external Runtime protocol authority.
- JSON Schema is authoritative for payload validity. Proto3 encoding alone is not a validator and
  does not authorize a wider event; a Protobuf adapter must apply the JSON-equivalent semantic gate.
- Command is FEAT-136's required capability. Tool is a provider-neutral contract surface whose real
  activation remains blocked until an Owner-approved Tool is registered and observed.

## Negotiation, identity, and replay

- connect to `GET /v5/agent-sessions/{agent_session_id}/events` with
  `event_schema_version=5`;
- the existing `after`, `stream_id`, and `Last-Event-ID` rules are unchanged;
- `task_id`, `agent_session_id`, `codex_thread_id`, `turn_id`, and `item_id` retain their existing
  authorities and correlation meanings;
- delivery is at least once, and `sequence` is monotonic only inside one `stream_id`;
- consumers deduplicate by `event_id`, never by output, progress, argument, or result text;
- two different events containing identical text are both valid and must both be applied.

The same `item_id` binds the typed started snapshot, zero or more deltas/progress events, and the
typed completed snapshot. `item.completed` is the authoritative Item seal. A normal `error` remains
non-terminal and cannot complete an Item or Turn. Only `turn.completed` has `terminal=true`.

## Command projection

Command started and completed payloads are closed typed snapshots. The started payload requires
`item_type=commandExecution`, `status=running`, `command_summary`, and `cwd`. The completed payload
requires the same safe display fields, `status=completed|failed|declined`, and an authoritative
`output` union; `duration_ms`, `exit_code`, and `error` are present only when applicable. The
allowlist is limited to:

- the normalized Command kind and lifecycle status;
- a sanitized display summary rather than the Runtime command string;
- a structured workspace-root, workspace-relative, or redacted working-directory projection;
- bounded sanitized output;
- duration, exit code, truncation metadata, and a stable sanitized error code/summary where applicable.

The Command status set is `running | completed | failed | declined`. Status comes from the
authoritative lifecycle snapshot; consumers must not infer success from output wording or infer a
Turn terminal from Command failure. Completed duplicates the safe display identity and contains the
authoritative bounded output snapshot so hydration does not depend on replaying every live delta.
The closed Command error codes are `command_failed | command_declined |
projection_limit_exceeded | projection_redaction_failed | protocol_error`.

V5 adds `item.command_output.delta`, correlated by `item_id`, with only `delta`, `truncated`, and an
applicable `truncation_reason`. The projected delta must fit at a valid UTF-8 boundary; any source
content not represented is reported by the truncation fields. Replayed events are removed by
`event_id`; equal text with distinct event identities is appended twice.

The projection never carries the Runtime raw command, canonical/absolute `cwd`, process ID, command
source, parsed command actions, raw aggregate, terminal input, approval request, or raw wire object.

## Generic Tool projection

Tool started and completed payloads are likewise closed snapshots. Both use
`item_type=mcpToolCall`, `identity={ resolution, server_name, tool_name }`, and
`arguments_summary`. Started requires `status=in_progress`; completed closes to
`completed|failed|declined` and may add `duration_ms`, `result_summary`, or `error` according to the
status mapping below. They contain only:

- the generic Tool kind, lifecycle status, and known/unknown presentation marker;
- sanitized server and Tool display identities;
- bounded sanitized argument and result summaries;
- duration, truncation metadata, and a stable sanitized error code/summary where applicable.

V5 adds `item.tool.progress` with `item_type=mcpToolCall`, `status=in_progress`, the safe identity,
zero-based `progress_index`, and a bounded `summary`. Progress is descriptive text only: it does not
invent a percentage, authorize a retry, invoke a Tool, or register an MCP server or Connector.
Unknown Tools use the same generic card contract with `identity.resolution=unknown` and fixed
`server_name=unknown`, `tool_name=unknown` sentinels; source labels are not retained. They do not
expose raw fields, block unrelated Items, or manufacture a Turn terminal.

For the pinned Runtime's stable producer, `completed` carries the bounded safe result summary.
`failed` has two mappings: an MCP result with `is_error=true` retains an optional bounded safe result
summary and also receives a normalized stable Tool error; a transport/invocation error has no result
summary and receives the normalized stable Tool error. The projection never substitutes the raw MCP
result or raw error text for that error.

The Runtime's stable `McpToolCallStatus` currently contains only
`inProgress | completed | failed`. V5 reserves Yijie's normalized `declined` Tool result for a future
approved producer, but the fixed Runtime has no stable real producer for that value. A synthetic
contract fixture proves only parser behavior. It is not evidence that Tool decline or any real Tool
is available. The closed Tool error codes are `tool_failed | tool_declined | unknown_tool |
projection_limit_exceeded | projection_redaction_failed | protocol_error`.

The projection excludes raw arguments, MCP content blocks, structured result, `_meta`, application
context, resource/link/template/plugin/connector identity, platform token, raw error, and Runtime
wire JSON.

## Frozen bounds and truncation

All limits are UTF-8 byte limits. Redaction happens before byte counting and truncation. Truncation
always sets an explicit flag and closed reason; it is never silent. The SSE limit measures the UTF-8
bytes of the compact JSON value placed in one `data` field. The structured cwd aggregate includes
one `/` byte between adjacent safe segments.

These explicit Command/Tool summary and output shapes are the only new bounded-truncation surfaces.
Inherited AgentMessage, plan, Artifact, problem, and other v4 projection-overflow behavior remains
unchanged; reasoning retains its separate finalized-unavailable policy.

| Surface | Limit and policy |
|---|---|
| One compact JSON SSE `data` value | 1 MiB, measured after projection |
| Command display summary | 4 KiB |
| Structured working-directory projection | 1 KiB total |
| Command output delta | 16 KiB |
| Command completed output | 256 KiB; on overflow retain up to the first 128 KiB and last 128 KiB at UTF-8 boundaries |
| Tool server display identity | 256 B |
| Tool display identity | 256 B |
| Tool argument summary | 8 KiB |
| One Tool progress summary | 4 KiB |
| Tool progress per Item | at most 32 events and 64 KiB total |
| Tool result summary | 64 KiB |
| Sanitized error summary | 4 KiB |

Every bounded summary is `{ text, truncated, truncation_reason? }`, where a true `truncated` requires
`truncation_reason=utf8_byte_limit|upstream_truncated` and a false value forbids the reason. Command
completed output is one of `{ retention: complete, text, truncated: false }`,
`{ retention: head_tail, head, tail, truncated: true, truncation_reason }`, or
`{ retention: unavailable, reason: not_available, truncated: false }`. The unavailable branch maps
a nullable/missing Runtime `aggregatedOutput`; a mapper must not invent an empty authoritative
output string.

For Command output overflow, the completed snapshot is the reconciliation authority for the retained
head/tail representation. Live consumers may display received deltas while running, but must replace
their derived aggregate with the completed snapshot when it arrives. Tool arguments, progress, and
result use their own bounded summaries. Command/Tool error is a closed stable `code` plus sanitized
`summary`; raw source content is not a fallback.

## Redaction and failure behavior

The contract requires the Host to remove secrets, bearer values, tokens, raw Tool values, and
absolute/canonical paths before projection. Working directory is represented structurally as
workspace root, safe relative segments, or a redacted sentinel; `.`/`..`, slash-bearing segments,
drive-qualified paths, control/bidi characters, Windows device names, trailing spaces/dots, and
absolute paths are not Desktop-facing values. If a source cannot be represented safely, Host must
emit only a stable, sanitized projection error outcome and never echo rejected content.

JSON Schema can close fields, identities, states, and path shapes, but it cannot prove that arbitrary
text inside an allowed summary has been sanitized. Actual secret/path/content redaction is therefore
a mandatory Host conformance obligation for the next batch, not a Contracts PASS claim.

An unknown Runtime Item/event variant is not coerced into Command, Tool, Artifact, or another known
payload. The generic lifecycle branch accepts only `userMessage`, `hookPrompt`, `reasoning`,
`collabAgentToolCall`, `subAgentActivity`, `webSearch`, `imageView`, `sleep`, `imageGeneration`,
`enteredReviewMode`, `exitedReviewMode`, and `contextCompaction`. Host fails closed for any other
source; a v5 consumer discards an unknown wire variant and enters its existing reconciliation path
rather than crashing or guessing. This fail-soft consumer behavior does not make an unknown shape
valid under the closed v5 schema.

## Persistence and hydration

Desktop's minimum durable Item state is the approved session/thread/turn/item identity, kind, sealed
lifecycle status, safe display identity, completed duration/exit/error fields, bounded summary or
output snapshot, safe cwd/unknown markers, truncation metadata, and the event identity/cursor used to
commit it.
Raw deltas, raw Runtime objects, absolute paths, command strings, Tool arguments/results, and secrets
are not persistence authorities.

On hydration, one sealed completed snapshot represents one Item. Historical deltas do not create a
second Item, and replay of the same `event_id` does not append content again. A later conflicting
event after a sealed Item is a protocol/reconciliation condition, not permission to reopen it.

## Protobuf semantic gate

The v5 Protobuf package is a typed transport projection, not an independent validity authority.
Proto3 permits unset message/oneof fields, unrecognized enum numbers, and scalar values beyond JSON
caps. Before a Protobuf event is applied, rendered, or persisted, its adapter must reject every shape
that the authoritative v5 JSON Schema rejects, including:

- unspecified or unrecognized event, generic Item, lifecycle status, error, truncation, cwd, output,
  and identity enum values;
- unset Command output or Tool identity oneofs;
- started/progress payloads carrying a terminal status, or completed payloads carrying a running/
  in-progress status;
- Tool `progress_index` above 31, duration above the JSON safe-integer ceiling, or other scalar/UTF-8/
  aggregate/SSE limit violations;
- Command completed without its output union, and Tool completed/failed/declined with a missing or
  status-incompatible result/error combination.

An implementation may validate an equivalent closed native model instead of serializing through
JSON, but it must pass the same positive and negative conformance cases. Receiving syntactically
decodable Protobuf is never sufficient authority to create or mutate Desktop state.

## Explicit exclusions

V5 defines no FileChange, Diff, patch, file approval, Command approval action, write gate, shell or
filesystem permission, new MCP/Connector registration, experimental API, or real Tool producer.
Artifact lifecycle and resources remain governed by the existing v3/v4 Artifact authority and are not
embedded in a Command or Tool result.

## Runtime and activation boundary

Runtime is pinned to `yijie-codex@b2b20e2fc4a0c94834f34d8cc459e488a1b56277`, upstream
`rust-v0.144.6`, version `0.144.6`, with `experimentalApi=false`. Its stable schema set remains 267
files with tree SHA-256
`82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`.
The exact Runtime overlay order is FEAT-126 `0001` followed by Owner-authorized FEAT-136 `0002`.
`0002` supplies the missing canonical same-identity started/failed completed pair on final early
sandbox denial while preserving exit code, duration, aggregate and the original error. It does not
change retry/approval, `approvalPolicy=never`, `sandbox=read-only`, experimental API, or Tool
production. A fresh isolated build confirmed that this semantic lifecycle repair makes no stable
Schema shape change.

The contract candidate is restricted to the exact `demo_fast/local` Feature gate. Contracts fixtures
use synthetic, non-sensitive examples and do not by themselves validate Host sanitization. Reviewed
Host/Desktop drafts have separate failed-lifecycle tests, but exact repin and fresh cross-repository
conformance remain required. A fresh real Runtime Command vertical, Tool availability, and D4 are not
established by this contract.

## Conformance

Canonical synthetic fixtures live under `tests/fixtures/agent/session-event-v5`. The v5 conformance
suite covers typed Command/Tool started and completed snapshots, output/progress, failed/declined
outcomes, event-identity replay, legitimate repeated text, UTF-8 and compact-SSE bounds, truncation,
completed reconciliation, fixed unknown Tool identity, unknown variant handling, the normative
redaction policy, v1-v4 isolation, and cross-format alignment. It verifies that the legacy open
generic Item branch remains v4-only and that v5 uses a closed stable allowlist. The absence of
excluded FileChange/Diff/approval variants is established by static closed allowlist inspection; no
excluded-capability fixture or producer is created. Actual Host content sanitization is a separate
producer-conformance responsibility and is not proven by these Contracts fixtures.

Generated TypeScript declarations are compile-time convenience and are not a runtime validator.
Host and Desktop must use the v5 JSON authority or an explicit closed parser with the same positive
and negative conformance behavior.
