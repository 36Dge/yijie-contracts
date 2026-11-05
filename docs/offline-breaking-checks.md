# Offline OpenAPI compatibility inputs

FEAT-162, 2026-10-29. This repairs the comparison tooling only (`contract-impact=none`): no published source schema, SDK, Desktop/Host wire, permission, default, or persistent format changes.

`check-breaking.sh <ref>` resolves the ref once to its full commit and calls `prepare-breaking-inputs.mjs`. Historical OpenAPI and JSON Schema bytes come only from that Git tree; current bytes come only from the working tree. Root `$id` values form a source-local URI index. The helper walks the referenced closure, resolves local pointers, and writes temporary inputs for the pinned oasdiff loader. No schema URI is downloaded and no current schema fills a missing historical dependency.

Only reference locations are rewritten. Logical local reference identities are stable between both sides; absolute temporary paths would cause false oneOf additions/removals. Ordinary example/default/const/enum values are left intact, while dictionary members named `default` (notably the default HTTP response) still have their schema references resolved. Restoring the recorded ref strings must reproduce the complete parsed source exactly. A receipt records each original/projected digest and ref mapping. These temporary files are comparator inputs, not new publishable JSON Schema authorities or SDK sources.

Missing sources/pointers, ambiguous ID references and unsupported nested resources/dynamic refs fail closed. Unreferenced historical snapshots may share an ID; they are never selected as a fallback. Relative source paths remain unambiguous. Local cycles stay refs rather than being recursively expanded. Modules use the existing Go cache (`GOPROXY=off`); checksum validation remains enabled. Protobuf/AsyncAPI/JSON Schema checks still run. `oasdiff breaking --fail-on ERR` exits nonzero for detected breaking errors; the old invocation could print an error while returning zero.

2026-11-04 closeout: the former fixed list of 11 OpenAPI entrypoints is replaced
by source discovery (18 at this revision). Every old OpenAPI authority is checked;
a removed old file fails, while newly added APIs have their reference closures
verified. `compatibility/**/*.schema.json` also participates in the existing JSON
Schema checker (42 total schemas at this revision), including private market and
expert wire authorities. Provenance manifests are not treated as schemas. The
historical `check-feat164-breaking.mjs FULL_COMMIT` delegates to the same shared
entrypoint, so it cannot retain a separate resolver or weaker exit semantics.

The withdrawn unpublished tool-mode candidate is intentionally incompatible:
comparison against `ccf89302398309fbc8d500ec95531e3e68b579f9` now rejects removed
`toolProfile` properties/definitions. Do not suppress these findings or restore
the withdrawn feature to make the checker green. Current-vs-current compatibility
and preserved published baselines are separate checks. This closes a coverage gap;
automatic structural checking still does not prove behavior, billing or App E2E.

Tests use ordinary in-memory schema snapshots and temporary text files. They prove two independent source closures, unchanged local ref identity, default response resolution, literal preservation, missing authority failure, and a real comparator detecting ordinary parameter tightening. They do not initialize Git repos, create commits, change permissions, substitute executables or inject attack fixtures.

Run:

```sh
node --test tests/offline-breaking-inputs.test.mjs
bash scripts/check-breaking.sh 61137174a25dc368e0006f27633fd4a9ad097aa6
```

FEAT-162 follow-up ran nine registered relevant baselines; all completed with exit 0, including all five previously blocked by schema EOF. Full command/digest evidence and the separate legacy umbrella-generator failure are in meta FEAT-162 report 26. This does not qualify immutable consumer pins, the actual App, paid calls or product D4.
