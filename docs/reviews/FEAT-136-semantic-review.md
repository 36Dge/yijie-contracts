# FEAT-136 Contracts semantic and security review

Date: 2026-08-29

Impact: `semantic`

Reviewer authority: Codex applied the Product/Technical/Security/Data Owner's direct authorization
for the FEAT-136 D0 + Contracts batch and reviewed the source inside that exact local-only boundary.
This is not an independent second-party review and does not approve a tag, push, publish,
public/production activation, Host/Desktop implementation, any real Tool registration, or D4.

## Scope and baselines

This review covers the v5 JSON/Protobuf/OpenAPI/AsyncAPI authorities, Runtime compatibility
projection, generated SDKs, synthetic contract fixtures, and deterministic repository checks. It does
not claim Host redaction/mapping, Desktop persistence/reducer/UI conformance, real Runtime Command or
Tool behavior, or Feature completion.

Compatibility must be checked against:

- FEAT-134 candidate `3832a6c5e99b2a6365f193280fdb887c8fdbc2de`;
- published supported baseline `contracts-v0.2.0`, peeled commit
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`.

The pinned external Runtime remains
`yijie-codex@0ce5902ed400866be0196886bb78f693a004d68d`, upstream `rust-v0.144.6`,
version `0.144.6`, with `experimentalApi=false`. Its 267 stable schemas retain tree SHA-256
`82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`.
Runtime source, binary, build, installation, canonical schemas, sandbox, and approval policy are not
changed by this review.

## Semantic conclusions

| Boundary | Reviewed conclusion | Result |
|---|---|---|
| Impact classification | V4 is a closed output/event union; adding typed Item snapshots and new variants changes consumer interpretation, so the highest honest classification is `semantic`, not merely additive | PASS |
| Version isolation | V5 requires `/v5/.../events` plus `event_schema_version=5`; v1-v4 schemas, packages, and paths remain separate | PASS |
| Protobuf boundary | JSON Schema is the semantic validity authority; Proto3 is typed transport only. Adapters must reject unset oneofs/messages, unknown enums, invalid lifecycle/status/result/error pairs, and all JSON cap violations before apply/persistence | PASS (contract gate); adapter conformance NOT RUN |
| Identity/replay | Existing task/session/thread/turn/item authorities remain; at-least-once delivery is deduplicated by `event_id`, never string content, so equal text with distinct IDs is retained | PASS |
| Command lifecycle | `item.started` uses a closed `commandExecution` running snapshot; `item.command_output.delta` is bounded; `item.completed` seals completed/failed/declined with safe identity and a required authoritative output union | PASS |
| Command hydration | Completed repeats `command_summary` and safe `cwd`; output is complete/head-tail or explicitly unavailable when Runtime `aggregatedOutput` is absent, so no empty snapshot is fabricated; replayed deltas cannot create or reopen another Item | PASS |
| Tool lifecycle | `mcpToolCall` started/completed and `item.tool.progress` expose only a generic projection; unknown identity is fixed to sentinels; Runtime `is_error=true` maps to failed plus optional bounded result and normalized stable error | PASS |
| Tool capability gap | Fixed Runtime MCP status has no declined value and no Owner-approved real Tool producer is established; Tool decline is Yijie-reserved/synthetic-only and Tool real-runtime availability remains unclaimed | PASS |
| Terminal semantics | Item completed seals one Item; ordinary error is non-terminal; only `turn.completed` can terminate a Turn | PASS |
| Projection bounds | Compact JSON SSE `data` value is executable-capped at 1 MiB; Command 4 KiB summary, 1 KiB cwd including separators, 16 KiB delta and 256 KiB head/tail aggregate; Tool 256 B identities, 8 KiB args, 4 KiB × 32/64 KiB progress, 64 KiB result; error 4 KiB | PASS |
| Truncation policy | Contract freezes redact-before-count/truncate, explicit truncation metadata, UTF-8 boundaries, and Command head/tail reconciliation; actual Host redaction execution is outside this batch | PASS (contract policy) |
| Path/privacy shape | `cwd` is workspace-root, constrained relative segments, or redacted; raw command/cwd, Tool arguments/results/meta/context, tokens, secrets, absolute paths, raw errors, and raw wire have no contract fields. JSON Schema cannot inspect arbitrary allowed text for secrets | PASS (closed shape); Host sanitizer NOT RUN |
| Unknown behavior | Unknown Tool uses fixed `unknown` sentinels; v5 generic Item uses a closed stable allowlist; any other event/Item shape must fail closed at Host and fail-soft into consumer reconciliation | PASS (contract); Host conformance NOT RUN |
| FEAT-138 exclusion | V5 defines no FileChange, Diff, patch, file approval, or write gate; the closed generic Item allowlist cannot encode them, and no excluded-capability fixture was created | PASS |
| Artifact isolation | Existing v3/v4 Artifact authority remains independent and is not embedded into Command or Tool payloads | PASS |
| Runtime boundary | Compatibility projection adds only existing stable Command output-delta and MCP Tool progress notifications; Runtime identity and `experimentalApi=false` remain exact | PASS |
| Activation | Exact `demo_fast/local` gating and consumer-first activation are required; Contracts do not establish Host/Desktop implementation, usability, a real producer, or D4 | PASS |

## Stable projection details

Command status is `running | completed | failed | declined`. Its stable error-code set is
`command_failed | command_declined | projection_limit_exceeded |
projection_redaction_failed | protocol_error`.

Tool status is `in_progress | completed | failed | declined`; `declined` is reserved by Yijie and is
not sourced by the pinned Runtime. Its stable error-code set is
`tool_failed | tool_declined | unknown_tool | projection_limit_exceeded |
projection_redaction_failed | protocol_error`.

The pinned Runtime emits `completed + result` for a normal MCP result,
`failed + result + no raw error` when MCP returns `is_error=true`, and
`failed + no result + raw error` for invocation/transport failure. V5 maps both failed forms to a
normalized stable error and retains a bounded safe result summary only when one exists. This mapping
does not forward the raw MCP result or error.

Bounded summaries use `truncated` and, when applicable,
`truncation_reason=utf8_byte_limit|upstream_truncated`. Command completed output uses complete text,
the explicit head/tail representation, or `retention=unavailable` with
`reason=not_available`. These enums are presentation and reconciliation facts; they are not approval,
retry, or execution authorities.

## Source/generated identity before immutable commit

The values below must be computed from the stable post-generation tree before the candidate commit.
They intentionally do not guess content that another in-progress source/generation step may change.

| Artifact | SHA-256 |
|---|---|
| Agent Host OpenAPI | `bd53dfd84976c81b5154c587c72547a5b698b72d301a4850fd0b6338022f9c83` |
| AsyncAPI source | `2c7859c659cfcca0e82e0b79feb97ce088870a425cfbad2174450513f0b6332c` |
| AgentSessionEventV5 JSON Schema | `2f773dd6dc60bc7dc01bcdb434447e945e0a98317534498f54325fcdabb27008` |
| v5 Protobuf source | `9d4c0e8ed9d39d7eee0f255401e1a7b40b62ad4ed221f2e0d6b6e514859bc65b` |
| Runtime compatibility projection | `6a81fbb1390af99c0f1f6d6b53a872b3b8bfa0447d0dd03cb02f5169208e85dc` |
| bundled AsyncAPI | `9e1c8f09c81c6306e1a0adad87c1114d81b6e834ac531db2ec4f6842e1acac42` |
| generated Go Agent Host | `acb0830a5a5163ec28f017f6633f5f7182160c2d1b1799235f649be6a5225d08` |
| generated Go v5 Protobuf | `ecb1e266c5b8104590c9efee3c49c04f030bbceeedd40030820bc580f5e8dab0` |
| generated TypeScript Agent Host | `90d3ee42425623d7b3c31d47a8983057c93a88bda100d73aacefd436839338c4` |
| generated TypeScript v5 Protobuf | `90ede55c4fcfe94b599a2803902a1e83acc1e4b02a73261c304732dbb403a331` |
| generated TypeScript v5 event schema | `9ce5062ec3c156d45a8921d556c2afbb89674796ba81faeaa8ea6a6b8031ad9b` |
| generated TypeScript SDK index | `3da63d6f60bdf240a70e6d11757a117ba61b12a02ab8b375409eed1891997263` |

These digests identify the reviewed pre-commit tree. The immutable full commit is recorded in the
FEAT-136 governance package only after commit creation; this file cannot self-reference a commit that
does not yet exist.

## Required gate evidence

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS (exit 0) |
| scoped Buf, Agent Host OpenAPI Go/TS, AsyncAPI, and v5 JSON Schema generation | PASS (all exit 0) |
| repeat scoped generation and SHA-256 comparison over seven generated/protected outputs | PASS (`HASH_MATCH=true`) |
| `make lint` | PASS: all OpenAPI/AsyncAPI valid, 15 JSON Schemas valid, Buf lint, TypeScript no-emit, and Go vet exit 0 |
| safe Node suite excluding `tests/skill-bundle-v1.test.mjs` | PASS: 63/63 |
| `go test ./...` | PASS |
| `pnpm exec tsc -p tsconfig.json` | PASS (exit 0) |
| `pnpm check:v1-wire f16a497e1377f45747f8ff9292b4b60cf2027f88` | PASS: 2 Public and 7 Agent Host legacy v1 paths/reference closures equal |
| breaking vs `3832a6c5e99b2a6365f193280fdb887c8fdbc2de` | PASS: no OpenAPI/Proto/AsyncAPI/JSON Schema breaking change |
| breaking vs `f16a497e1377f45747f8ff9292b4b60cf2027f88` | PASS: no OpenAPI/Proto/AsyncAPI/JSON Schema breaking change |
| generated/protected-file review | PASS: final independent review found no open P0/P1/P2; v1-v4 JSON/Proto sources unchanged; scoped generated hashes are deterministic |
| `git diff --check` | PASS |

### Safety exception to composite repository commands

During the initial standard-gate audit, `make generate`, `node scripts/check-generated.mjs`, `make
test`, and `make build` were each invoked once before it was identified that their shared generation
path creates or reads the repository's pre-existing Zip Slip archive fixture. Their mechanical exit-0
results are not accepted as FEAT-136 evidence. The fixture was not introduced or extracted by
FEAT-136, and no attack-injection assertion is reported as PASS.

Those composite commands were not rerun. The safety-compliant replacement was scoped source
generation, repeat-generation digest equality, all 63 non-archive Node tests, the complete Go suite,
direct TypeScript compilation, lint, dual breaking baselines, and manual protected/generated review.
Impact: the prohibited Skill-bundle archive fixture/generator path is explicitly unverified for this
batch; it is unrelated to the new v5 Command/Tool contract and cannot be used as completion evidence.

## Gate result

Semantic/security design review: **PASS for the authorized Contracts boundary**.

Contracts source/generated gate: **PASS for the safety-compliant scoped gate**.

Cross-repository FEAT-136 completion: **PENDING**. Host/Desktop source, exact downstream pinning and
conformance, real safe read-only Command vertical, Tool Owner/producer decision, UI/hydration checks,
and D4 have not been performed in this Contracts review.
