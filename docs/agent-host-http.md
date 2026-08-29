# Agent Host Local HTTP/SSE v1

`openapi/agent-host/agent-host.yaml` is the authoritative contract for the
Desktop Agent Host's loopback HTTP paths, authentication, JSON request/response
envelopes, status codes, response headers, and SSE framing.

## Ownership and boundary

- producer and owner: `yijie-agent-host` Desktop sidecar;
- consumers: Yijie Desktop and same-user local development clients;
- transport: HTTP/1.1-compatible loopback HTTP plus Server-Sent Events;
- trust boundary: `127.0.0.1` only; this contract is neither the Public API nor
  the Internal service-to-service API;
- Runtime compatibility: Runtime Baseline 2, Codex `0.144.6`, stable API,
  `experimentalApi=false`, managed stdio;
- content policy: Host persists recovery mappings and status, but not turn input,
  message deltas, completed messages, provider payloads, or HTTP bearer content.

`jsonschema/agent/session-event.schema.json` remains authoritative for the v1 JSON
object in each SSE `data` line. Each explicitly negotiated versioned stream points
to its matching `session-event-vN.schema.json`; an older path is never widened by a
newer schema. OpenAPI deliberately describes only the streaming wire framing and
points to the selected JSON authority. Protobuf is a typed transport projection for
non-HTTP consumers; it does not override JSON/SSE encoding or version-specific JSON
validity rules. In particular, a decodable v5 Proto3 message still requires the
JSON-equivalent semantic gate before apply or persistence.

## Authentication and parsing

`/healthz`, `/readyz`, and `/v1/status` are unauthenticated diagnostic endpoints.
The six session, turn, and event routes require `Authorization: Bearer <token>`.
Agent Host creates a 256-bit opaque token at
`$YIJIE_AGENT_HOST_HOME/api-token`; the file must be readable only by its owner.
The token must not be put in URLs, logs, frontend persistence, task payloads, or
contract examples.

JSON request bodies are required on all protected POST routes, including resume
and interrupt where `{}` is a valid body. They accept `application/json`, reject
unknown fields and trailing JSON values, and are capped at 1 MiB. `trace_id`,
`request_id`, `tenant_id`, and `user_id` are optional event-correlation data;
they are not proof of identity, tenancy, or authorization.

## SSE cursor and recovery

Each Agent session has one random `stream_id` per Host process. `sequence` starts
at one and increases strictly within that stream. A data frame uses
`id: <stream_id>:<sequence>`, `event: <event_type>`, and one compact JSON `data`
line. The response also returns `X-Yijie-Event-Stream-ID`. A `: heartbeat` comment
is emitted every 15 seconds without an event.

Reconnect with `Last-Event-ID`; it overrides `stream_id` and `after` query
parameters. Without the header, `after > 0` requires a matching `stream_id`.
Desktop Host retains at most 512 events in process memory and does not persist
them. A cursor older than that window returns `409 event_replay_unavailable`; an
old process stream returns `409 event_stream_changed`. In either case the client
must reconcile `GET /v1/agent-sessions/{agent_session_id}` and explicitly resume
the Runtime thread when needed. It must not silently skip the gap.

Replay plus reconnect is at-least-once delivery. Consumers commit a cursor only
after processing its event and deduplicate by `event_id`. Slow subscribers may be
disconnected to protect the Runtime read path and should reconnect from their
last committed event ID.

## Failure semantics

All JSON failures use `{ "error": { "code": "...", "message": "..." } }` and
`Cache-Control: no-store`. `400` covers malformed bodies, identifiers, operation
arguments, or cursors; `401` covers the local bearer; `404` covers a missing
session; `409` is a lifecycle or replay conflict; `502` means a managed Runtime
request failed; `500` is a sanitized Host failure. Raw provider errors, stack
traces, filesystem paths, and secrets are never part of this envelope.

`turn.completed` is the only authoritative turn terminal event. A successful
`204` interrupt only confirms delivery of the interrupt request; clients still
wait for the terminal SSE event.

FEAT-126 v2 title, cleanup, and explicitly negotiated raw-reasoning stream shapes
are an unpublished G2A candidate, not part of this supported v1 contract. See
[`agent-host-operations-v2.md`](agent-host-operations-v2.md) and
[`agent-session-events-v2.md`](agent-session-events-v2.md); no v2 route is enabled
or consumable until an immutable candidate pin and the required approvals exist.

FEAT-134 v4 AgentMessage phase and stable plan snapshots are likewise an unpublished,
exact-local candidate. V4 is available only through its own path and required schema-version
guard; it does not widen the supported v1 stream or enable a public/production listener. See
[`agent-session-events-v4.md`](agent-session-events-v4.md).

FEAT-136 v5 Command/Tool projection is also an unpublished exact-local candidate.
It is available only through `GET /v5/agent-sessions/{agent_session_id}/events`
with required `event_schema_version=5`. V5 keeps the established session/thread/
turn/item identity and replay envelope, reuses typed `item.started` and
`item.completed` snapshots, and adds bounded `item.command_output.delta` and
`item.tool.progress`. Consumers deduplicate at-least-once delivery by `event_id`,
not content; completed is the Item reconciliation authority, while only
`turn.completed` is Turn-terminal.

The v5 contract permits only sanitized display summaries, structured relative or
redacted cwd, stable statuses/errors, explicit truncation, and bounded output/
progress/result data. Missing Command output has an explicit unavailable branch;
unknown Tool identity uses fixed sentinels; generic Item kinds use a closed stable
allowlist. A conforming Host must never carry raw Runtime command, absolute cwd,
Tool arguments/result/meta/context, token, secret, or raw wire. Schema validation
does not prove arbitrary allowed text was sanitized, so the actual Host sanitizer
and conformance remain next-batch work. V5 does not register a Tool, enable an
experimental API, add an approval action, or widen Runtime sandbox or permissions.
FileChange/Diff remain excluded and Artifact remains independently governed. See
[`agent-session-events-v5.md`](agent-session-events-v5.md).
