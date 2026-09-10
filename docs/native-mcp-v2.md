# FEAT-144 native MCP v2 candidate

Contract impact is **breaking** at the new Desktop durable/display boundary, delivered through explicit new versions: native-conversation v2 / SSE v8 / native-thread v2 and runtime-permissions v2. Original v7/v1 and FEAT-152 mode semantics remain unchanged. Source authority is the fixed Codex 0.144.6 schema; Host is the producer, Desktop the consumer. Owner is 段成威. This local implementation was explicitly authorized; no release, tag, push or production approval is implied.

The new MCP display preserves native server/tool, original content indexes and native Item status. It allows only safe plain text from the first 32 original content blocks, 256 KiB total UTF-8 after existing whole-line redaction. Empty strings, null/absent result, unsupported content and redacted/limited content remain distinguishable. URLs are inert and structuredContent/resources/meta are not passed through. Existing resultSummary remains metadata-only. There is no business error extension or new execution engine. AC-004 was explicitly excluded by the Owner, not passed.

Runtime-permissions v2 adds the stable MCP Prompt display and one-shot accept/decline/cancel response mapping. It does not change command/file/permissions decisions. Only verified native parameters for sorftime/product_detail, a single public ASIN and US can be presented; callbacks retain native request/thread/Turn binding in memory. Unsupported requests are rejected. Approval status is not Tool execution status.

Implement and verify the versioned private Desktop reader and forward format migration first, then record the minimum compatible rollback reader before activating new writers. Old JSON stays untouched; newer database versions remain rejected by old binaries. Unknown readable-database payload formats produce local recordDiagnostics and are excluded from cold recovery and active-buffer creation. Do not introduce facts replay. Rollback is to the compatible reader baseline, never an older incompatible binary.

Generate with `node scripts/generate.mjs --native-mcp-only`. Explicit `node scripts/sync-native-mcp.mjs --candidate` is for local draft tests only; canonical uses an actual full commit and `--require-committed`. No placeholder pin is publishable. Generated code must not be edited directly. Full generation includes both new families.

Compare all supported baselines, including `f16a497e1377f45747f8ff9292b4b60cf2027f88`, and the current native baseline `6f632f155eacdaf93df0e0b00b5dab9e369c5442`. Old source shapes and paths stay byte-for-byte unchanged; new-version conformance is tested separately. Actual checks and final commits are recorded in the FEAT-144 delivery report, not inferred from this candidate plan.

The permission-scope v2 operation deactivates MCP availability before an existing FEAT-152 mode change. It grants no permission: active Turns prevent shutdown, actual native idle/normal EOF/transport cleanup/source-verified restart must be confirmed, and returning to ask does not reconnect. Native startup notifications and a counted toolsAndAuthOnly catalog read must confirm the actual tool and the frozen operation-8 input schema. Compatibility source data is `compatibility/sorftime-product-detail.input.schema.json`; it is not an invented output contract.

## Current thread status read extension

The FEAT-144 rejection regression exposed a local admission check using historical Turn
snapshots to decide whether the native thread is currently active. A completed historical
Turn does not prove native idle. This extension reuses the fixed Runtime's stable
`thread/read(includeTurns=false)` and projects only `thread.status.type`; it does not add a
state machine or change native execution or FEAT-152 permission admission.

The source-contract impact of this extension is **additive**: the new
`GET /v2/agent-sessions/{agent_session_id}/native-thread-status` operation has an independent
closed `NativeThreadStatusSnapshot`. Its required fields are `schema_version=2`,
`source=runtime_read`, the existing bounded `thread_id`, and the exact native type
`notLoaded | idle | systemError | active`. The path retains the existing UUID session
parameter and owner-only bearer binding; every response uses `Cache-Control: no-store`.
The existing safe session error mapping applies, including a native read/status failure;
unknown or missing native status never becomes a guessed idle value. Native active flags,
Turn history, raw errors, paths and credentials do not enter this DTO. A returned status is
an observation, not a lease; native admission remains responsible for later execution.

Owner is 段成威 / Contracts Owner; producer is `yijie-agent-host`, and the only known
consumer is `yijie-desktop`. The Runtime commit, schema tree, permission decisions,
old v1/v2 history DTOs and SSE schemas stay unchanged. This response is ephemeral and
must not be stored as a new history format, replayed to reconcile Items or Turns, or
used to manufacture their terminal states. No writer change, history migration or
rollback-reader upgrade is needed. AC-004 remains Owner-excluded.

Deployment direction is provider-first: freeze the Contracts commit, pin and implement
the Host endpoint, then enable new Desktop requests. A new Desktop paired with an old
Host must report that current native status cannot be confirmed and deny the dependent
local action. It must not fall back to inspecting historical Turns. Roll back the new
Desktop call site before removing the Host endpoint; retained history is unaffected.
The existing native Go client interfaces and response initializer stay source-compatible;
`ClientThreadStatusInterface` / `ClientWithThreadStatusResponses` explicitly opt into the
new operation. The established generator produces this compatibility wrapper and uses
distinct new enum symbols, so existing exported symbols remain unchanged. Generated
Go/TypeScript and Desktop's schema-driven Rust types are the only DTO sources.

Review checks cover the immediate pre-extension source
`db54c617c65db5431b950eb297ba148a43a8e600`, the fixed native-v1 source
`6f632f155eacdaf93df0e0b00b5dab9e369c5442`, and supported release
`f16a497e1377f45747f8ff9292b4b60cf2027f88`. Contract conformance additionally compares
every old v2 path/schema and Go client interface to the pre-extension source.
The source commit and consumer review/check evidence are recorded in the FEAT-144
delivery package after review; this draft is not an activation or D4 PASS.

Source generation is `node scripts/generate.mjs --native-mcp-only`. After source review
and an actual commit, use `node scripts/sync-native-mcp.mjs --commit <full-commit>`;
Desktop's existing `node scripts/generate-native-conversation.mjs` traverses all public
schemas and emits the new Rust DTO without modifying old DTOs. The shared source generator
digest also belongs to the native-v1 provenance manifest, so synchronize its real pin with
`node scripts/sync-native-conversation.mjs --commit <full-commit>` even though the v1 wire
source and generated SDK bytes are unchanged. Canonical consumers must pass the existing
`--require-committed` checks; no source check is bypassed.
