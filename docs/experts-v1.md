# FEAT-158 Experts local contract family

Owner: 段成威. `experts/1`, version `0.1.0`, unreleased local working-tree candidate. **Contract impact: breaking** for FEAT-158, including durable expert identity/replay and the required `BindingView.managed` response field. The first-stage new family was recorded as source-only additive relative to untouched ordinary authorities; that historical classification does not make successive local candidate shapes compatible. All participating candidate consumers must sync together. Existing ordinary wire schemas and immutable release pins remain unchanged. No tag, release, production exposure or model-quality result is implied.

## Authority and source-first order

`compatibility/experts/wire.schema.json` defines the new private/local wire. `native-ipc.json` declares ten safe Native commands; `transport.json` declares eleven methods on the **existing Native-owned Host JSONL pipe**, its existing hello/scope authority, bounded per-method deadlines and deterministic digest encodings. No independent listener, bearer, identity provider, Runtime API or second grant lifecycle is introduced.

| Private method | Purpose | Host deadline |
|---|---|---|
| `expert_apply_binding` | Apply the original binding intent to an existing owned thread | 20 s |
| `expert_operation_read` | Read the original binding receipt | 5 s |
| `expert_grant_register` | Register the existing one-use grant with a frozen expert snapshot | 5 s |
| `expert_submit` | Submit the frozen wrapper through the existing turn pipeline | 25 s |
| `expert_submission_read` | Read the original submission receipt and snapshot | 5 s |
| `expert_status` | Read actual adapter support, pinned catalog and resource operations | 5 s |
| `expert_resources_prepare` | Prepare the exact catalog resource through managed Skills | 25 s |
| `expert_resources_remove` | Remove an unreferenced resource through managed Skills | 25 s |
| `expert_resources_operation_read` | Read the original resource operation | 5 s |
| `expert_binding_recover` | Explicitly re-apply the original composition to the same idle thread | 20 s |
| `expert_resources_recover` | Explicitly settle the original managed resource journal without installation/removal | 25 s |

`jsonschema/skills/skill-bundle-manifest-v3.schema.json` is the public managed-asset format authority. Skills produces it; Host and Native consume it. It preserves the v2 ordinary entry directly by `$ref`, also accepts an explicit `asset_kind=skill` form, and adds `asset_kind=expert_resources` on the same flat `skills[]` collection. Existing field constraints reference v2. Conditional clauses requiring inherited object context are mechanically inlined with external references and checked against v2 by focused conformance; the v2 source itself is byte-identical. Expert-only additions are distinct reviewed semantics, not relaxed ordinary Skill rules.

Order: source and generated validators/types → Host provider and compatible readers → Native transactional reader/writer and ordinary/expert dispatch fencing → renderer calls. A missing provider/unknown version fails closed. New response enums remain closed. New wrappers never attach expert fields to an old closed message or silently drop the expert context through an old submit path. New expert outboxes are not executed by feature-off legacy dispatch.

## Safe UI and private state

The browser closure contains safe `ExpertSelection {expertId,version}`, `ExpertDisplay`, resource status and binding/operation views. It excludes `ExpertRef`, asset paths, checksums, role/knowledge bodies, Host scopes, private grant calls and arbitrary configuration. Native resolves the current owned context; requestId is correlation, operationId is durable user intent, neither is authority.

Resource preparation/removal uses `plugin.manage`; listing uses `plugin.read`. Binding reads use `task.read`; changes additionally require normal chat execution authority and `plugin.read` for non-null selection. Existing chat and connector-use checks apply to submissions. No new permission string is introduced. The application must recheck native scope and exact catalog membership, not trust a UI capability flag.

Binding requests require `operationId`, local `sessionId`, `expectedBindingRevision`, and explicit expert reference or `null`. A pending send, running turn, pending approval/input, cleanup or unknown outbox/apply prevents modification under the shared existing session/model/thread lock. The application request uses `bindingRevision=expected+1`; receipt `bindingRevision` is the confirmed effective revision: success is `expected+1`, pending/unknown/rejected remains `expected`. Receipt `expert` (private) or `requestedExpert` (safe operation view) preserves the original request, not the effective current binding. Unknown blocks sends and new changes until the original operation is resolved. Read never sends a probe turn.

`BindingView.managed` is required and is the Native authority for the conversation's submit family. `managed=true` remains true with `expert=null` and revision 0, for example after explicit-none first submission or a rejected first apply. A missing binding row returns `managed=false`; clients must not infer ordinary mode from the label, null expert or revision alone. Native schema 35 upgrades only valid prior expert binding receipts with the missing managed flag; it does not rewrite ordinary messages or receipts.

An unsent draft has no Runtime rollout; its UI selection uses the existing in-memory composer draft, and Native freezes its identity at first send. `ApplyPayload` therefore requires distinct localSessionId, agentSessionId and nativeThreadId for an existing owned thread. It also retains model intent/revision, permission mode, current market snapshot and trusted scope revision. The last market snapshot identifies the already applied composition; it does not renew a previous turn's tools. Role replacement/restoration must use the qualified same-ID lifecycle and complete ordinary baseline plus current expert role, never an empty prompt or a caller path.

## Per-turn wrappers and recovery

`NativeSubmitPayload` wraps the exact existing market-selection SubmitPayload plus safe expert selection and expected binding revision. Native resolves the private exact content identity and atomically freezes `TurnExpertSnapshot` with messages and the existing outbox. The wrapper's full original contents/target/model/market/expert identity participates in the existing idempotency mechanism.

`PrivateSubmission` wraps the exact existing market-host Submission plus that snapshot; its snapshot turnOperationId must equal the market snapshot's actual turn operation. Original PublicTask, local session and Host session identities stay distinct. `expert_grant_register` uses the current pipe scope and the existing bounded, expiring, one-use grant lifecycle, with explicit expert/ordinary-family dispatch fencing. `expert_submit` only consumes such expert-aware grants. It does not widen old grant_register or the old closed HTTP trigger.

`expert_submission_read` reads the original task/local session/turn operation receipt, returning `PrivateReceipt` with the original expert snapshot. It never re-prepares assets, renews a grant or starts a turn; missing/unknown receipt is not proof the operation never ran. Binding observation uses `expert_operation_read`; explicit recovery uses `expert_binding_recover`. These receipt types are not interchanged. A Host adaptation receipt is not a native role checksum echo—the Runtime provides no such field—and is not model-quality evidence.

Native commits resource intent and the complete original generated private request before Host mutation, using its existing SQLCipher worker transaction and shared market admission gate. Stable replay identity covers owner/tenant, action and typed resource payload; transient request/context IDs, scope expiry and current Host instance do not create a new intent. An original operation is query-only on replay. Pending/unknown against one shared expert installation excludes a new operation across versions and local scopes. A catalog entry may expose its original safe `ResourceOperation` for UI recovery; empty status or a missing Host receipt cannot prove success, failure or permission to resend. Native retains history references and blocks replacement/removal; Host additionally checks its live references. This journal is neither an installer nor another dispatch queue.

The source declares apply/binding-recover=20s, submit/prepare/remove/resource-recover=25s (bounded ordinary work and settlement), the other private methods=5s and Native response wait=30s. Only these methods use these budgets; existing 5s market methods are unchanged. Deadline expiry retains unknown outcome and original operation identity; it does not authorize automatic resend, replacement, forced shutdown or respawn. Status readiness requires actual Host adapter support and the same pinned catalog as Native; a feature flag or ready archive alone is insufficient.

## Explicit recovery of the original operation

There are now ten safe Native commands and eleven private methods. `chat_expert_binding_recover_v1` accepts only the original local session/operation identity; `experts_operation_recover_v1` accepts only the original resource operation identity. They require current write permissions. Native loads the complete original request from its existing durable journal, and sends current Host/scope authority separately from that original request. The caller cannot supply roles, digests, paths, new thread identity or a replacement operation.

Ordinary reads, refresh, reopening, repeated set and repeated prepare remain query-only. Only an explicit recovery action may proceed. A terminal original receipt is replayed. Binding recovery preserves original scope/intent HMAC, resource identity, model revision, permission mode and thread; with current idle/approval/outbox/reservation checks it normally re-applies the entire original composition, using the existing unsubscribe/resume machinery. It never starts a turn or renews old market capabilities. The resulting receipt retains the original Host nonce and expected+1 revision, even when the outer request is authorized by a new Host instance.

Resource recovery never prepares or removes resources. It observes the original core Skills operation; under the same existing mutation/operation locks, a provably unstarted operation may be durably closed as rejected. The core uses its existing terminal operation-conflict receipt so a late request with that ID cannot execute. This is not installation success, and does not infer the old outcome from current installed files. Native only settles a matching positive original receipt. A timeout, guard failure or missing evidence preserves the original unsettled state; it cannot unlock all conversations, reset a database, rewrite the original request or grant automatic retry.

## Asset identity and local content permission

`ExpertRef` binds expert ID/version and archive, role and knowledge-manifest SHA-256. Role and reference resources must be ordinary receipt-covered files in the same managed archive; the existing single `SKILL.md` entrypoint rule remains. Expert resources are excluded from ordinary global Skill roots and enablement projection. A global enabled switch cannot simulate a per-session expert binding.

First-version expert packages are **local-development only**: `expert.local_use_authorization.status=local-use-authorized` and an explicit local approval evidence reference are required; license authorization_scope is local-development and redistribution_status remains unverified. Exact reviewed source pin, file integrity and content review are still required. These fields distinguish Owner-authorized local use from unapproved redistribution; they are not a generic unverified-package bypass. A bundle containing this expert branch is rejected for desktop-release. Ordinary v2/v3 Skill license constraints are unchanged.

`reviewed-reference` content means editorial/source-completeness review, not verified current platform policy. Metadata never authorizes new tools or filesystem permissions. Retain referenced immutable content; the current Native candidate blocks removal of a version referenced by retained bindings/submissions, and blocks replacement with another version when any such retained history or unresolved request still references the old one. A completed submission is still a retained reference. No second version repository is introduced.

## Deterministic digests

Snapshot SHA-256 uses the source-declared ASCII lines with trailing LF: domain, actual turnOperationId, decimal bindingRevision, `none` or `expert`; the expert case adds expertId, version, archiveSha256, roleSha256 and knowledgeManifestSha256 in that exact order. The digest is content identity, not an execution grant. Shared ordinary/expert vectors are in `fixtures/experts/digest-vectors.json`.

Knowledge-manifest SHA-256 sorts resources by ASCII ID, then encodes the domain and decimal resource count with LF. Each resource contributes the fixed fields `id,title,path,sha256,bytes,content_version,content_status`, each prefixed by decimal **UTF-8 byte length** and `:`, followed by exact bytes; each resource ends with LF. The numeric bytes field is canonical decimal text. IDs are unique. The length prefixes permit Chinese titles without relying on object-map order or default JSON serialization. Normal UTF-8 vectors prove JavaScript, Go and Rust agree.

Generated helpers: JS `expertSnapshotDigest` / `knowledgeManifestDigest`; Go `CanonicalSnapshotBytes` / `SnapshotDigest` / `FreezeSnapshot` / `KnowledgeManifestDigest`; Rust `canonical_snapshot_bytes` / `snapshot_digest` / `freeze_snapshot` / `knowledge_manifest_digest`. Consumers use the generated helpers, not local encoders.

## Generation and validation

```sh
make experts-generate
make experts-check
make experts-test
node scripts/sync-experts.mjs --consumer=desktop
node scripts/sync-experts.mjs --consumer=agent-host
node scripts/sync-experts.mjs --consumer=skills
```

Each sync chooses exactly one explicitly authorized sibling and supports `--check`; it is not permission to edit all consumers. Go receives only private/asset definitions, Rust receives the complete Native/private adapter surface, and browser TS/Ajv receives only the declared safe UI reference closure. Bundle schemas are embedded into Go as source-derived string constants and separately copied for native schema compilers. Generated source locks record working-tree candidate hashes and a real pre-change base, not a fabricated release SHA.

Stage 1 focused evidence on 2026-10-11: nine Node tests, five Go tests, three Rust tests, Rust clippy `-D warnings`, Go vet, TypeScript compilation and strict schema validation passed. JSON Schema comparison passed against current fallback `35e0949c95d7a59ca5480715c225766dcc822056`, supported `f16a497e1377f45747f8ff9292b4b60cf2027f88`, and retained Native sources `6f632f155eacdaf93df0e0b00b5dab9e369c5442` / `811f38d6b104fa18477107e7ac91a85e19c445d1`. New paths do not replace old authorities; focused tests also compare protected old files byte-for-byte. This establishes source isolation, not consumer activation or D4.

Stage 2 evidence on the same date: the independent `make experts-test` path passed with five Go and three Rust tests; after the resource operation/managed projection assertions were added, `node --test tests/experts.test.mjs` passed **11 tests**. Canonical consumer sync checks and the current source hashes were checked. This does not rerun or supersede every historical baseline check. Cross-repository implementation reports additionally record 18 focused Host tests, normal Native transaction/dispatch tests and focused frontend tests; their exact scopes are recorded in each consumer's candidate notes rather than treated as Contracts conformance.

## Current local candidate pins

Read on 2026-10-11 after the explicit-recovery canonical sync. These are working-tree bytes, not release commits. Contracts base is `35e0949c95d7a59ca5480715c225766dcc822056`; Skills base is `488714a8d96f40806a257aae097683815b1dd458`, bundle `0.4.0`, `release=false`, `local-development`.

| Candidate | SHA-256 |
|---|---|
| Contracts `compatibility/experts/source.lock.json` | `a5056217e4d54310d451ba53c64504ef010e2c616108cf75b606b0de0e4d9033` |
| Desktop `contracts/experts.candidate.json` | `a919d62bc5e0de7cace97ca214003b40d57a341bc8e9983d634d9a999ed9e8c1` |
| Host `api/experts.candidate.json` | `47544938772a89f8047b58e407b98507fe8c313ecd4cf0f8d5f1608e44272306` |
| Skills `contracts/experts.candidate.json` | `cb8f6aa3445f15bf2274c4966cfa70239c2aaf445df3473f13638e1f3ac5ffdd` |
| Skills `dist/skills-experts-candidate/authority.json` | `0391d6be6b93c345272db3115f4e0aff9abb2f96c6b96a458d2f1002232c8ba7` |
| Skills bundle manifest | `156fa3da100f82985087637ea3e94138d1f6ff813fedc8a4275b0dcad591e355` |
| Skills source tree | `2fae182bcdbf41e2a6f7418fa1e64d94282a851c5cc0550feb213dac8ad4fef6` |

Contracts tests use only ordinary synthetic JSON and metadata. No executable/archive fixture is created, no forced exit or permission fault is injected, no malicious resource is generated, and no model/third-party service is called. Legacy broad generate/test is not run because it includes historical fixture and unrelated source regeneration; the new family's generator, check and conformance are independent canonical entrypoints. Host's separately recorded fixed Runtime/localhost synthetic Responses checks establish limited protocol and reference-read observations, not actual model quality. Full fresh-run Desktop UI/Native/Host product acceptance and real Provider/model evaluation remain **NOT RUN** here. Supported-mode installed-reference observations are recorded separately in the feature evidence; they are protocol/read qualification, not model quality. Pending/unknown remains blocked until matching positive original evidence or the explicit recovery flow resolves it; no override is provided. Immutable release provenance and production enablement remain pending.

Current recovery-family conformance: `make experts-test` passed 12 Node tests, five Go tests, three Rust tests, Go vet and Rust clippy. Only normal JSON/state data is used. All three consumer projections were regenerated from the same source; production approval and immutable release pins remain pending.

## 2026-10-13 Git delivery

The source and generated projections are now submitted together for the existing local-only feature. Consumer documents record this source commit and the unchanged source-lock digest after the commit exists, avoiding a self-referential source SHA. `base_commit` remains the truthful pre-change baseline; `release=false` remains unchanged. Git publication does not create a package release, supported contract tag, public service or production qualification. AC-007 content quality was removed from FEAT-158 by the Owner; historical outcomes remain unchanged, and appearance acceptance is skipped.
