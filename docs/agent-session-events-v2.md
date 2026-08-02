# Agent Session Events v2 contract candidate

Status: G2A source-contract candidate. It does not authorize Host or Desktop implementation.

## Authority and negotiation

The JSON Schema `jsonschema/agent/session-event-v2.schema.json` is authoritative for JSON/SSE. Protobuf
`yijie.events.v2.AgentSessionEvent` carries the equivalent typed service/event model, and AsyncAPI points
to the JSON authority instead of copying its union.

Consumers explicitly call `/v2/agent-sessions/{agent_session_id}/events?event_schema_version=2`. The v1
path and its closed eight-variant `schema_version=1` union remain unchanged. Host v2 production stays off
until a v2-capable Desktop consumer is pinned and conformance passes.

## Raw reasoning variants

V2 preserves all v1 lifecycle variants at `schema_version=2` and adds exactly:

| Event | Context | Payload | Durable meaning |
| --- | --- | --- | --- |
| `item.reasoning_text.delta` | `turn_id`, `item_id` | `{content_index, delta}` | Low-latency in-memory display only |
| `item.reasoning_text.finalized` | `turn_id`, `item_id` | `{status, contents, reason_code?}` | Authoritative completed/incomplete/unavailable item snapshot |

`finalized.contents` replaces, rather than appends to, the accumulated delta buffer. `complete` requires
non-empty contents and no reason. `incomplete` requires a non-empty verified prefix and a reason.
`unavailable` requires empty contents and a reason. A v2 turn that reaches `turn.completed` with zero
reasoning items is represented by Desktop turn metadata as `unavailable/reasoning_not_emitted`; it does
not invent an item ID or raw body.

Reason codes are closed: `reasoning_not_emitted`, `turn_interrupted`, `stream_gap`, `runtime_error`,
`limit_exceeded`, `protocol_error`, and `host_shutdown`.

## Capacity and ordering

- 16 KiB UTF-8 per delta;
- 64 KiB UTF-8 per content part;
- 8 contiguous, zero-based, ascending, unique parts and 128 KiB UTF-8 per item;
- 8 reasoning items and 256 KiB UTF-8 per turn;
- existing Host hard limit of 1 MiB per event.

Standard JSON Schema length is not a UTF-8 byte counter. `x-yijie-*` keywords carry the byte/aggregate
rules for generators and conformance; producers and consumers must enforce them before accepting or
persisting data. Over-limit data becomes explicit `limit_exceeded`/Gate failure and is never silently
truncated.

Delivery remains at least once. Consumers deduplicate by `event_id`, validate monotonic `sequence` only
inside one `stream_id`, and aggregate by `(turn_id,item_id,content_index)`. A future unknown event may
advance the delivery cursor after a content-free metric, but cannot advance business terminal state,
create content, or execute an action.

## Confidentiality and persistence boundary

Host may aggregate and retain bounded replay raw text only in process memory. It must not write the body
to bbolt, any durable replay store, logs, metrics, traces, audit, error bodies, or cloud storage. Desktop
displays raw text as untrusted plain text. Delta remains in memory; only finalized or
controlled-interruption state may enter the approved SQLCipher transaction. Session deletion cascades
the Desktop records under the separately accepted delete/checkpoint boundary.
