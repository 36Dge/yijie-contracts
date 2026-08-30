# Contracts v0.7.0 candidate

Status: FEAT-136 v0.7.0 exact-local candidate with Owner-authorized Runtime provenance repair; not
tagged, pushed, published, deployed, promoted to a supported baseline, or enabled for
public/production. Host/Desktop exact repin/conformance and fresh Command D4 remain separate gates.

## Impact, authorities, and ownership

`contract-impact = semantic`.

- JSON/SSE authority: `jsonschema/agent/session-event-v5.schema.json`.
- Typed transport projection: `protobuf/yijie/events/v5/agent_session.proto`; JSON Schema remains the
  semantic validity authority.
- Async consumer projection: `asyncapi/events.yaml` v5 channel/message/operation.
- Desktop ↔ Host framing and negotiation: `openapi/agent-host/agent-host.yaml` v5 SSE path.
- Runtime stable-subset identity: `compatibility/agent-host-runtime-v1.json`.
- Producer/Owner: `yijie-agent-host` / Agent Runtime Team.
- Known consumer: `yijie-desktop`.
- External protocol authority and Command lifecycle producer: pinned `yijie-codex` Runtime; Host
  remains the normalized, bounded SSE projector and does not invent missing producer events.

V5 is version-isolated because v4 has a closed event union and closed lifecycle payloads. Adding
typed Command/Tool snapshots plus new delta/progress variants to v4 would change what a strict v4
consumer accepts and interprets. Existing v1-v4 schemas, packages, and endpoints remain valid; an
older consumer never receives v5 unless it changes to the v5 path and required
`event_schema_version=5` guard.

Proto3 alone cannot enforce required oneofs/messages, conditional lifecycle/result/error pairs,
unknown enum rejection, UTF-8 aggregate caps, or the Tool progress-index maximum. Protobuf adapters
must therefore reject every syntactically decodable message that would fail the authoritative JSON
Schema (or an equivalent closed native validator) before apply/render/persistence. The Protobuf
package is not permission to widen v5 semantics.

## Candidate expansion

- `item.started` and `item.completed` gain closed v5 branches for
  `item_type=commandExecution` and `item_type=mcpToolCall`.
- `item.command_output.delta` carries a bounded, sanitized Command output chunk.
- `item.tool.progress` carries a bounded, sanitized generic Tool progress summary and zero-based
  `progress_index`.
- Command completed is the authoritative bounded Item snapshot and includes the safe display
  identity, working-directory projection, status, required output union, and applicable
  duration/exit/error fields. A missing Runtime aggregate maps to `retention=unavailable`; it is not
  fabricated as empty output.
- Tool completed similarly repeats its safe generic identity and argument summary, then adds only
  applicable duration/result/error fields. Runtime `is_error=true` maps to `failed` with a bounded
  result summary when available and a normalized stable error.
- At-least-once replay is deduplicated by `event_id`. Equal text in distinct events remains distinct.
- Item completion is separate from Turn completion; a normal `error` remains non-terminal.

The candidate does not forward a Runtime `ThreadItem` object and does not add a Host command, MCP
registration, Connector, Tool implementation, approval action, Artifact result, or Runtime method.

## Closed states and errors

Command starts as `running` and completes as `completed | failed | declined`. Its stable error codes
are `command_failed | command_declined | projection_limit_exceeded |
projection_redaction_failed | protocol_error`.

Tool starts as `in_progress`; its closed completion set is `completed | failed | declined`, with
`declined` and `tool_declined` reserved by Yijie for a future approved producer. The pinned Runtime's
stable `McpToolCallStatus` does not contain `declined`, so that value is synthetic-contract-only and
must not be presented as current real capability. Tool stable errors are
`tool_failed | tool_declined | unknown_tool | projection_limit_exceeded |
projection_redaction_failed | protocol_error`.

Errors are sanitized projections capped at 4 KiB; raw Runtime/MCP messages are not allowed. Unknown
Tools carry `identity.resolution=unknown` with fixed `server_name=unknown` and `tool_name=unknown`
sentinels and use the generic presentation surface. They do not block unrelated Items or terminate a
Turn.

## Bounds, retention, and redaction

Limits use UTF-8 bytes. A conforming Host redacts first, then counts and truncates at valid UTF-8
boundaries. One SSE limit measurement is the compact JSON `data` value after projection, and cwd
aggregate counting includes `/` separators. The new policy applies only to the explicit Command/Tool
bounded fields; inherited v4 projection and reasoning overflow semantics remain unchanged.

| Projection | Limit |
|---|---|
| Compact SSE `data` value | 1 MiB |
| Command `command_summary` | 4 KiB |
| Command `cwd` | 1 KiB total |
| Command delta | 16 KiB |
| Command completed output | 256 KiB; complete or first 128 KiB + last 128 KiB |
| Tool server/tool name | 256 B each |
| Tool argument summary | 8 KiB |
| Tool progress | 4 KiB each; indices 0-31; 64 KiB total per Item |
| Tool result summary | 64 KiB |
| Error summary | 4 KiB |

A bounded summary has `text`, `truncated`, and, when truncated, a closed reason of
`utf8_byte_limit | upstream_truncated`. Command completed output is either
`{ retention: complete, text, truncated: false }`,
`{ retention: head_tail, head, tail, truncated: true, truncation_reason }`, or
`{ retention: unavailable, reason: not_available, truncated: false }`. The completed output union is
authoritative over any live aggregate derived from deltas.

`cwd` is a closed structural union: `workspace_root`, `workspace_relative` with safe path segments,
or `redacted`. Absolute/canonical paths and traversal segments cannot be represented. The Desktop
wire also excludes raw command, process ID, source/actions, raw aggregate, Tool arguments/result,
MCP content/structured content/`_meta`, app/resource/plugin/connector identity, token, secret, and raw
wire payload. Schema validation proves the closed field/path shapes and limit policy, not the contents
of arbitrary allowed strings; actual secret/path/content sanitization remains a separate Host
conformance responsibility. The reviewed Host draft covers it, but fresh exact repin/conformance is
still required for this provenance revision.

## Runtime, activation, and capability gap

Runtime identity is repository commit
`b2b20e2fc4a0c94834f34d8cc459e488a1b56277`, upstream tag `rust-v0.144.6`, version
`0.144.6`, stdio transport, and `experimentalApi=false`. The stable generated schema remains 267
files with tree SHA-256
`82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`.
The Runtime candidate applies the exact ordered patches
`0001-feat-126-filter-persistent-diagnostics.patch` and
`0002-feat-136-unified-exec-pre-emitter-command-lifecycle.patch`. `0002` is a semantic producer repair:
when final early sandbox denial previously returned before emitter creation, it emits one canonical
started followed by one failed completed for the same Command identity, preserving exit code,
duration and aggregate, then returns the original error. It does not change retry/approval,
`sandbox=read-only`, `approvalPolicy=never`, transport, experimental API, or Tool production. A fresh
isolated release build and schema regeneration confirmed no stable Schema diff.

Activation is limited to `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` plus a dedicated
FEAT-136 gate after Host and Desktop pin the new immutable Contracts commit and exact Runtime
artifact. Reviewed Host/Desktop drafts exist, but their new pins and end-to-end conformance remain
pending. Command is the Feature Must; a fresh safe read-only real vertical has not yet run after this
repair. The Tool schema is only a generic stable boundary: no new MCP/Connector is registered, no
experimental API is enabled, and no real Tool producer or Tool D4 is claimed. CAP-017 remains an
Owner/product capability gap without blocking the Command contract.

## Explicit exclusions

V5 has no FileChange, Diff, patch, file approval, Command approval decision, write gate, shell/network/
filesystem permission expansion, or experimental variant. Its generic Item lifecycle is closed to
the named stable allowlist and cannot encode arbitrary unknown or experimental kinds. Artifact events
and resources remain under their existing v3/v4 authority and are not merged into Command/Tool
payloads. Absence of excluded variants is checked through static closed allowlists rather than
creating excluded-capability fixtures.

## Rollout and rollback

Development order is Runtime immutable candidate → Contracts provenance repin → Host exact
Runtime/Contracts artifact pin plus mapper conformance → Desktop exact Host/Contracts pin plus closed
consumer conformance → fresh Command D4. Activation remains consumer-first: Host must not emit v5
until the Desktop consumer is pinned and ready. Rollback restores Runtime
`0ce5902ed400866be0196886bb78f693a004d68d` together with its matching Contracts provenance, disables
FEAT-136, and negotiates v4. V1-v4 and public/production behavior remain unchanged; there is no
durable-data migration in this Contracts revision.

The initial D0 + Contracts source candidate used these safety-compliant checks before commit
`3c3000a6fbe2f08ab2131a463a1691e867d661b1`:

```bash
pnpm install --frozen-lockfile
pnpm exec buf generate
pnpm exec openapi-typescript openapi/agent-host/agent-host.yaml --redocly openapi-typescript.redocly.yaml -o sdks/typescript/src/openapi/agent-host.gen.ts
go tool oapi-codegen -generate types,client -package agenthostapi -o sdks/go/openapi/agent-host/client.gen.go openapi/agent-host/agent-host.yaml
pnpm exec redocly bundle asyncapi/events.yaml --output sdks/asyncapi/events.bundle.json
# Generate only jsonschema/agent/session-event-v5.schema.json with the repository's existing json-schema-to-typescript options.
make lint
# Run Node tests except tests/skill-bundle-v1.test.mjs, then run go test ./...
tsc -p tsconfig.json
pnpm check:v1-wire f16a497e1377f45747f8ff9292b4b60cf2027f88
./scripts/check-breaking.sh 3832a6c5e99b2a6365f193280fdb887c8fdbc2de
./scripts/check-breaking.sh f16a497e1377f45747f8ff9292b4b60cf2027f88
git diff --check
```

The repository-wide `make generate`, `node scripts/check-generated.mjs`, `make test`, and `make
build` paths currently invoke a pre-existing archive attack fixture. The global safety policy forbids
that validation path, so it is not accepted as FEAT-136 evidence. This batch instead uses the scoped
generators above, a repeat-generation hash comparison, all non-archive Node tests, and the full Go
suite. The exact exception and results are recorded in the semantic review.

The first explicit breaking baseline is the FEAT-134 candidate from which v5 branches. The second is
the published `contracts-v0.2.0` supported baseline. Structural green checks do not replace the
directional semantic/security review or later Host/Desktop conformance.

The Runtime provenance reconciliation additionally passed, without any Provider/model call:

- final Runtime commit `b2b20e2fc4a0c94834f34d8cc459e488a1b56277` and exact ordered patch replay;
- focused Runtime lifecycle/protocol tests, 4/4 safe fake exec-server scenarios, fmt and scoped
  clippy;
- isolated Rust `1.95.0` `aarch64-apple-darwin` release build;
- 267-file stable Schema regeneration, tree SHA-256
  `82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`, with zero tracked diff;
- normal-EOF stdio initialize/initialized smoke, a two-patch Runtime artifact manifest, and
  Runtime→Contracts bidirectional compatibility.

The Contracts-only reconciliation then passed focused v4/v5/runtime compatibility tests (22/22),
all non-archive Node tests (63/63), lint, Go tests/vet, TypeScript compilation, legacy v1 wire
equality, both registered breaking baselines, and `git diff --check`. No wire source or generated SDK
file changed.

The final fresh artifact manifest records binary SHA-256
`4efe16d2848680752cf9aacf4c17741ab2eeb7415894a66c2bb03652b00a322d`, size `355676760`, and manifest
SHA-256 `1cfa2e0a139b2213f4d29b1efeed71d4810110ac865f0bcbd931ff33b0062c1b`.
These build-specific values must be copied into the Host artifact lock; they are not wire fields.

The immutable candidate commit cannot truthfully be embedded before commit creation. The FEAT-136
governance package records the final full commit after creation. Reviewed pre-commit source/generated
digests and gate results are recorded in
[`../reviews/FEAT-136-semantic-review.md`](../reviews/FEAT-136-semantic-review.md). The later Runtime
repair and provenance evidence is recorded separately in
[`../reviews/FEAT-136-runtime-provenance-review.md`](../reviews/FEAT-136-runtime-provenance-review.md),
so the original `3c3000a6...` review remains immutable historical evidence rather than being rewritten.
