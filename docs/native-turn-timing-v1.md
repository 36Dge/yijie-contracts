# Native turn timing v1 — FEAT-155 local candidate

`contract-impact=additive` for this independent owner-only GET. The complete
Desktop batch is breaking because its private IPC and candidate SQL format change.
Owner: 段成威. Producer: Agent Host. Consumer: Desktop native. No public exposure,
release tag or replacement of existing native history v1/v2, SSE v7/v8, permission
or recovery contracts.

The fixed Runtime canonical Turn fields `startedAt`/`completedAt` are Unix seconds;
`durationMs` is whole-turn elapsed milliseconds, including waits. Their absence or
null is unknown. Zero is valid. Host maps only these fields from stable
`thread/read(includeTurns=true)` for one exact stored session/thread and requested
turn. It does not resume, start, submit, approve, reconstruct rollout, infer status,
or persist a second clock. An accepted operation does not establish a start time.

The new OpenAPI is the wire authority. `x-state-rules` requires a bounded integer
value only for `known`; `unknown` and `invalid` omit it. Strict generated JSON
Schema and Rust decoders enforce the same dependent fields. Each field retains
independent availability. Do not subtract second timestamps to manufacture
millisecond duration or require duration to equal wall-clock subtraction.

The local candidate GET rejects body/query parameters. Existing owner-only bearer
and validated local scheduled candidate registration apply. No client-supplied
tenant/thread/directory is accepted. The read has a 3 second deadline, 8 MiB history
projection bound, 1024 turn bound and the unchanged 16 MiB Runtime transport bound.
Oversized history is unavailable, never a truncated successful “not found”. All
responses are no-store. Missing/timeout/mismatch never prove non-execution and
never authorize resend. Runtime internal history reconstruction cost is unchanged.

Generation/check: `node scripts/generate-native-turn-timing.mjs [--check]`;
consumer sync/check: `node scripts/sync-native-turn-timing.mjs [--check]`;
schema/conformance: `node --test tests/native-turn-timing.test.mjs`.
The source lock records the full base commit, source/generated hashes, generator
identity and fixed Runtime canonical file hashes. Dirty candidate provenance is
local only, not an immutable release pin. No old pin is overwritten.

Expand order: source/generation → Host additive provider → Desktop compatible
reader/private IPC → explicitly selected candidate writer. Old Desktop receives
unchanged old endpoints; new Desktop with old Host retains unknown timing and
existing execution behavior. Disable timing to roll back Host; a migrated Desktop
database needs its SQL26-compatible reader, never a version decrement.

Supported/fallback comparisons remain the four FEAT-155 baselines in
[supported-baselines](supported-baselines.md). This family does not yet exist at
those baselines; old supported families still undergo their comparisons. No tag,
publish, merge or external service is authorized by this document.
