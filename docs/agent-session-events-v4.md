# Agent Session Events v4

`AgentSessionEventV4` is an explicitly negotiated local candidate. Its authoritative JSON wire is
`jsonschema/agent/session-event-v4.schema.json`; Protobuf v4 and AsyncAPI v4 are equivalent typed
projections. V1, v2, and v3 paths, packages, schema IDs, and closed unions remain separate.

## Negotiation, delivery, and ordering

- connect to `GET /v4/agent-sessions/{agent_session_id}/events` with
  `event_schema_version=4`;
- `after` is the only query cursor name; `Last-Event-ID` overrides `stream_id` and `after`;
- delivery is at least once, `sequence` is monotonic only inside one `stream_id`, and consumers
  deduplicate by `event_id`;
- only `turn.completed` has `terminal=true`; plan, item, reasoning, and artifact events are not turn
  terminals;
- v4 preserves all fourteen v3 event variants and adds only `turn.plan.updated`.

The Host does not synthesize Runtime correlation `turn_id`/`item_id`, plan-step identity, or reorder
source events. Runtime IDs remain the correlation authorities; Host still creates contract
`event_id`, `stream_id`, `sequence`, and explicitly specified sanitized projection-failure events.
A stream change uses the existing reconciliation path rather than silently merging ordering
domains.

## AgentMessage phase

For `item.started` and `item.completed`, an `agentMessage` payload is closed and requires:

- `item_type: "agentMessage"`;
- `text`, which may be the empty string at start;
- `phase: "commentary" | "final_answer" | null`.

`null` is the deterministic projection when the stable Runtime field is absent or unclassified.
Unknown strings are invalid. Non-AgentMessage lifecycle payloads cannot carry `phase`.
`item.agent_message.delta` remains `{ "delta": string }`; a consumer associates deltas with phase
through the matching lifecycle `item_id`. This avoids repeating mutable metadata on every chunk.

## Stable plan snapshots

`turn.plan.updated` requires `turn_id`, forbids `item_id`, and carries one complete authoritative
snapshot:

```json
{
  "explanation": "optional explanation",
  "plan": [
    { "step": "ordered display text", "status": "pending" }
  ]
}
```

The status union is `pending | in_progress | completed`. A higher-sequence snapshot atomically
replaces the earlier snapshot for the same turn; consumers must not merge steps by text. An empty
`plan` clears it. Missing or null `explanation` clears the prior explanation. No plan ID, step ID,
timestamp, progress percentage, or experimental `item/plan/delta` shape is invented.

The stable Runtime permits an empty step string. V4 preserves that fact instead of rejecting the
notification or inventing replacement step text. A consumer may render a fixed, content-missing
affordance, but it must retain the step ordinal/status and must not claim the placeholder came from
the model.

## Projection size and failure

The compact JSON value in one SSE `data` line is capped at 1 MiB UTF-8, as recorded by
`x-yijie-max-sse-data-utf8-bytes`. Structural JSON Schema validation alone is insufficient because
field and aggregate byte annotations require producer/consumer conformance checks.

The Host validates the mapped event before retention and write. It never truncates AgentMessage
text, a plan snapshot, or an authoritative lifecycle snapshot. Existing reasoning byte/item limits
retain their `reasoning_text.finalized / unavailable / limit_exceeded` result. For another
turn-scoped source notification that cannot fit structural, field-byte, or aggregate limits, Host:

1. rejects the source event without publishing any partial content;
2. publishes one same-turn, itemless, non-terminal `error` with `code=limit_exceeded`, the constant
   message `agent event exceeded local projection limit`, and `will_retry=false`;
3. marks the turn projection failed and eventually publishes `turn.completed` with
   `status=failed`, `code=limit_exceeded`, and the same constant message; when the rejected source
   is already the terminal notification, it publishes the sanitized failed terminal directly.

Rejected content never appears in the problem/terminal payload, logs, metrics, traces, audit, or
error bodies. This rule avoids both silent loss and oversized replay retention without changing or
terminating the Runtime process.

No-turn sources have explicit outcomes too. Host validates the managed model/provider identity
before retaining `thread.started`; a bound violation fails session start with sanitized HTTP
`500 internal_error` and emits no invalid thread event. A thread-scoped Runtime warning that cannot
fit the v4 warning bounds is replaced by one content-free `warning` with `code=limit_exceeded`, the
same constant message, and `will_retry=false`. It never receives an invented `turn_id` or terminal.

## Reasoning and content boundary

V4 preserves the bounded v3 reasoning delta/finalization and structured-artifact variants. Raw
reasoning projection is independently authorized by the Host exact-local Feature gate; selecting
v4 alone is not authorization to emit it. Prompt, reasoning, plan, and final-response body text
must not enter Host durable state, logs, metrics, traces, audit, or error bodies. Process-memory SSE
replay remains bounded by the existing Host rules. Desktop local conversation persistence remains
a separate product-owned authority.

## Runtime and activation boundary

The external Runtime remains `yijie-codex` commit
`0ce5902ed400866be0196886bb78f693a004d68d`, upstream `rust-v0.144.6`, with
`experimentalApi=false`. FEAT-134 consumes existing stable phase, plan, and raw-reasoning
notifications; it does not modify, upgrade, rebuild, replace, or patch the Runtime.

Production/public use is closed. Activation requires the exact `demo_fast/local` native Feature
gate after Host and Desktop both pin the immutable Contracts candidate. Provider reasoning effort
is a fixed Host policy for that profile and is deliberately absent from this wire and from UI.

## Conformance

Canonical synthetic fixtures live under `tests/fixtures/agent/session-event-v4`.
`tests/agent-session-events-v4.test.mjs` validates the phase closed union, null normalization, full
plan replacement/clear semantics, rejection of experimental shapes, v3 isolation, preservation of
reasoning/artifact variants, and JSON/Protobuf/OpenAPI/AsyncAPI/generator alignment.

Generated TypeScript declarations are compile-time convenience, not a runtime validator. In
particular, TypeScript cannot faithfully express JSON Schema's `item_type != "agentMessage"`
negative refinement and generates the non-AgentMessage discriminator as `string`. Host and Desktop
must therefore enforce the v4 JSON authority with a runtime validator or an explicit closed parser
covered by the canonical positive/negative fixtures; accepting the generated TS type alone is not
conformance.
