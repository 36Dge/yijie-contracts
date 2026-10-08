# FEAT-157 Contracts source-first record — 2026-10-07

Status: local source/generated candidate; implementation and external acceptance are separate. No commit/push/tag/release was performed.

## Source identity

- Existing HEAD / pre-feature comparison base: `1a213ac8383e95ac6ec69363937687904fa3591c`.
- New source, canonical generator and exact projections are bound by `compatibility/market-connectors/source.lock.json` in `local_worktree_candidate` mode with `release=false`.
- No `source_commit` is fabricated. Source hashes identify current bytes, not a committed or released candidate.

| Source | SHA-256 |
|---|---|
| `openapi/market-connectors/market-connectors.yaml` | `236c785b16127ced0a53e3aa6ddd8b76856375385578e091e09fdeddfae7ae02` |
| `scripts/generate-market-connectors.mjs` | `bd98d36ad80fcb3d387d112c68dd789ccbd7120cd7973a731f7c2a0a8d7adc13` |
| `scripts/sync-market-connectors.mjs` | `ced59ca54a8280104767f66c036afd7bc1eba0ff03a54ac92c3e2dc8da214479` |
| `pnpm-lock.yaml` | `57eece158a0405a85ea9b8fd2c382af130e4248897b67af587878737bbf86313` |

## Executed checks

| Check | Result / scope |
|---|---|
| Independent canonical generation and `--check` | PASS; 55 definitions, 9 Native commands, private unqualified-worker status |
| Standalone AJV + source conformance | PASS; 9 Node tests; normal requests/observations, revisions, context, closed requests, response tolerance, unknown enums, optional nulls, worker policy |
| Generated Go package | PASS; 5 tests, including dropped unknown response fields and required arrays not serializing as null |
| Generated Rust conformance | PASS; 5 offline/locked tests using exact cached serde 1.0.228 and serde_json 1.0.150 |
| Rust clippy | PASS; all targets, `-D warnings`; generator corrected empty wire variable, boolean constants and enum naming; no lint was disabled |
| TypeScript `tsc -p tsconfig.json --noEmit` | PASS; EmptyPayload generated as Record<string,never> for consuming lint compatibility |
| `make lint` | PASS; existing Redocly unused-component warnings (12) retained; registered existing APIs/schemas/proto + TS + Go vet |
| Desktop explicit canonical sync + check | PASS for the generated projection paths at sync time; not an independent Desktop behavior claim |
| Existing tracked source isolation | PASS; no diff relative to base in openapi/jsonschema/protobuf/asyncapi/compatibility or old generator/checker files |
| `git diff --check` | PASS |

## Baseline evidence and limitation

| Exact baseline | `scripts/check-breaking.sh` |
|---|---|
| `f16a497e1377f45747f8ff9292b4b60cf2027f88` | PASS |
| `6f632f155eacdaf93df0e0b00b5dab9e369c5442` | PASS |
| `811f38d6b104fa18477107e7ac91a85e19c445d1` | PASS |
| `1a213ac8383e95ac6ec69363937687904fa3591c` | BLOCKED after 10 unchanged OpenAPI comparisons; old scheduled-plan-draft baseline tries resolving `https://schemas.yijie.ai/scheduled-tasks/draft-execution/v1` and returns EOF |

The final row is not marked PASS and the legacy checker/source was not relaxed. Independent tracked-source byte equality against that base establishes that old authorities have not changed; it does not claim the unfinished global checker or consumer E2E passed. The new family is absent from each old baseline and is covered by its focused source/generated schema tests.

## Not run / boundary

- Legacy `make generate` / full generation-based `make test`: not run because the old path regenerates pinned unrelated families and includes historical skill attack-fixture generation. The new family has its own canonical Make targets; normal focused tests and unchanged legacy lint were used. This is not a full-repository-test PASS claim.
- Real MCP initialize/list/call, OAuth, account/Keyring reads, external business actions, npx and provider billing: NOT RUN by this contract task. The old baseline checker made only the failed schema-document lookup described above, not a provider business call.
- No attack injection fixtures, forced process termination, executable replacement or permission corruption were performed.
- Host/Desktop behavior, platform credentials, worker library qualification, all 51 services and D4 remain separately owned evidence; source readiness is not feature completion.

Canonical commands, producer/consumer boundaries, binder semantic extension, compatibility and activation order are in [market-connectors-v1.md](market-connectors-v1.md).

## Additive authorization adapter capability follow-up

`CatalogEntry.authorizationAvailable` is optional/non-null boolean; absence is false. Ordinary source/AJV, Go and Rust conformance cases cover omission, explicit false/true, and retain unverified catalog / unavailable execution facts. Null is rejected without changing old worker no-network policy. Generation and dependency locks for management, selection, Broker, provider and Host were regenerated and all 11 consumer routes synchronized through their canonical scripts. No consumer implementation was edited by this Contracts task.

Focused results: 29 JS tests passed across management/selection/Broker/Host, Go tests for all five market packages passed (provider compiled with no separate Go test file), management Rust 6 tests passed, full schema lint and TS typecheck passed. This narrow update does not claim a rerun of historical global baselines or real OAuth/Keyring/provider behavior; previous recorded exclusions and blockers remain unchanged. Contracts source readiness only enables consumers to distinguish authorization availability from execution qualification.
