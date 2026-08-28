# FEAT-134 Contracts semantic and security review

Date: 2026-08-28

Impact: `semantic`

Reviewer authority: Codex recorded the Product/Technical/Security/Data Owner's direct FEAT-134
authorization and reviewed the Contracts source within that exact local-only boundary. This is not
an independent second-party review and does not approve a tag, push, publish, public/production
activation, Host/Desktop implementation without exact pinning, or canonical paid prompt before the
full chain is ready.

## Scope and baselines

This review covers `yijie-contracts` v4 source authorities, generated SDKs, synthetic fixtures,
compatibility projection, and deterministic checks. It does not claim Host/Desktop conformance.
Compatibility was checked against:

- prior local candidate `164b14f609537d727a52326832da04430aecc4ab`;
- published supported baseline `f16a497e1377f45747f8ff9292b4b60cf2027f88`.

The pinned external Runtime remains
`yijie-codex@0ce5902ed400866be0196886bb78f693a004d68d`, upstream `rust-v0.144.6`,
`experimentalApi=false`. Runtime source, binary, build, installation, schemas, schema count, and
schema digest were not changed.

## Semantic conclusions

| Boundary | Reviewed conclusion | Result |
|---|---|---|
| Version isolation | V4 requires `/v4/.../events` plus `event_schema_version=4`; v1–v3 source schemas/protos and Public/Admin/Internal sources have no diff | PASS |
| AgentMessage phase | AgentMessage started/completed require text and closed `commentary | final_answer | null`; omitted/unknown string rejects; non-AgentMessage forbids phase; delta stays text-only | PASS |
| Phase reconciliation | Same-item completed lifecycle is the latest phase/text authority and can refine started null; null is never inferred as final | PASS |
| Stable plan | `turn.plan.updated` requires turn, forbids item, is non-terminal, has ordered closed steps, and atomically replaces by higher sequence; empty clears and omitted/null explanation clears | PASS |
| Projection bounds | Compact v4 data is capped at 1 MiB before replay/write; reasoning retains unavailable; other turn overflow yields sanitized `limit_exceeded` plus failed terminal; managed thread identity fails start and thread warning maps to a sanitized warning, so no-turn variants are closed | PASS |
| Experimental exclusion | `item.plan.delta`, `turn/plan/updated` wire spelling, invented step IDs, and unknown plan statuses reject | PASS |
| Reasoning preservation | V4 accepts v3 reasoning semantics and reinstates v2 item/turn/UTF-8/content-index annotations; raw projection remains a separate exact-local Host authorization | PASS |
| Artifact preservation | V4 accepts v3 artifact variants and retains existing owner-only `/v3` artifact resource authority; no duplicate v4 resource route is invented | PASS |
| Runtime projection | Compatibility allowlist adds only existing stable `item/reasoning/textDelta` and `turn/plan/updated`; experimental `item/plan/delta` is absent; Runtime identity remains exact | PASS |
| Privacy | Contract examples are synthetic; OpenAPI/docs prohibit Host durable/log/metric/trace/audit/error-body storage of prompt, reasoning, plan, or final body | PASS |
| Activation | Exact local `demo_fast` Feature gating is required; reasoning effort is a Host-private fixed policy, absent from API/event/UI; public/production remains closed | PASS |
| Old wire | v1 reference-closure equality and structural checks pass; both prior candidate and published baseline report no breaking OpenAPI/Proto/AsyncAPI/JSON Schema change | PASS |
| Runtime validation | JSON Schema negative refinement and aggregate annotations are not treated as TypeScript-only safety; downstream must use runtime validation or an explicit closed parser with conformance fixtures | PASS |

## Source/generated identity before immutable commit

| Artifact | SHA-256 |
|---|---|
| Agent Host OpenAPI | `49e2171e41e0fc11313a114c82ff09e11a0df396e4b366a03b0d7e3afe1766df` |
| AsyncAPI source | `c38baa3a6f48acf263a9dacea58da66d944464b1e942088e3ae15ac1c048d52c` |
| AgentSessionEventV4 JSON Schema | `d972806e59195c5e1f5fe810db6e1df80be349b77ecc4cf192ed0f391d9ed739` |
| v4 Protobuf source | `7130ffad6f7d415bbaaf35a10bc380b2b75ecaaa4762dc871ce0a274472ecdea` |
| Runtime compatibility projection | `6d28e3ad1bb941561ce08a231abf003dd0e69b5dcafe6376cc5987c3d1f07a00` |
| bundled AsyncAPI | `8ee17ea4b40f33c65736d3d60bfafc0ac8cad3775aad7cc2782b22e90ebb01e5` |
| generated Go Agent Host | `b5f2757b701b2a5336a12f69538ddf6d1aa31f45c1a820798ef0e354080bb80e` |
| generated Go v4 Protobuf | `4b0fde1dd127baf13e3f02121b88bfdf6d78035cd74ea8e6db403084d8dbd13f` |
| generated TypeScript Agent Host | `79d81e4e698b656b2018933d9e4ffaf58f89da2fa37e6d034ed54a96d28e371b` |
| generated TypeScript v4 Protobuf | `86eecfc15c7056667a4e5a9cb3f3db910907648bc3532d66cb52736095afa371` |
| generated TypeScript v4 event schema | `3e5768ca34e0ff93f79c4be2b7d864e784fda2644e0db9e22a4e6be531325b2e` |

These digests identify the reviewed pre-commit tree. The immutable full commit is intentionally
recorded in the FEAT-134 governance package and downstream locks only after commit creation; this
file cannot truthfully self-reference its not-yet-created commit.

## Gate result

- `pnpm generate`: PASS; 14 JSON Schemas generated, no bundler schema-name warning.
- `pnpm lint`: PASS.
- `pnpm test`: PASS; 56 tests.
- `pnpm build`: PASS.
- legacy v1 wire equality against the published baseline: PASS.
- breaking checks against both baselines: PASS for OpenAPI, Protobuf, AsyncAPI, and JSON Schema.

Contracts source-first candidate review: **PASS**.

Cross-repository completion: **PENDING**. A Contracts commit is required before Host can perform an
exact immutable sync/pin. Host/Desktop conformance, exact-local activation, the single authorized
content-free canonical prompt, and FEAT-134 D4 remain unperformed. Paid prompt budget remains 0/1.
