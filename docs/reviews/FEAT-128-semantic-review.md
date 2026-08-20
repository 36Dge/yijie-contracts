# FEAT-128 Contracts semantic and security review

Date: 2026-08-20

Impact: `semantic`

Reviewer authority: Codex recorded the Product/Technical/Security/Data Owner's direct instruction
for this task and performed the Contracts-source review under that instruction. This is not an
independent second-party review and does not by itself approve G2A, release, or production use.

## Scope and baselines

The review covers only yijie-contracts S1/S2 source, generated SDKs, fixtures, and checks. It does
not review or authorize Agent Host/Desktop business implementation. Compatibility is checked
against both:

- published supported baseline `f16a497e1377f45747f8ff9292b4b60cf2027f88`;
- pre-FEAT-128 candidate `747cf740f2d91e76e5c1a130e8e009f1efa821b8`.

## Semantic conclusions

| Boundary | Reviewed conclusion | Result |
|---|---|---|
| Version isolation | V3 requires the v3 path plus `event_schema_version=3`; v1/v2 sources remain present; `after` is authoritative and `after_sequence` is absent | PASS |
| Event compatibility | All v2 lifecycle/reasoning variants validate under schema version 3; the four new `item.artifact.*` events are non-turn-terminal | PASS |
| Artifact identity/order | Host UUID, kind, provenance, and ordinal are required and immutable across a stream; started precedes progress and exactly one terminal; regression/drift/double-terminal negatives are executable | PASS |
| Producer gate | Four kinds have exact-local `provenance=synthetic` lifecycle/resource fixtures; schema reserves provider/tool values but candidate documentation leaves real producers closed | PASS |
| Resource safety | Completed events contain only allowlisted MIME, bounded size, lowercase digest, and exact relative content/poster patterns; poster is video-only; no URL/path/token/body field exists | PASS |
| HTTP resource semantics | content/poster have owner-only GET/HEAD, no redirect, no-store, nosniff, single-range responses, typed missing/expired/range/internal failures | PASS |
| Desktop commit ACK | ACK request freezes ID, size, digest, and local commit time; canonical replay is idempotent; reuse/mismatch/not-ready fail closed; response does not claim Desktop deletion | PASS |
| Retention clocks | Host staging is independently cleaned by ACK/restart/`staged_at+24h`; durable Desktop expiry remains `local_committed_at+168h` | PASS |
| Report decoding | Closed root plus six closed known sections; unknown section accepted only with `required=false`, retained opaque, and annotated with 128 KiB/8-depth preflight bounds; unknown required and markup injection fixtures reject | PASS |
| Failure/cancel | Stable Artifact error enum matches the approved G2 list; only existing turn interrupt maps to `turn_interrupted`; no artifact cancel endpoint is invented | PASS |
| Old wire | v1 reference closure equality and structural breaking checks pass against both baselines; additions use v3 paths/packages/schema IDs | PASS |

## Source/generated identity before immutable commit

| Artifact | SHA-256 |
|---|---|
| Agent Host OpenAPI | `cf72ba8dd6910e8454ad60feeffa5e82583303b441dad78e49910fbdb9f5420f` |
| AsyncAPI source | `e7ea38b310d406bf09441b11ff5e8a8f2931e3b246f99c51be7d10d27ac61090` |
| AgentSessionEventV3 JSON Schema | `87b1284056529bde8314e6cfa6ad1fb27ffefef50ea86033875fda795330939f` |
| ReportDocumentV1 JSON Schema | `94715e5b821cca686405d06004b805e9eac6d39dc61e19c9fc38925102f79556` |
| v3 Protobuf source | `5021a0342b84cdea0e1dd773728e4c8f013ce7d03377ade18f06f6716a81b70d` |
| bundled AsyncAPI | `c70b2bc5755c56da3ed84016c4712a25aa66a4166b76920871483bb65dfab5d8` |
| generated Go Agent Host | `4b7c5bb77e369151807fac11a7663435d7ea9f9f632b8e3be5a4979f9edcb7c5` |
| generated Go v3 Protobuf | `d07e67817f797bde4b7c935489ec81e40109759bce565a2add49a45182acf9b5` |
| generated TypeScript Agent Host | `adfa0e4c3b700b65470f0f6c8a6da0403eec41ec8cbb6a2748c0440a29f9c866` |
| generated TypeScript event schema | `a072d614ec967e12dfbf84616a0ccf2f1882aeb090f21c9f2fc88a5cf7d6022f` |
| generated TypeScript report schema | `44c0e32a5888241246158b47db8af1edbef1cad4fa79bf45fd6150cfdad964db` |
| generated TypeScript v3 Protobuf | `da8aad84acf21976ba99d392c8f9036920a3b94a83a34155a28cca6e08d04efe` |

These digests identify the reviewed source/generated tree. The immutable full commit is recorded in
the external FEAT-128 delivery package after commit creation so this document does not self-reference
an identity that did not yet exist.

## Gate result

Contracts semantic/security review: **PASS** for the local S1/S2 candidate.

G2A: **PENDING** because Host and Desktop exact immutable pins/conformance are intentionally not
performed inside the Contracts-only authorization boundary. No Host/Desktop implementation may
start on the strength of this review alone.
