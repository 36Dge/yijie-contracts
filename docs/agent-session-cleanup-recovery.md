# Agent session cleanup recovery (local candidate, 2026-10-23)

Contract impact: semantic. Owner: Agent Runtime Team / Client Team; producer:
Agent Host; consumer: Desktop. The user authorized repair of deletion, active-turn
handling, and normal-restart verification on 2026-10-23. This document specifies
the local recovery behavior of the existing v2 cleanup operation before consumer
implementation. It is not a release or an immutable consumer pin.

The request, response, error enums, authentication, content-free receipt, and
Runtime `thread/delete` confirmation remain those of
`openapi/agent-host/agent-host.yaml`. No new wire DTO or database schema is added.

1. A delete request blocks new submissions for that session. The Host serializes
   cleanup with its existing submission/model/expert admission lock. Pending
   expert changes and changed session bindings remain barriers to deletion.
2. A stored active/starting marker is not sufficient evidence that a turn is
   currently running. For a bound thread, read the existing native thread status
   without resuming the thread or starting a model request. `idle` and `notLoaded`
   permit attempting cleanup, without inventing a terminal event or rewriting
   the historical turn result. An exact native thread-not-found result also
   permits the existing idempotent delete check. Unknown status and read failure
   remain incomplete; `systemError` is not proof of quiescence.
3. If the current native status is active, read the exact current native turn and
   request ordinary `turn/interrupt`. Then read current native status again.
   Interrupt acknowledgement alone never permits deletion. If the turn has not
   stopped, return the existing `active_turn` incomplete result for bounded retry.
   No process termination, alternate Runtime, or fabricated terminal is allowed.
4. Before storing the cleanup lease, atomically compare the session identity,
   native revision, and operation state with the record associated with the
   observation. A concurrent change invalidates the observation. This evidence
   is private to cleanup and cannot authorize another turn or clear history.
5. The Host must still obtain the canonical `thread/delete` result/notification
   (or the existing exact not-found condition), then remove mappings and replay.
   Desktop may remove its local rows only after those surfaces are confirmed.
   SQLCipher foreign keys, secure deletion, WAL truncation, and successful receipt
   persistence remain required. A missing Host mapping is not complete Runtime
   cleanup and must retain the existing explicitly incomplete outcome.
6. Desktop's stale local running/uncertain markers must not prevent a bound,
   dispatch-quiescent deletion from reaching the Host. Pending creates/starts and
   scheduled reservations still block it. Cleanup must not be starved by recovery
   of the very session being deleted. Explicit retry reuses the existing operation
   and retains already confirmed surfaces, including across normal restart.

Compatibility: old Desktop clients accept the same complete/incomplete union;
new Desktop clients remain safe against an older Host, which can still return
incomplete. Deploy the Host recovery before relying on the improved Desktop
progress. Rollback retains the same schemas and receipts; old code can leave
stale deletions incomplete, but must not restore deleted sessions. Public release
still requires immutable pins and the existing release checks.

Verification uses ordinary synthetic conversations, regular completion and
interruption, database close/reopen, and canonical Runtime normal shutdown. No
permission damage, process kills, replacement executables, or attack fixtures.
