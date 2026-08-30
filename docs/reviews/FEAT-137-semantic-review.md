# FEAT-137 Contracts v6 semantic and security review

Date: 2026-08-30

Impact: `semantic`

Reviewer authority: Codex recorded the Owner-authorized FEAT-137 Contracts v6 source-first batch
and reviewed the Contracts working tree within the exact local-only, read-only Command approval
boundary. This review does not authorize a commit, tag, push, publish, Host/Desktop implementation,
Runtime change, application startup, Provider/model request, or real D4.

## Scope and baselines

This review covers the v6 source contracts, generated Go/TypeScript SDKs, closed synthetic fixtures,
the independent Runtime approval compatibility projection, and deterministic source checks. It does
not claim an immutable Contracts authority or downstream consumer conformance. Compatibility was
checked against:

- current immutable foundation `87f94c9aa6d4848cb67aa8a1265bd21474edb0bb` / unpublished `0.7.0`;
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
| Runtime eligibility | Independent machine-readable projection pins an exact outer/params allowlist, stable method, outer RequestId, session thread/active Turn/expected Item binding, one Unknown command action, exact argv, canonical workspace cwd, absent/null approvalId and permission/network exclusions; unknown fields fail closed | PASS |
| Runtime replay | Runtime response authority is exactly process generation plus typed RequestId; thread/turn/item stay in the closed canonical fingerprint, absent/null forms normalize, `availableDecisions` is ignored, and `startedAtMs` is compared but never drives TTL. Equivalent replay reuses authority; same-key drift cancels once and closes the existing pending without a second request projection | PASS |
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

## Source/generated identity before immutable commit

| Artifact | SHA-256 |
|---|---|
| AgentSessionEventV6 JSON Schema | `2ca5f830a5962fb3be628e7992cb86c69d5d202bc48100fd8e5f83e9e5c17773` |
| v6 Protobuf source | `d8abdc1f523b2931d5be984b9a0d27af0724dad88e350ad6cb41b0734e075c5d` |
| Agent Host OpenAPI source | `8716d11ebae140d7c2cec72f6528bbd39ac5976c898c28e0044bec71fb004083` |
| AsyncAPI source | `29f544415cad3411f02c3a598fc225ce66c21b4696bd470ea0308d6e43f9c711` |
| Frozen Runtime v1 compatibility projection | `6cef3f4ac60ec91b9f7f05b188dc677169fc11e0bedf34350f6342a6f50981bb` |
| FEAT-137 Runtime approval projection | `992d939b7cb7959591c9c74f706ada5224a8b63d8cfa0c88f4aeb28f72639a57` |
| Runtime approval projection schema | `b7e8c2ef294adf7c7066f23d06cb24192d62d8d2b1c6d9c8134875a88a715e80` |
| bundled AsyncAPI | `63f16288786c7f71f41db6b83e0587dae90f853f85968aebb974320f908053d5` |
| generated Go Agent Host | `21ee4a55681fe24284450ea9f3a350916959ed064296aaad5dffb671b6c3ee3d` |
| generated Go v6 Protobuf | `9447aaafb3537ea4e52b15f104da67e932d70d4e9a3c50f0d48840bc94722452` |
| generated TypeScript Agent Host | `30fec0a7b409165f2b316fe422c4227c870dc89263f31c0fc09c517b6cf352b9` |
| generated TypeScript v6 Protobuf | `35f8964f7cc8a11b061d50ca77c676b0fcb08071fba0ee902356e861a4b9ce0a` |
| generated TypeScript v6 event schema | `acaa787bcb90bb25762118eef0a59b172f2d15a65328a044470befd99802b01c` |
| generated TypeScript Runtime approval projection | `f7a243029d40b672951ad795f5591fda3cba716932b3c6bf4d9c46ce5859a1e5` |

These digests identify the reviewed working-tree candidate. HEAD remains
`87f94c9aa6d4848cb67aa8a1265bd21474edb0bb`; there is no new immutable commit and therefore no SHA
that Host may pin.

## Gate result

- focused v1-v6/HTTP/Runtime compatibility tests: PASS, 25/25.
- all safety-compliant Node tests except the pre-existing archive-attack suite: PASS, 88/88.
- `go test ./...`: PASS.
- `pnpm lint`: PASS; OpenAPI/AsyncAPI, 17 JSON Schemas, Proto, TypeScript and Go vet.
- `pnpm check-generated:safe`: PASS; 45 generated SDK files current.
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

Immutable Contracts authority and consumer pin: **NOT RUN**. A separately authorized local commit,
followed by a clean-tree SHA/gate audit, is required before Host may repin or begin implementation.
Host/Desktop conformance and FEAT-137 D4 remain unperformed. Real calls used: 0.
