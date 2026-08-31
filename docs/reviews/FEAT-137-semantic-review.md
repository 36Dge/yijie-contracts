# FEAT-137 Contracts v6 semantic and security review

Date: 2026-08-31

Impact: `semantic`

Reviewer authority: Codex recorded the Owner-authorized FEAT-137 stable sandbox provenance repair and
immutable local freeze within the exact local-only, read-only Command approval boundary. It does not
authorize a tag, push, publish, further Runtime change, application startup, Provider/model request, or real
D4; Host/Desktop may consume only the resulting full clean-tree commit SHA.

## Scope and baselines

This review covers the v6 source contracts, generated Go/TypeScript SDKs, closed synthetic fixtures,
the independent Runtime approval compatibility projection, and deterministic source checks. It does
not claim downstream Host/Desktop conformance before their exact repin. Compatibility was
checked against:

- current immutable approval foundation `0acf2a39a505a4ef9fb8757b29cb53efe9e9846f` / unpublished `0.7.0`;
- original v6 source foundation `2e490dea4444ea1e33c2df1a5267b2bff5bfb8e6`;
- published supported baseline `f16a497e1377f45747f8ff9292b4b60cf2027f88`.

The external Runtime provenance authority is frozen at
`yijie-codex@acf2da55d8a53175343aaf112e03368dfef9922a`, upstream `0.144.6`,
with `experimentalApi=false`. Its third authorized patch adds only the required stable
`sandboxPermissions` provenance field; Runtime execution permissions and approval decisions are unchanged.
The existing `compatibility/agent-host-runtime-v1.json` remains byte-identical and continues to
describe the currently supported `read-only` / `never` Host projection.

## Semantic conclusions

| Boundary | Reviewed conclusion | Result |
|---|---|---|
| Version isolation | Approval appears only on explicitly negotiated v6 events and owner-only v6 HTTP routes; v1-v5 JSON/Proto sources and all pre-v6 OpenAPI/AsyncAPI surfaces remain unchanged | PASS |
| Requested/resolved lifecycle | Requested is non-terminal revision 1; resolved is non-terminal revision 2; action, workspace scope, decisions and outcomes are closed; approval events structurally forbid top-level `request_id` | PASS |
| Data minimization | Approval surfaces carry only Host-minted opaque identities and fixed safe projection fields; Runtime request/approval IDs, command, cwd, reason, sandbox provenance, permission/network/amendment fields, wire and arbitrary text are forbidden | PASS |
| Pending snapshot | Owner-only `no-store` snapshot allows zero or one live pending approval, is generation/stream/revision bound, and requires the exact fixed primary/secondary decisions | PASS |
| Decision endpoint | One-shot request is generation/stream/revision bound; 200 response echoes the exact decision and advances exactly one revision only after the matching stable Runtime `serverRequest/resolved` authority | PASS |
| Decision idempotency | Same decision identity/body has a bounded identical-200 replay; conflicting reuse fails closed; eviction never reopens an approval | PASS |
| Errors | Each HTTP status uses a closed code allowlist and each of the eleven stable codes has one fixed content-free message | PASS |
| TTL and races | Requested/pending timestamps encode an exact 120-second window; Host monotonic receive time is authority; expiry and cleanup outcomes are time-closed and first-writer-wins | PASS |
| Deterministic producer | Pinned Runtime's existing exec-policy `Prompt` plus `UseDefault` creates the approval without `require_escalated` and preserves the read-only sandbox. Runtime prefix matching is only a trigger; Host exact admission is authoritative | PASS |
| Runtime eligibility | Independent machine-readable projection pins an exact outer/params allowlist, stable method, outer RequestId, session thread/active Turn/expected Item binding, pinned `/bin/zsh -lc` wrapper, one Unknown allowlisted command action as sole business authority, canonical workspace cwd, exact `local`, required `sandboxPermissions=use_default`, bounded validate-then-discard reason, absent/null approvalId and permission/network exclusions; escalation, additional permission, missing, unknown, and unknown fields fail closed | PASS |
| Runtime replay | Runtime response authority is exactly process generation plus typed RequestId; thread/turn/item, normalized command action, and exact `use_default` sandbox provenance stay in the closed canonical fingerprint, absent/null forms normalize, `availableDecisions` and validated reason are ignored, and `startedAtMs` is compared but never drives TTL. Equivalent replay reuses authority; same-key drift cancels once and closes the existing pending without a second request projection | PASS |
| Runtime response | `accept_once` maps only to Runtime `accept`; `cancel_current_turn` and TTL expiry map only to Runtime `cancel`; forbidden decision families and malformed fallback are closed | PASS |
| Runtime acknowledgement | Machine-readable authority requires stable `serverRequest/resolved` with `requestId` and `threadId`, plus the same Runtime process generation and exact JSON RequestId type/value; connection changes do not alter generation, while mismatch, duplicate and timeout behavior is fail-closed | PASS |
| Generated consumers | Generated SDKs expose closed decisions, revision literals, fixed errors and the compatibility object without `never[]`; legacy Go client interface method sets retain their exact baseline digests and v6 is opt-in through extension interfaces; downstream still needs runtime validation or an equivalent closed decoder | PASS |
| Old wire | v1 reference-closure equality and no-breaking checks pass against both the current immutable foundation and the published baseline | PASS |

The first independent review found two blocking issues: status-agnostic/free-text errors and a
decision order that depended on a custom keyword. Both were replaced by standard closed schemas.
The follow-up also closed exact revision/time semantics, approval request-ID exposure, decision
correlation/idempotency, typed Runtime replay authority and acknowledgement binding, canonical
identity normalization, and the approval-only privacy wording. Final source review additionally
restored the published v2 Go constant and preserved both legacy Go client interface method sets,
while exposing v6 only through opt-in extension interfaces.

The 2026-08-31 real-wire repair additionally reconciled the pinned Runtime's actual shell-joined
presentation, exact `local` environment, and bounded `reason`. It keeps the unique allowlisted
`CommandAction` as business authority, validates then discards wrapper/reason, and records that a
Runtime prefix rule is not itself exact admission. Focused Runtime proof confirmed `Prompt` plus
`UseDefault` remains in the read-only sandbox with no override or permission elevation.

The 2026-09-01 stable provenance repair replaces inference with a required Runtime-owned field.
The v3 compatibility projection admits only `use_default`; `require_escalated` and
`with_additional_permissions` are valid Runtime enum values but ineligible for FEAT-137. The field
is retained only in Host pending/replay authority and remains structurally forbidden on public v6
events, SQLCipher projection, copy surfaces, logs, and errors.

## Source/generated identity before immutable commit

| Artifact | SHA-256 |
|---|---|
| AgentSessionEventV6 JSON Schema | `c71d7eb7a266e5ac7c1b3f09536d536fed2cf36379d49c0007eab792f34a4bee` |
| v6 Protobuf source | `d8abdc1f523b2931d5be984b9a0d27af0724dad88e350ad6cb41b0734e075c5d` |
| Agent Host OpenAPI source | `8716d11ebae140d7c2cec72f6528bbd39ac5976c898c28e0044bec71fb004083` |
| AsyncAPI source | `29f544415cad3411f02c3a598fc225ce66c21b4696bd470ea0308d6e43f9c711` |
| Frozen Runtime v1 compatibility projection | `6cef3f4ac60ec91b9f7f05b188dc677169fc11e0bedf34350f6342a6f50981bb` |
| FEAT-137 Runtime approval v3 projection | `9c196a0f6e34dfa917f9c3e6f27400307d991b81d37ba911c0f717d40642c90a` |
| Runtime approval v3 projection schema | `ef83669eee5ca57597f8bf643f0fb9d6acd7b4f5413ec980f594b5251013d2d1` |
| bundled AsyncAPI | `d32781d9566c890d09a76c59e83554ecedb91bc5a4be7e3d57622741bddf5a5e` |
| generated Go Agent Host | `21ee4a55681fe24284450ea9f3a350916959ed064296aaad5dffb671b6c3ee3d` |
| generated Go v6 Protobuf | `9447aaafb3537ea4e52b15f104da67e932d70d4e9a3c50f0d48840bc94722452` |
| generated TypeScript Agent Host | `30fec0a7b409165f2b316fe422c4227c870dc89263f31c0fc09c517b6cf352b9` |
| generated TypeScript v6 Protobuf | `35f8964f7cc8a11b061d50ca77c676b0fcb08071fba0ee902356e861a4b9ce0a` |
| generated TypeScript v6 event schema | `acaa787bcb90bb25762118eef0a59b172f2d15a65328a044470befd99802b01c` |
| generated TypeScript Runtime approval v3 projection | `3002ba007889a26f069b2cab21dd7df2ddb8e12502f28e1e137d9059b4d4fdfe` |

These digests are refreshed by each reviewed source repair. The authorized source base is
`0acf2a39a505a4ef9fb8757b29cb53efe9e9846f`; Host may pin only the new full commit produced after all
gates pass and the Contracts tree is clean.

## Gate result

- focused v6/Runtime stable-sandbox-provenance tests: PASS, 13/13.
- all safety-compliant Node tests except the two pre-existing attack-fixture suites: PASS, 80/80.
- `go test ./...`: PASS.
- `pnpm lint`: PASS; OpenAPI/AsyncAPI, 19 JSON Schemas, Proto, TypeScript and Go vet.
- `pnpm check-generated:safe`: PASS; 47 generated SDK files current.
- `pnpm build:safe`: PASS.
- legacy v1 wire equality against both baselines: PASS.
- OpenAPI, Protobuf, AsyncAPI and JSON Schema breaking checks against both baselines: PASS.
- `git diff --check`: PASS.

The authorized acceptance gates intentionally excluded the pre-existing Zip Slip archive suite and
the structured-artifact injection-invalid fixture. The default `pnpm test`, `pnpm generate`, and
`pnpm build` composite paths were not used as acceptance gates because they invoke an excluded
fixture path. The `:safe` generation path, 80 non-attack Node tests and all other listed gates are
the safety-compliant substitute.

Contracts working-tree source candidate review: **PASS**.

The current batch authorizes one local immutable Contracts commit followed by a clean-tree SHA/gate
audit. Host/Desktop exact repin and cross-repository conformance remain subsequent gates. Fresh
FEAT-137 D4 remains separately authorized only after those freezes. Real calls used: 0.
