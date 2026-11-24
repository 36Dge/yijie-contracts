# Market P1 approval and result correlation

2026-11-14, user-authorized local implementation; no commit, release or production activation.
Combined contract-impact: semantic. The owned proxy approval profile changes behavior;
Gateway result metadata and optional Host correlation are additive. Fallback/source
comparison is `2592f5d5b07fcd92de10d25c4dcf73bd1ce03cb5`; existing supported baselines remain.

Connectors produces `CallToolResult._meta["yijie.market.call"]` from the canonical
`market-broker-control` GatewayCallReceipt. Codex carries and retains it in its existing
MCP Item. Host and Desktop consume the same generated definition; market-host v1/v2
only add optional `correlation`. The existing `service` ProviderBinding is unchanged.
No raw credentials, credentialRef, capabilityRef, original arguments or authority
context are included. Code Mode can expose metadata; it is not a secret channel.

For generic marketplace tools the owned Gateway may also emit the optional
string `_meta["yijie.market.method"]`. It is the public method from the
frozen tool definition. Consumers may use it for display only when the alias
in the native Item and its existing receipt both equal `m_` plus the first
60 hex digits of SHA-256 over `serviceId + "\n" + method`. The value never
comes from the provider result. Older calls and readers may omit or ignore it.

Host sets native `default_tools_approval_mode=approve` only on its owned, leased
`yijie_market` transport. Nonempty selection remains ask/on-request with user reviewer.
Gateway server elicitation still takes the native default auto-approval context,
so it waits for the ordinary user decision. Both owner decide_call and native Accept
remain necessary, followed by the exact one-shot HTTP permit. Preserve explicit
per-tool overrides and all unrelated MCP policy. No Runtime patch or approval store.

Capture the receipt after the decision, under the same Broker lock as admission.
`admissionConsumed` records permission consumption, not HTTP delivery or business
completion. A null decisionReceipt records absence of an observed owner decision.
Native Item status remains authoritative. Normal results of registered calls carry
the receipt; absent results do not create fabricated Items or links. Unknown or invalid
metadata leaves the native result visible but unlinked. Host checks the containing
Item and existing operation receipt; Native checks the original turn selection,
including service/ref/generation and digest, rather than the current installation.

Generation: existing market-broker and market-host v1/v2 generators. Synchronization
for the uncommitted v2 candidate uses the explicit `--local-market-candidate` option;
it synchronizes selection, market Host and the dependent experts projection, remains
release=false and records worktree_head plus source/output digests, never
a fictitious source_commit. Default immutable synchronization remains unchanged.
The selection wire/SDK stays unchanged; its source lock includes this shared sync
script, so it must participate in the same checked local source closure.
Prepare compatible readers first, then the writer and owned proxy policy. Old readers
ignore the optional field; old writers remain readable without correlation.
Link consistency is checked by Host/Native adapters; the legacy ToolObservation
shape does not acquire additional conditional required fields. Missing linkage
never removes the native result.

Focused structural comparison keeps the existing comparator and accepts explicit
`--schema=<source path>` arguments, rejecting unknown paths. The default still
checks all schemas. Scope for this change is the Broker and both Host wire sources.

Rollback: normally stop/revoke and select preserved Host/worker artifacts; retain new
readers and original history. Restoring auto restores the known generic-tool block.
Do not downgrade databases, delete receipts/credentials, replay unknown business
operations, or overwrite running artifacts. No-result audit retention and a native
pre-result Item association remain outside these two P1 changes.

2026-11-15 review follow-up: contract-impact=semantic for the private build/check
interface only; HTTP/IPC, permissions and storage formats are unchanged. The fixed
`local + demo_fast` development client may consume a complete, explicit `market-p1`
candidate across all three v2 families and both consumers. Desktop's normal source
preflight and Kimi build checks must use one read-only adapter to the canonical sync
checker. Every candidate must remain release=false, have worktree_head and no
source_commit; canonical generators and all source/output hashes must pass. Mixed
local/immutable families or consumers are rejected. Other build profiles retain
the existing immutable pin and checks; there is no fallback after a failed check.
The check adapter neither regenerates files nor freezes builds, starts services,
reads credentials, or replaces artifacts. Existing startup component planning and
the later Host/Runtime/resource checks still apply. Roll back this adapter together
with matching source locks/consumer records, never by inventing a source commit.
