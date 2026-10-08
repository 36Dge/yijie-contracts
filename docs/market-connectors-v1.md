# Market connectors v1 — FEAT-157 local candidate

Owner: 段成威. Family version: `0.2.0`. Status: unreleased local working-tree candidate, `release=false`. No immutable candidate SHA/tag, published SDK or external service qualification is claimed.

The new isolated family has `contract-impact=additive`: its source and generated modules are new paths and no old family, decoder, permission enumeration, generator or source pin is modified. FEAT-157 as a whole remains conservatively **breaking** because Native management/context semantics, persistent installation/selection records and later turn admission change. This source does not declare the overall feature compatible or complete.

## Authority and consumers

`openapi/market-connectors/market-connectors.yaml` is the single source authority. It uses OpenAPI 3.1 component schemas with an empty `paths` object and an explicit `x-native-ipc` command table; it is **Native IPC**, not a fictional HTTP or Codex app-server API. The generated JSON Schema resolves the same components at `#/$defs/Name`. No URLs, commands, platform credentials or environment maps are accepted from the renderer.

- Native Desktop owns product installation/revision/operation state; renderer consumes its safe projections.
- Connectors owns the 49-entry product catalog (Owner removed Taobao and Doukou), external prerequisites and credential boundary. The user's reference JSON is not runtime configuration and is not copied into this contract.
- Host is a future consumer of versioned selection references/control facts, not an authority for platform credentials. This family does not activate a Host route or generalize the old Sorftime approval family.
- Connectors' EOF-owned worker consumes the separate private status request described below. It is not an upstream Runtime RPC.
- Public/production is inactive. Consumer implementation, authorization, exact catalog membership, execution qualification and live provider behavior need separate evidence.

## Native envelope and command table

All invoke arguments contain one `request` object:

```json
{
  "request": {
    "schemaVersion": 1,
    "requestId": "00000000-0000-4000-8000-000000000157",
    "contextId": "00000000-0000-4000-8000-000000000158",
    "payload": {}
  }
}
```

`contextId` comes from the existing `chat_bind_management_context_v1`; it is not a client-submitted identity or tenant. Native validates the stored binding and current local scope independently. The FEAT-157 consumer extends the binder's existing `schedule.read` admission to `schedule.read OR connector.read` **only inside the local connector feature path**. This is a semantic extension owned and tested by Native; it must not broaden public admission or silently repurpose schedule/plugin/knowledge permissions.

Success returns `{schemaVersion:1, requestId, data}`. Safe error returns `{schemaVersion:1, requestId?, code, retryable}`. Invalid request identity omits requestId. There is no free-form error/provider text or OAuth URL. A requestId correlates transport; operationId is the independent durable management intent identity.

| Command | Payload definition | Success data | Permission |
|---|---|---|---|
| `market_connectors_snapshot_v1` | EmptyPayload | Snapshot | connector.read |
| `market_connectors_install_v1` | InstallPayload | MutationResult | connector.manage |
| `market_connectors_set_enabled_v1` | SetEnabledPayload | MutationResult | connector.manage |
| `market_connectors_uninstall_v1` | UninstallPayload | MutationResult | connector.manage |
| `market_connectors_configure_v1` | CredentialOperationPayload | MutationResult | connector.credentials.manage |
| `market_connectors_authorize_v1` | CredentialOperationPayload | MutationResult | connector.credentials.manage |
| `market_connectors_operation_read_v1` | OperationReadPayload | Operation | connector.read |
| `market_connectors_operation_cancel_v1` | OperationCancelPayload | Operation | permission owning the original operation |
| `market_connectors_selection_validate_v1` | SelectionValidatePayload | SelectionValidation | connector.use |

`CONNECTOR_CAPABILITIES` is generated for TS/Rust and `ConnectorCapabilities` for Go. This family adds the four explicit capability identifiers. It does not expand a legacy closed enum or interpret unknown capability strings as grants. Read does not grant manage; manage does not grant credential changes or use. Cancellation rechecks the original operation scope and action's permission (credential operations require credentials.manage); a caller-supplied action cannot choose a weaker check.

Configure/authorize only request a trusted Native/Connectors flow. Payloads contain installationId, operationId, expectedRevision and expectedGeneration; they never contain secret, raw file path, callback/endpoint, header, command, env, client secret or arbitrary key/value settings. A credential reference, if projected, is opaque and non-redeemable. Renderer cannot set it.

## State, replay and selection semantics

One live installation exists per `(local scope, case-sensitive serviceId)`. `serviceId` preserves original `serverName`; syntactic schema validity is insufficient—Native checks exact Connectors registry membership. Installation IDs and request/context/operation IDs are canonical non-nil lowercase UUIDs. All live revisions and connection generations are positive integers at most `2^53-1`; install alone requires `expectedRevision=0`. Absent optional fields are omitted, never explicit null.

Same operationId and exact intent replays its original receipt; different intent returns request_conflict. A different operation with an obsolete expectedRevision returns revision_conflict without changing state. One service has at most one active management operation; different services remain independent. operation_cancel targets the original operation ID and its receipt revision. Closing a panel does not cancel. Cancellation is possible only while its observed stage is cancellable; elapsed waiting time never proves an external action did not run.

Configuration, authorization, connection, desiredEnabled and effectiveEnabled are separate facts. Reopen may restore desired intent but starts effective false until current qualification. Disable first fences new execution, then normal cleanup; pending/unknown cleanup is retained. Uninstall requires product confirmation, creates a tombstone/fence, and completes only after applicable cleanup acknowledgements. Neither local credential deletion nor cancellation asserts supplier-side revoke or reversal.

Snapshot.executionAvailable is a global execution qualification fact. False makes every connector unselectable even if cached per-item fields look ready. The currently unqualified backend must return false. A directory record, installed row, saved reference or library link does not establish readiness.

SelectionRef has only installationId/revision/generation. It is a candidate reference, never a grant. selection_validate rechecks capability, scope, state, registry and duplicate installation identities and returns safe display snapshots. JSON uniqueItems catches exact duplicates; Native additionally rejects repeated installationId with different revisions. Empty selection preserves ordinary chat when execution is unavailable. Nonempty invalid selection must fail; it cannot silently become plain text. Actual submission must recheck atomically and use a separate versioned turn integration; this family does not weaken an old turn decoder or authorize an external tool call.

Request objects are closed. Response objects tolerate extra fields for forward compatibility, while generated native/Go decoders drop them; they must never be echoed, logged or persisted. Known fields and enums stay strict. Unknown enum/permission/version fails closed, not mapped to ready/allowed. Consumers using standalone AJV must project only generated known fields after validation rather than forwarding raw objects. Worker control remains closed in both directions.

## Private worker status qualification

`WorkerAuthStatusRequest` is a JSON line on the owner-managed worker stdin:

```json
{"schemaVersion":1,"requestId":"00000000-0000-4000-8000-000000000157","method":"auth_status","serviceId":"synthetic-service"}
```

The worker performs only registry/policy observation, without reading Keyring, initializing a remote MCP session or launching OAuth. For a known service it returns `WorkerAuthStatusResponse` with qualification=`not_qualified`, authorizationStatus=`unknown`, connectionStatus=`disconnected`, executionAvailable=false and the policy record. Unknown service returns `WorkerError.code=unknown_service`; an attempted capability not qualified would return not_qualified. LibraryPolicy declares codex-rmcp-client, keyring_only, connectors_only, eof_only and externalCallsEnabled=false. These constants deliberately prohibit claiming a compiled library constitutes verified account or execution support. Future activation needs a source-first versioned policy review, not a runtime toggle that contradicts these constants.

The parent owns process lifecycle: normal EOF and wait, no forced termination escalation. The private control family gives no platform bearer, OAuth cookie, file path or user data to Host/Runtime/renderer. It does not invent mcpServer/oauth/logout or another unsupported app-server RPC.

## Generation, validation and source identity

The 2026-10-07 local candidate adds optional `CatalogEntry.authorizationAvailable: boolean` with omitted meaning false. This is an additive response capability: older readers may drop it, and new readers must use an explicit true plus `connector.credentials.manage` before offering authorization. `authMode` is service reference metadata, not evidence of a compiled local adapter. Native may project true only for the explicitly assembled Tushare authorization adapter in the market profile. This field does not change `availability=unverified`, authorization state, desired/effective enablement, tool qualification or `executionAvailable=false`; authorization never automatically enables financial calls. Generated Rust uses `Option<bool>`, Go `*bool`, and TS an optional boolean; null is invalid. The 55-definition count, old worker policy constants and command table remain unchanged.

Canonical independent commands:

```sh
node scripts/generate-market-connectors.mjs
node scripts/generate-market-connectors.mjs --check
node --test tests/market-connectors.test.mjs
go test ./sdks/go/market-connectors
cargo test --offline --locked --manifest-path tests/rust-market-connectors/Cargo.toml --target-dir /tmp/yijie-feat157-contracts-rust-target
cargo clippy --offline --locked --manifest-path tests/rust-market-connectors/Cargo.toml --target-dir /tmp/yijie-feat157-contracts-rust-target --all-targets -- -D warnings
```

The generator emits typed Go/Rust/TS, source JSON Schema, and standalone Ajv ESM validators for all definitions. Validator source comes mechanically from Ajv 8.20.0 and its pinned MIT helpers (license notices retained); it has no runtime Ajv dependency. Rust uses serde with generated field constraints and response projection; Go uses generated Validate/UnmarshalJSON; native semantic checks remain required for ownership, registry and cross-record consistency.

`compatibility/market-connectors/source.lock.json` records an actual pre-change base commit and source/generated SHA-256 values in mode `local_worktree_candidate`. It has no fabricated source_commit and cannot satisfy release/immutable provenance. Existing immutable source locks remain unchanged. Explicit consumer sync/check accepts exactly one target:

```sh
node scripts/sync-market-connectors.mjs --consumer=desktop
node scripts/sync-market-connectors.mjs --consumer=desktop --check
node scripts/sync-market-connectors.mjs --consumer=connectors
node scripts/sync-market-connectors.mjs --consumer=agent-host --check
```

Only run a write sync when that consumer's work is authorized; selecting a target does not grant permission to change another repository. The source family is not exported from the legacy SDK entrypoint, and no old generator is edited. Full legacy generation/test-generation is not used for this addition: it rebuilds pinned SDK families and has historical attack-fixture generation. The focused family generator/check is the canonical path, not a bypass of old checks. Normal existing lint and safe structural baseline checks remain applicable. No malicious fixtures, permission faults, executable substitution, forced process kills or real provider requests form part of this contract verification.

## Compatibility, activation and rollback

Comparison bases are current pre-feature fallback `1a213ac8383e95ac6ec69363937687904fa3591c`, supported `f16a497e1377f45747f8ff9292b4b60cf2027f88`, and retained Native sources `6f632f155eacdaf93df0e0b00b5dab9e369c5442` / `811f38d6b104fa18477107e7ac91a85e19c445d1`. None contains this new family. Unchanged old authorities and separate generation paths establish source-level isolation; they do not prove consumer or end-to-end compatibility.

Order: source and generated local family → safe Connectors catalog/status producer → Native context/reader/operation consumer → renderer consumer → separately qualified execution/turn integration. New consumers facing missing local capability keep execution unavailable and do not fall back to arbitrary user configuration or a relaxed old API. Rollback disables the new feature and normal-stops its worker while retaining necessary compatible readers; never decrement a database version, delete history, or imply external business actions can be rolled back. No tag, push, merge, release or public exposure is authorized by this document.

## 0.2.0 — original authorization page recovery

Adds `market_connectors_operation_reopen_v1` with a current management context, original operation ID and receipt revision. It returns the existing Operation response and never exposes the URL or accepts platform settings. Native reads the original worker operation, then opens only its current awaiting-user page under `connector.credentials.manage`; it never starts a new auth/DCR/probe or changes credential generation. A terminal result is read-only; cancelled/expired/replaced operations cannot reopen. Browser-open failure can be retried explicitly on the same pending operation. Automatic first-page opening also requires credentials management permission, while read-only receipt consumers keep reading without this side effect.

Contract impact is semantic overall for the browser permission correction, with an additive command and unchanged existing payload/response fields. New UI and Native ship in the same Desktop bundle; deploy the new Native before invoking the new command. Old clients do not send it, and old Native fails closed for it. No database migration, Host/Broker command or Runtime protocol change. Local source-first generators and all dependent source locks are synchronized; no release provenance claim.
