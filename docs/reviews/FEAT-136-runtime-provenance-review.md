# FEAT-136 Runtime provenance reconciliation review

Date: 2026-08-30

Impact: `semantic`

Authority: the Product/Technical/Security/Data Owner explicitly authorized the minimal Runtime
producer patch needed for early sandbox-denial to publish a canonical Command lifecycle. This is a
local candidate review, not permission to tag, push, publish, deploy, activate public/production,
start Tool D4, or manufacture a Tool producer.

## Exact authority and scope

- Final Runtime repository commit:
  `b2b20e2fc4a0c94834f34d8cc459e488a1b56277`.
- Runtime implementation commit:
  `e6f2aa511c98065054bc7fd968f8767342aa0ecf`; later commits only record verified evidence policy.
- Upstream: `rust-v0.144.6` / `5d1fbf26c43abc65a203928b2e31561cb039e06d`.
- Runtime version/target: `0.144.6` / `aarch64-apple-darwin`; Rust `1.95.0`.
- Transport and gates: stdio, `experimentalApi=false`, `sandbox=read-only`,
  `approvalPolicy=never`.
- Ordered overlays:
  - `0001-feat-126-filter-persistent-diagnostics.patch`, SHA-256
    `6b337a02caf064c6819fab5c7367a485004c85cce0d42acb06fa6d5003e599a0`;
  - `0002-feat-136-unified-exec-pre-emitter-command-lifecycle.patch`, SHA-256
    `43de168e1443f4b9ca60d7f61e3de2daf20e1cfea14d2e196d28ba417bf3e06d`.
- Contracts projection SHA-256 before the new Contracts commit:
  `6cef3f4ac60ec91b9f7f05b188dc677169fc11e0bedf34350f6342a6f50981bb`.

The v5 JSON/Proto/OpenAPI/AsyncAPI shapes and generated SDKs are unchanged by this reconciliation.
The Contracts version therefore remains the unpublished local `0.7.0` candidate. The highest honest
impact is still `semantic`: the observable failure lifecycle changes from absent to canonical
started followed by failed completed even though the wire shape is unchanged.

## RCA and producer behavior

The final `UnifiedExecError::SandboxDenied` branch could return after ToolOrchestrator had completed
its existing approval/retry decision but before the normal command emitter existed. Host cannot
reconstruct the missing Runtime identity, order, duration or terminal authority without fabricating a
producer event.

`0002` repairs only that final branch. For the same call/process identity it emits exactly one
canonical `item/started` in progress and exactly one `item/completed` failed, retaining the original
exit code, duration and aggregate, then returns the original error unchanged. Short denials may emit
zero output deltas. It does not bypass detection, alter model-visible error output, change
ToolOrchestrator retry/approval, widen permissions or sandbox, register MCP/Connector/dynamic tools,
or create a Tool producer.

## Verified evidence

| Check | Result |
|---|---|
| canonical Runtime source vs upstream | PASS; zero drift |
| exact ordered two-patch replay | PASS |
| core early-denial lifecycle unit | PASS; 1/1 |
| safe fake exec-server scenarios | PASS; 4/4, including direct denial and legacy exit; task-specific `RUST_MIN_STACK=16777216` and one test thread |
| app-server protocol mapping | PASS; 1/1 |
| lifecycle assertions | PASS; exactly-once, strict started→completed, same identity, failed terminal, exit/duration/aggregate, zero-delta denial |
| fmt / scoped clippy | PASS; `cargo fmt --all -- --check` and core/protocol `--no-deps -D warnings` |
| fork-management tests | PASS; compatibility 9/9, smoke safety 3/3, manifest allowlist 2/2 |
| independent Runtime review | PASS; no P0/P1/P2 |
| isolated release build | PASS; `codex-cli 0.144.6` for `aarch64-apple-darwin` |
| stable Schema regeneration | PASS; 267 files, tree SHA-256 `82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`, zero tracked diff |
| normal-EOF stdio initialize/initialized | PASS; no credentials or model call |
| Runtime→Contracts compatibility | PASS against the updated v0.7.0 projection |
| focused Contracts v4/v5/runtime tests | PASS; 22/22 |
| safe Contracts Node suite | PASS; 63/63, excluding the pre-existing attack-archive fixture path |
| Contracts lint / Go / TypeScript | PASS; OpenAPI/AsyncAPI, 15 JSON Schemas, Buf, Go vet/test and TypeScript compilation |
| legacy/breaking compatibility | PASS; v1 wire equality plus FEAT-134 and published v0.2.0 baselines |
| wire/generated scope check | PASS; no wire source or generated SDK file changed |

The final fresh artifact manifest has SHA-256
`1cfa2e0a139b2213f4d29b1efeed71d4810110ac865f0bcbd931ff33b0062c1b`. It records binary SHA-256
`4efe16d2848680752cf9aacf4c17741ab2eeb7415894a66c2bb03652b00a322d`, size `355676760`, both patch
digests, normalized build lock identity, 267 schemas and the stable schema tree digest. Binary
identity is build-specific and belongs in this artifact manifest and the Host artifact lock, not in
the public wire contract.

No Provider/model request was made during RCA, repair, build or this review.

## Downstream status and rollback

Existing reviewed Host and Desktop drafts have independent failed-lifecycle coverage, including
stable Host error projection and Desktop SQLCipher/Pinia reconciliation. They still require exact
pinning to the new immutable Contracts commit and the final Runtime artifact, followed by fresh
Runtime→Host→Desktop conformance. Only after those gates pass may the separately authorized real,
safe, read-only Command D4 use at most five Provider/model requests.

Tool D4 remains `BLOCKED/NOT RUN`; no real Tool producer or Owner capability decision exists.
FileChange, Diff, approval, write permissions and FEAT-138 remain outside scope.

Rollback is paired: restore Runtime `0ce5902ed400866be0196886bb78f693a004d68d` and its matching
Contracts provenance, disable the FEAT-136 gate and continue negotiating v4. Do not remove `0002`
while leaving downstream pins or artifact identity on the repaired candidate.
