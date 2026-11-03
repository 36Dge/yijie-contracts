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
