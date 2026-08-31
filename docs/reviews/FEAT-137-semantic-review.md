# FEAT-137 Contracts v6 semantic and security review

Date: 2026-08-31

Impact: `semantic`

Reviewer authority: Codex recorded the Owner-authorized FEAT-137 real-wire authority repair and
immutable local freeze within the exact local-only, read-only Command approval boundary. It does not
authorize a tag, push, publish, Runtime change, application startup, Provider/model request, or real
D4; Host/Desktop may consume only the resulting full clean-tree commit SHA.

## Scope and baselines

This review covers the v6 source contracts, generated Go/TypeScript SDKs, closed synthetic fixtures,
the independent Runtime approval compatibility projection, and deterministic source checks. It does
not claim downstream Host/Desktop conformance before their exact repin. Compatibility was
checked against:

- current immutable foundation `2e490dea4444ea1e33c2df1a5267b2bff5bfb8e6` / unpublished `0.7.0`;
- published supported baseline `f16a497e1377f45747f8ff9292b4b60cf2027f88`.

The external Runtime remains frozen at
`yijie-codex@b2b20e2fc4a0c94834f34d8cc459e488a1b56277`, upstream `0.144.6`,
with `experimentalApi=false`. Runtime source, binary, schema tree, version, and pin were not changed.
The existing `compatibility/agent-host-runtime-v1.json` remains byte-identical and continues to
describe the currently supported `read-only` / `never` Host projection.

## Semantic conclusions

| Boundary | Reviewed conclusion | Result |
|---|---|---|
| Version isolation | Approval appears only on explicitly negotiated v6 events and owner-only v6 HTTP routes; v1-v5 JSON/Proto sources and all pre-v6 OpenAPI/AsyncAPI surfaces remain unchanged | PASS |
| Requested/resolved lifecycle | Requested is non-terminal revision 1; resolved is non-terminal revision 2; action, workspace scope, decisions and outcomes are closed; approval events structurally forbid top-level `request_id` | PASS |
| Data minimization | Approval surfaces carry only Host-minted opaque identities and fixed safe projection fields; Runtime request/approval IDs, command, cwd, reason, permission/network/amendment fields, wire and arbitrary text are forbidden | PASS |
| Pending snapshot | Owner-only `no-store` snapshot allows zero or one live pending approval, is generation/stream/revision bound, and requires the exact fixed primary/secondary decisions | PASS |
| Decision endpoint | One-shot request is generation/stream/revision bound; 200 response echoes the exact decision and advances exactly one revision only after the matching stable Runtime `serverRequest/resolved` authority | PASS |
| Decision idempotency | Same decision identity/body has a bounded identical-200 replay; conflicting reuse fails closed; eviction never reopens an approval | PASS |
| Errors | Each HTTP status uses a closed code allowlist and each of the eleven stable codes has one fixed content-free message | PASS |
| TTL and races | Requested/pending timestamps encode an exact 120-second window; Host monotonic receive time is authority; expiry and cleanup outcomes are time-closed and first-writer-wins | PASS |
| Deterministic producer | Pinned Runtime's existing exec-policy `Prompt` plus `UseDefault` creates the approval without `require_escalated` and preserves the read-only sandbox. Runtime prefix matching is only a trigger; Host exact admission is authoritative | PASS |
| Runtime eligibility | Independent machine-readable projection pins an exact outer/params allowlist, stable method, outer RequestId, session thread/active Turn/expected Item binding, pinned `/bin/zsh -lc` wrapper, one Unknown allowlisted command action as sole business authority, canonical workspace cwd, exact `local`, bounded validate-then-discard reason, absent/null approvalId and permission/network exclusions; unknown fields fail closed | PASS |
| Runtime replay | Runtime response authority is exactly process generation plus typed RequestId; thread/turn/item and normalized command action stay in the closed canonical fingerprint, absent/null forms normalize, `availableDecisions` and validated reason are ignored, and `startedAtMs` is compared but never drives TTL. Equivalent replay reuses authority; same-key drift cancels once and closes the existing pending without a second request projection | PASS |
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

## Source/generated identity before immutable commit

| Artifact | SHA-256 |
|---|---|
| AgentSessionEventV6 JSON Schema | `5cc86a64dfd1253cb2bbd5fd0f7df2493269612a9eb36dd75836f446211925c3` |
| v6 Protobuf source | `d8abdc1f523b2931d5be984b9a0d27af0724dad88e350ad6cb41b0734e075c5d` |
| Agent Host OpenAPI source | `8716d11ebae140d7c2cec72f6528bbd39ac5976c898c28e0044bec71fb004083` |
| AsyncAPI source | `29f544415cad3411f02c3a598fc225ce66c21b4696bd470ea0308d6e43f9c711` |
| Frozen Runtime v1 compatibility projection | `6cef3f4ac60ec91b9f7f05b188dc677169fc11e0bedf34350f6342a6f50981bb` |
| FEAT-137 Runtime approval v2 projection | `ab5333f9ff1e76dc06827d72ff81f83701d234f91a2cbf6664f146247f24db60` |
| Runtime approval v2 projection schema | `55f5984910324446bbf9359c938885b4f1410d3b736aacad47fe3589dac58658` |
| bundled AsyncAPI | `3a511b644dc2bd85509bd6b3a8ab35b959d4d1c96e3db0c4ef6a2604af5ba02e` |
| generated Go Agent Host | `21ee4a55681fe24284450ea9f3a350916959ed064296aaad5dffb671b6c3ee3d` |
| generated Go v6 Protobuf | `9447aaafb3537ea4e52b15f104da67e932d70d4e9a3c50f0d48840bc94722452` |
| generated TypeScript Agent Host | `30fec0a7b409165f2b316fe422c4227c870dc89263f31c0fc09c517b6cf352b9` |
| generated TypeScript v6 Protobuf | `35f8964f7cc8a11b061d50ca77c676b0fcb08071fba0ee902356e861a4b9ce0a` |
| generated TypeScript v6 event schema | `acaa787bcb90bb25762118eef0a59b172f2d15a65328a044470befd99802b01c` |
| generated TypeScript Runtime approval v2 projection | `8e339e3cc22030ea407bfd785c815448c74a61a28c8bd8aa9f232c2e9a3ef332` |

These digests are refreshed by each reviewed source repair. Before the authorized freeze, HEAD is
`2e490dea4444ea1e33c2df1a5267b2bff5bfb8e6`; Host may pin only the new full commit produced after all
gates pass and the Contracts tree is clean.

## Gate result

- focused v1-v6/HTTP/Runtime compatibility tests: PASS, 25/25.
- all safety-compliant Node tests except the pre-existing archive-attack suite: PASS, 88/88.
- `go test ./...`: PASS.
- `pnpm lint`: PASS; OpenAPI/AsyncAPI, 18 JSON Schemas, Proto, TypeScript and Go vet.
- `pnpm check-generated:safe`: PASS; 46 generated SDK files current.
- `pnpm build:safe`: PASS.
- legacy v1 wire equality against both baselines: PASS.
- OpenAPI, Protobuf, AsyncAPI and JSON Schema breaking checks against both baselines: PASS.
- `git diff --check`: PASS.

The authorized acceptance gates intentionally excluded the pre-existing Zip Slip archive suite. An
independent review agent nevertheless invoked a raw all-test glob once and accidentally executed
that pre-existing archive test. It completed with normal self-cleanup and left the repository
unchanged, but the run violated this batch's safety boundary and is excluded from acceptance
evidence. It was not repeated. The default `pnpm test`, `pnpm generate`, and `pnpm build` composite
paths were not used as acceptance gates because they invoke the same archive-fixture path. The
`:safe` generation path is an explicit partial generation gate; the 88 non-attack Node tests and all
other listed gates are the safety-compliant substitute.

Contracts working-tree source candidate review: **PASS**.

The current batch authorizes one local immutable Contracts commit followed by a clean-tree SHA/gate
audit. Host/Desktop exact repin and cross-repository conformance remain subsequent gates. Fresh
FEAT-137 D4 remains separately authorized only after those freezes. Real calls used: 0.
