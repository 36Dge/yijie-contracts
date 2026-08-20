# Agent Session Events v3

`AgentSessionEventV3` is an explicitly negotiated additive surface. Its authoritative JSON
wire is `jsonschema/agent/session-event-v3.schema.json`; Protobuf and AsyncAPI are equivalent
service/consumer projections. V1 and v2 paths and schemas remain unchanged.

## Negotiation and ordering

- connect to `GET /v3/agent-sessions/{agent_session_id}/events` with
  `event_schema_version=3`;
- `after` is the only query cursor name; `after_sequence` is invalid;
- `Last-Event-ID: <stream_id>:<sequence>` overrides `stream_id` and `after`;
- delivery is at least once, sequence is monotonic only inside one `stream_id`, and consumers
  deduplicate by `event_id`;
- only `turn.completed` is turn-terminal. Artifact completed/failed events have
  `terminal=false`.

V3 preserves every v2 lifecycle and reasoning event and adds:

1. `item.artifact.started`;
2. zero or more `item.artifact.progress` events carrying a real stage and/or percentage;
3. exactly one `item.artifact.completed` or `item.artifact.failed` terminal for that artifact.

The stream-level ordering rule is `(agent_session_id, turn_id, artifact_id)`: started precedes
progress and one terminal; percentages do not regress; events after the artifact terminal are
protocol errors. Resync uses the SSE cursor rules rather than a public Host history endpoint.

## Artifact payload boundary

The closed kind union is `image | video | file | report`. Every payload carries a Host-generated
UUID `artifact_id`, kind, provenance, and status. Completed events additionally require MIME,
byte size, lowercase SHA-256, and an owner-only relative `content_href`; video may also carry a
relative `poster_href`.

The wire never carries bytes, base64, an absolute path, a bearer, provider raw output, or an
arbitrary URL. Image content is capped at 20 MiB; all other kinds are capped at 64 MiB. The
relative references are scoped to the same v3 session/artifact resources. Consumers must also
verify that both identifiers inside each href equal the surrounding event identifiers before
fetching.

`provenance=synthetic` is enabled only by the exact-local conformance profile. The schema reserves
`provider` and `tool` values for a future reviewed producer, but the 0.4.0 candidate does not
authorize those producers or any paid/network generation.

## Failure and cancellation

Failed artifacts expose only a stable error code, retryability, and optional sanitized message.
They have no content/poster href. Cancellation is the existing turn-level interrupt: an artifact
affected by interruption maps to `turn_interrupted`; v3 defines no artifact-specific cancel
operation or UI control.

## Conformance fixtures

Canonical local fixtures live under `tests/fixtures/agent/session-event-v3`. They cover all four
kinds plus started/progress/completed/failed paths. `tests/structured-artifacts-v3.test.mjs`
validates version isolation, closed enums, relative-only hrefs, byte caps, cross-format symbols,
and preservation of the v2 variants.
