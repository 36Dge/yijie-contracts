# Offline OpenAPI compatibility inputs

FEAT-162, 2026-10-29. This repairs the comparison tooling only (`contract-impact=none`): no published source schema, SDK, Desktop/Host wire, permission, default, or persistent format changes.

`check-breaking.sh <ref>` resolves the ref once to its full commit and calls `prepare-breaking-inputs.mjs`. Historical OpenAPI and JSON Schema bytes come only from that Git tree; current bytes come only from the working tree. Root `$id` values form a source-local URI index. The helper walks the referenced closure, resolves local pointers, and writes temporary inputs for the pinned oasdiff loader. No schema URI is downloaded and no current schema fills a missing historical dependency.

Only reference locations are rewritten. Logical local reference identities are stable between both sides; absolute temporary paths would cause false oneOf additions/removals. Ordinary example/default/const/enum values are left intact, while dictionary members named `default` (notably the default HTTP response) still have their schema references resolved. Restoring the recorded ref strings must reproduce the complete parsed source exactly. A receipt records each original/projected digest and ref mapping. These temporary files are comparator inputs, not new publishable JSON Schema authorities or SDK sources.

Missing sources/pointers, duplicate IDs and unsupported nested resources/dynamic refs fail closed. Local cycles stay refs rather than being recursively expanded. Modules use the existing Go cache (`GOPROXY=off`); checksum validation remains enabled. The existing OpenAPI inventory is unchanged, and protobuf/AsyncAPI/JSON Schema checks still run. `oasdiff breaking --fail-on ERR` now exits nonzero for detected breaking errors; the old invocation could print an error while returning zero.

Tests use ordinary in-memory schema snapshots and temporary text files. They prove two independent source closures, unchanged local ref identity, default response resolution, literal preservation, missing authority failure, and a real comparator detecting ordinary parameter tightening. They do not initialize Git repos, create commits, change permissions, substitute executables or inject attack fixtures.

Run:

```sh
node --test tests/offline-breaking-inputs.test.mjs
bash scripts/check-breaking.sh 61137174a25dc368e0006f27633fd4a9ad097aa6
```

FEAT-162 follow-up ran nine registered relevant baselines; all completed with exit 0, including all five previously blocked by schema EOF. Full command/digest evidence and the separate legacy umbrella-generator failure are in meta FEAT-162 report 26. This does not qualify immutable consumer pins, the actual App, paid calls or product D4.
