# Full source generation

`pnpm generate:safe` and `pnpm check-generated:safe` share `scripts/generate.mjs`.
The default `generate` now follows the same SDK-only path. None invokes historical
archive/attack fixture generation; that separate historical command is outside
this safe entrypoint. Full generation covers the core OpenAPI/Protobuf/AsyncAPI
families, the 23 source-lock families listed in `generation-plan.mjs`, and native
conversation v3/v4. A new source-lock family must be registered or generation fails.

`sdk-exports.json` owns the public TypeScript root exports. Generic JSON Schema
generation follows those existing exports; specialized schemas keep their own
canonical producers and names. In particular, model selection and scheduled
schemas are resolved by their source-local producers, never a generic HTTP fetch.
The generic compiler disables HTTP resolution. This does not add an SDK export
for every source schema (for example the historical v3 Skill bundle manifest).
Adding an exported API requires an explicit source/compatibility change.

All producers run first in a disposable source/output copy with the existing
dependency runtime. Runtime sources are linked read-only by convention and only
read by the registered projection generators. The real Git metadata is linked
solely for their existing read-only `rev-parse`/`cat-file` provenance queries;
there is no commit, checkout, index write or immutable-source qualification.
Original dirty source bytes are used. Existing source-lock bases stay unchanged.

Check mode compares generated outputs and never publishes them. A normal
generator error therefore leaves the checkout unchanged. Generate mode verifies
the original input/output snapshot has not changed, then publishes only completed
SDK/receipt outputs with a recovery journal. Ordinary publication errors restore
this run's own writes. Concurrent edits are rejected and never overwritten during
recovery. An interrupted publication can retain `.generation-recovery-*`; inspect
its manifest and original bytes before recovery rather than blindly deleting it.
This is not a claim of atomic multi-file publication across power loss. No forced
termination or permission-fault tests qualify that case.

The existing focused switches remain supported. `check-workflow-local.mjs` also
uses staged check mode. Canonical leaf generators remain available for explicit
source-first family work; their direct write mode is not made transactional by
this wrapper. `GOPROXY=off` keeps pinned Go codegen dependencies local; a missing
dependency fails instead of acquiring a substitute. Tools and generator versions
are unchanged.

The wrapper also copies `pnpm-workspace.yaml` and verifies every direct package
version and the complete installed dependency lock graph against the source
lockfile before staging. Only then is pnpm's staging-inapplicable automatic
workspace install disabled; offline mode and no update notification are selected.
An actual dependency mismatch fails and requires an explicit canonical install.
This avoids a `pnpm exec` check silently installing into the linked dependencies.

Verification: `node --test tests/generation-workspace.test.mjs`,
`pnpm generate:safe`, `pnpm check-generated:safe`, and `pnpm lint`.
