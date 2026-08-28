# Contracts v0.6.0 candidate

Status: FEAT-134 exact-local candidate; not tagged, pushed, published, deployed, promoted to a
supported baseline, or enabled for public/production.

## Impact, authorities, and ownership

`contract-impact = semantic`.

- JSON/SSE authority: `jsonschema/agent/session-event-v4.schema.json`.
- Typed event authority: `protobuf/yijie/events/v4/agent_session.proto`.
- Async consumer projection: `asyncapi/events.yaml` v4 channel/message/operation.
- Desktop ↔ Host framing and negotiation: `openapi/agent-host/agent-host.yaml` v4 SSE path.
- Runtime stable-subset identity: `compatibility/agent-host-runtime-v1.json`.
- Producer/Owner: `yijie-agent-host` / Agent Runtime Team.
- Known consumer: `yijie-desktop`.
- External protocol authority: pinned `yijie-codex` Runtime, which remains unmodified.

V4 is version-isolated because it adds a required AgentMessage lifecycle field and a new event
variant. Existing v1–v3 sources and endpoints remain valid. Old consumers do not receive v4 unless
they use the v4 path and required `event_schema_version=4` guard.

## Candidate expansion

- AgentMessage `item.started` and `item.completed` require `text` plus closed
  `phase=commentary|final_answer|null`; Runtime omission normalizes to null.
- AgentMessage deltas remain text-only and correlate to lifecycle metadata by `item_id`.
- `turn.plan.updated` carries an ordered, complete, authoritative plan snapshot. Higher sequence
  replaces prior state; empty plan clears; omitted/null explanation clears.
- One compact v4 SSE data value is capped at 1 MiB UTF-8. Host validates before replay/write and
  never truncates; non-reasoning projection overflow emits sanitized `limit_exceeded` and forces a
  failed turn terminal, while existing reasoning-specific unavailable semantics remain intact.
- No-turn overflow is closed: invalid managed thread identity fails session start as sanitized
  `500 internal_error`; an oversized Runtime warning becomes a content-free `limit_exceeded`
  warning without an invented Turn.
- V4 preserves v3 reasoning and structured-artifact variants without widening v3.
- Compatibility projection now explicitly registers the existing stable Runtime notifications
  `item/reasoning/textDelta` and `turn/plan/updated`.

The candidate does not expose provider/model/reasoning-effort settings, add a reasoning-strength
UI, add an experimental Runtime method, or authorize experimental `item/plan/delta`.

## Exact-local authorization and privacy

Activation is limited to `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` plus a dedicated
FEAT-134 native gate. Within that exact profile only, Host may fix the managed provider reasoning
effort to `high` and independently enable raw-reasoning projection. The policy must fail closed for
public/production and must not be inferred merely from v3/v4 or artifact support.

Runtime identity remains commit `0ce5902ed400866be0196886bb78f693a004d68d`, upstream tag
`rust-v0.144.6`, version `0.144.6`, stdio transport, `experimentalApi=false`. No Runtime source,
binary, schema, build, or installation changes are authorized.

Host must not durably store or expose in telemetry the prompt, reasoning, plan, or final-response
body. Synthetic contract fixtures contain no provider output. The separately authorized canonical
smoke is downstream validation and is not part of this repository's deterministic fixture set.

Generated TypeScript declarations do not encode the JSON Schema negative discriminator refinement
for non-AgentMessage lifecycle payloads. Host/Desktop conformance therefore requires a runtime
validator or explicit closed parser tests; TypeScript assignability alone is insufficient.

## Rollout and rollback

Development order is Contracts immutable candidate → Host gated mapper/provider policy → Desktop
consumer/native gate. Activation is consumer-first: Host may implement v4 behind a disabled gate,
but the native exact-local gate is enabled only after Desktop accepts and persists the approved
local projection. Rollback disables FEAT-134 and negotiates v3; no v1–v3 or public/production
behavior changes.

Required checks before the Contracts candidate can be committed:

```bash
pnpm generate
pnpm lint
pnpm test
pnpm build
pnpm check:v1-wire f16a497e1377f45747f8ff9292b4b60cf2027f88
./scripts/check-breaking.sh 164b14f609537d727a52326832da04430aecc4ab
./scripts/check-breaking.sh f16a497e1377f45747f8ff9292b4b60cf2027f88
```

The immutable candidate commit cannot truthfully be embedded before commit creation. Downstream
locks must pin the final full commit and reviewed source/generated digests recorded after these
checks.

Reviewed pre-commit source/generated digests and gate results are recorded in
[`../reviews/FEAT-134-semantic-review.md`](../reviews/FEAT-134-semantic-review.md).
