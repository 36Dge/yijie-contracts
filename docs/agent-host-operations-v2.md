# Agent Host operations v2 contract candidate

Status: G2A source-contract candidate. It does not enable Host routes, invoke MiniMax, or authorize
Host/Desktop implementation.

## Ordered multimodal turns

`POST /v2/agent-sessions/{agent_session_id}/turns` accepts one ordered `content_blocks` array with
1..16 closed `text`, `image`, or `file` variants. The existing v1 turn remains text-only and unchanged.
Requests may contain no more than 10 attachment blocks. Each image or file is at most 10 MiB; decoded
image bytes across the turn are at most 10 MiB; and selected UTF-8 file context across the turn is at
most 256 KiB.

Images carry a canonical JPEG, PNG, WebP, or GIF data URL plus exact byte count and lowercase SHA-256.
Host decodes the data URL, verifies that header, byte count, and digest agree, maps it to Runtime image
input, and never persists the value. Files carry a safe display basename, canonical supported document
media type, Desktop-verified original byte count and digest, and 1..32 bounded text chunks. Raw file
bytes and local paths are not accepted; Host therefore cannot independently recompute a file digest and
treats those file fields only as correlation metadata. Context chunks become bounded Runtime text input
and are not written to Host persistence, replay, logs, metrics, or traces.

Desktop remains authoritative for attachment ownership, encrypted binary/index storage, readiness, and
seven-day expiry. The local bearer boundary, trace correlation fields, turn conflict semantics, accepted
response, and event delivery model match v1. Aggregate limits, cross-field data-URL verification, and the
maximum attachment count are semantic validations because OpenAPI 3.0 cannot express those relationships.

## Isolated title generation

`POST /v2/agent-sessions/{agent_session_id}/title-generations` accepts a Desktop-generated UUID
`operation_id`, optional correlation IDs, and only the first user text. Input is non-blank and capped at
8 KiB UTF-8. The Host uses the accepted `title-v1` flow in a pathless ephemeral Runtime thread, with no
tools or project access.

The synchronous success body is exactly `{operation_id,title}`. Title is NFC, one-line untrusted plain
text, 1..40 grapheme clusters, and contains no control/bidi control, HTML, or Markdown syntax. Prompt,
raw provider output, ephemeral thread ID, path, token, and provider error never enter the response or a
durable/logging surface.

The same operation and canonical input may return the process-local completed result. Reuse with
different input is `title_operation_conflict`. An unknown result never causes an automatic retry with a
new operation ID. Stable operation errors are `invalid_request`, `session_not_found`,
`title_operation_conflict`, `title_generation_unavailable`, and `title_output_invalid`; owner-only local
bearer failure remains `unauthorized`.

## Host-managed cleanup

`POST /v2/agent-sessions/{agent_session_id}/cleanup-operations` is one step in the Desktop deletion saga.
The request contains only a Desktop-generated UUID `operation_id` and optional correlation IDs. It does
not accept a Runtime thread ID, path, body, title, or reasoning text from Desktop.

The Host must reject an active or unconfirmed turn, verify that the session exclusively owns its Runtime
thread tree, confirm Runtime `thread/delete` response and deletion notification, then clear Host bbolt
mapping and in-memory replay. `200 complete` is legal only when these three surfaces are all complete:

- `runtime_thread_tree`;
- `host_mapping`;
- `host_replay`.

Any partial, blocked, or uncertain result is `409 cleanup_incomplete`, includes only content-free
per-surface status and a closed reason code, and remains retryable with the same operation ID. Reusing an
operation ID for a different target/canonical request is `cleanup_operation_conflict`.

To make a lost success response safely retryable after Host mapping deletion, Host retains a separate
content-free cleanup receipt for 30 days: operation ID, keyed session hash, surface outcomes, timestamps,
and schema version only. It contains no raw session/thread ID, body, title, reasoning, or path. A retry of
the same operation and target may return that completed result; an absent session with no matching receipt
remains `session_not_found`.

Host completion is not whole-session deletion. Desktop may show full success only after its SQLCipher
cascade and verified `wal_checkpoint(TRUNCATE)` also complete. Neither response promises erasure from
Runtime WAL/logs, APFS/SSD history, OS snapshots, or third-party backups.
