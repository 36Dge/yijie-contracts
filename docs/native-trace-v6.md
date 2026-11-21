# Native Trace v6 — FEAT-167

Contract impact: **breaking**. Owner and consumer owner: 段成威.
Producer: Agent Host; consumer: Desktop Native/Vue. Scope: local development.
User authorized full-chain implementation and, on 2026-11-03, explicitly retired
old data compatibility, migrations and Native V4/SSE11 interfaces.

Authority: `openapi/native-conversation-v6/native-conversation-v6.yaml`.
Active routes are Native history v6 and SSE13 only; Desktop emits IPC6 and writes
record format6 only. Old source contracts remain historical records, not active
interfaces. Fresh stores follow the explicitly authorized scoped data reset with
normal application shutdown. Credentials, installed resources and user project
files are preserved. No automatic fallback, dual writer, migration, or rollback
to an old binary is supported.

The contract projects pinned yijie-codex 0.144.6 canonical commandActions,
MCP appContext and ErrorNotification.willRetry. No Runtime patch, new executor,
planner, retry driver, budget, shell parsing, fabricated commentary, or diff is
introduced. Existing native commentary/final phases are preserved, including
unknown or missing phase. Only turn lifecycle establishes the terminal state.

Command actions retain original indices under the parent Item ID. A command
with several actions remains one call. At most64 actions are projected, labels
are bounded to512 Unicode characters and queries256; unsupported or truncated
content is partial, not execution failure. Tool display source/title are limited
to160 characters and canonical metadata; display text grants no authority.
Missing/null willRetry is unknown; false means explicitly no retry, true means
native retry intent, not permission for the frontend to restart anything.

Private IPC/history schema6 is owned by Desktop. Presentation groups and
expansion choices are derived and memory-only. Reopening saved format6 does not
replay a turn or migrate content. Old/future formats are rejected explicitly.
Order: validate/pin contract → v6-only reader → Host projection → Native commit
before IPC publication → Vue reading projection → normal fresh-start validation.

V4 source bytes remain unchanged relative to b51d26063f03f8fdb4109e03ede0738053740ed3;
retirement is deliberate and authorized, not claimed backward compatibility.
Fixtures use only normal synthetic records; prohibited fault/attack tests are
not run. Checks and real-provider verification are reported separately.

### Built-in deep web search, 0.7.2

Contract impact is semantic. Agent Host produces the same v6 Item for Desktop
Native and Vue. For the exact `yijie_web/kimi_web_search_pro` identity,
`argumentsSummary` may contain only the validated, redacted Pro query. The
normal single MCP text block must validate against the built-in Pro success or
public error schema. A success is projected at its original index zero using
the existing `SearchSuccess` schema. It contains the ordered, displayable
titles, source URLs and snippets. Newly observed results preserve the original
public HTTP(S) article URL, including its path, query and fragment, when it
passes the existing native search-source confidentiality checks. If only the
origin passes, that origin is retained. Its `truncated` flag covers both upstream
and display limits. Page chunks, raw arguments and MCP metadata stay outside
the display. Errors carry only a validated public error. Desktop displays the
hostname. A user can open the recorded URL through the native source opener,
which reauthorizes the session, turn, item and exact URL on activation.
Collection happens on native Item notifications. Rebuilding an older turn
from a thread snapshot does not backfill deep search details.

The transport, item identity, event order, timing and archive format stay the
same. New readers show saved metadata-only calls using their recorded status
and duration. Opening a disclosure reads the saved Item. Earlier v6 readers
accept the same bounded text fields. Records from 0.7.1 open their saved site
origin on the updated Desktop. The compatibility baseline is
`a961f6573da7588a8d4b0d2e1663ee8dda44bf57`. Desktop can be updated first.
Rolling back the Host restores site-only recording for subsequent searches.

### Built-in fetch display, 0.9.1

Agent Host projects newly observed `yijie_web/kimi_web_fetch` Items into the existing v6 fields. The request contributes only its validated hostname to `argumentsSummary`. A successful native text result must validate as `FetchSuccess`. It may contribute its sanitized title (up to 512 UTF-8 bytes) to `resultSummary` and a short full or truncated reading outcome to text block zero. A validated public error contributes only its fixed message. Raw URLs, page bodies, MCP metadata and supplier error bodies never enter this projection. Disclosure reads the saved Item without opening a website or executing a tool.

This semantic change preserves the wire shape and saved format. The existing metadata-only reader remains usable for saved turns, reconstructed history and older Host versions. Older clients can display the short outcome as plain text. Deploying or rolling back either reader requires no migration.

## Public message publication 2

Authenticated Desktop session creation and resume opt in with the X-Yijie-Publication header set to 2. The native-thread and SSE routes use the same header for reads, including reconnect. A paired Host echoes the negotiated value. The Runtime emits the authoritative item ID, order, previous item ID when available, and decision source on the first public assistant item. Deltas address that same ID. For mixed-purpose samples a valid commentary declaration is checked over the complete item. A later tool within the sample establishes commentary. An otherwise unclassified final requires the exact item selected at successful turn commit. Raw provider items and historical archives keep their original representation.

Consumers retain the decision through completion and cold reads. A bounded unpublishedText carries partial text and the reason it was retained. It has no answer phase. Clients using the preceding wire contract get the legacy projection. The authoritative schema tree and immutable Runtime source are recorded in compatibility/runtime-skill-marketplace/source.lock.json.

### Live public message previews, 0.10.0

Contract impact is additive. With publication 2, a paired client may also negotiate
`X-Yijie-Publication-Preview: 1` on turn admission and the native event subscription.
The opt-in stream has its own cursor. Ordinary and expert root turns from either
supported model use the same Runtime decision. A complete public declaration allows
cleaned assistant body bytes to stream while the authoritative phase remains pending.
`item/agentMessage/previewDelta` identifies the thread, turn, item and UTF-8 offset.
The existing display limits apply. Reasoning and tool output use their own channels.
Preview bytes are transient; a formal Item and its full completion snapshot have priority.
Replaying an offset is idempotent. A missing prefix must never be displayed as a complete
answer. Older subscribers receive their original uninterrupted event sequence.

Expert execution uses the existing owner-only Native control pipe. A Native
client supporting the same v1 preview stream requests it for that pipe by
setting `YIJIE_NATIVE_PIPE_PUBLIC_PREVIEW=1` on its own child after clearing
inherited environment. Only a local Host paired with the preview-capable
Runtime accepts the request. Older parents omit it. This display capability
travels in the context of the existing expert grant and submit operations.
Their request formats, authorization, retries and response receipts are unchanged.
