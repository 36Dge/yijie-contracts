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

## Public message publication 2

Authenticated Desktop session creation and resume opt in with the X-Yijie-Publication header set to 2. The native-thread and SSE routes use the same header for reads, including reconnect. A paired Host echoes the negotiated value. The Runtime emits the authoritative item ID, order, previous item ID when available, and decision source on the first public assistant item. Deltas address that same ID. For mixed-purpose samples a valid commentary declaration is checked over the complete item. A later tool within the sample establishes commentary. An otherwise unclassified final requires the exact item selected at successful turn commit. Raw provider items and historical archives keep their original representation.

Consumers retain the decision through completion and cold reads. A bounded unpublishedText carries partial text and the reason it was retained. It has no answer phase. Clients using the preceding wire contract get the legacy projection. The authoritative schema tree and immutable Runtime source are recorded in compatibility/runtime-skill-marketplace/source.lock.json.
