# Agent Host managed Skills v1

Status: FEAT-129 semantic local candidate. The `0.5.1` expansion preserves every valid `0.5.0` bundled entry while adding an explicitly phased catalog-only representation. This contract does not enable Host routes, ship product Skill content, or authorize public/production use.

## Authorities

- `jsonschema/skills/skill-bundle-manifest-v1.schema.json` remains the immutable `0.5.0` bundled-only authority.
- `jsonschema/skills/skill-bundle-manifest-v2.schema.json` is authoritative for the `0.5.1` Catalog First manifest while accepting the same bundled entry semantics.
- `openapi/agent-host/agent-host.yaml` is authoritative for Desktop ↔ Agent Host list, scan, install, enabled-state, and uninstall wire behavior.
- `compatibility/agent-host-runtime-v1.json` is authoritative for the pinned Runtime methods and notification projected by Host.
- `yijie-skills` is authoritative for Skill instructions, versions, provenance review, license evidence, capability declarations, evals, and deterministic archives.

The current upstream Runtime remains `0.144.6` and exposes `skills/list`, `skills/extraRoots/set`, `skills/config/write`, and `skills/changed`. FEAT-129 does not change Runtime core.

## Bundle manifest invariants

The manifest is closed and bounded. Each entry binds a stable catalog ID to:

- Runtime name, business category, display metadata, semantic version, catalog entry mode, and YjIcon key;
- risk level and reasons;
- source type/reference/version/digest and a named provenance review;
- license expression, redistribution status, local-development/desktop-distribution authorization scope, evidence reference, and a named license review;
- model/tool, network, and filesystem capability requirements;
- for `bundled` entries only: the `SKILL.md` entrypoint, relative archive path, SHA-256, compressed/expanded byte limits, and file count;
- catalog installability, maintenance state, and for every `catalog-only` entry one closed primary blocked reason.

An `installable` entry must be bundled and have both verified provenance and verified redistribution evidence. The schema rejects an installable entry whose redistribution status is `unverified` or `blocked`, or whose entrypoint/archive metadata is absent. A `desktop-release` manifest additionally requires `desktop-distribution` authorization for every installable entry; `local-development` authorization is never sufficient for a released archive.

A `catalog-only` entry must be `blocked`, must declare one of `source_unverified`, `license_unverified`, `distribution_not_authorized`, `security_review_pending`, `capability_unavailable`, or `maintenance_ended`, and must use authorization scope `none`. It is invalid if it contains `entrypoint` or `archive`. Source/license review metadata, risk, capability dependencies, and the registered `icon.key` remain mandatory, so a card can explain why it is unavailable without redistributing observed source bytes. Legacy bundled blocked entries that were valid in `0.5.0` remain valid for compatibility, but new Catalog First producers must use the explicit `catalog_entry_mode`.

A `model-only` entry must declare no network, filesystem, or tool dependency.

Schema validation does not prove archive safety. Host must additionally verify the exact archive SHA-256 and declared counts, reject absolute/traversal/backslash/NUL entries, symlinks and other non-regular file types, duplicate/case-colliding paths, expansion limit violations, and a missing or non-regular `SKILL.md`.

Producer and consumer semantic validation must also reject duplicate catalog `id`, duplicate `runtime_name`, and duplicate archive path values, even if the duplicate objects differ enough to pass JSON Schema `uniqueItems`.

## Local API

| Operation | Capability | Result |
|---|---|---|
| `GET /v1/skills` | `plugin.read` | Bounded catalog/installation/Runtime visibility projection, including a stable `catalog_blocked_reason` on blocked entries. |
| `POST /v1/skills/scan-operations` | `plugin.manage` | Reconciles the preconfigured managed root; accepts no path. |
| `POST /v1/skills/{skill_id}/install-operations` | `plugin.manage` | Validates one bundled entry and atomically installs it. |
| `PUT /v1/skills/{skill_id}/enabled` | `plugin.manage` | Persists and projects the enabled state. |
| `POST /v1/skills/{skill_id}/uninstall-operations` | `plugin.manage` | Removes only the managed installed copy. |

Every operation remains owner-only bearer protected and `Cache-Control: no-store`. The capability extension is an additional allow-only policy requirement; bearer possession alone does not grant `plugin.read` or `plugin.manage`.

For the exact `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` Desktop profile, the native launcher automatically establishes the fixed local identity, grants that profile `plugin.read` and `plugin.manage`, and supplies the owner-only bearer to Host calls. The user must not encounter a login page, account authentication, or an interactive permission prompt after starting the local project. This is a Desktop bootstrap rule, not an unauthenticated Host route: direct callers without the bearer still receive `401`, callers outside the fixed capability projection receive `403`, and the exception cannot be reused by public or production profiles.

Mutation requests use a Desktop-generated UUID `operation_id`. Install also binds expected semantic version, archive digest, and catalog revision. Requests never carry App Resource, App Data, archive, source, destination, or SKILL.md paths. Reusing an operation ID with different canonical input is `skill_operation_conflict`.

Host rejects a catalog-only or otherwise blocked Skill with HTTP `422` and `skill_not_installable` before reading an archive path or comparing an archive digest. A blocked list/scan projection includes `catalog_blocked_reason`; installable projections omit it. This optional response-field expansion requires strict Desktop consumers to accept and map the field before Host begins emitting 38-item Catalog First responses.

`catalog_revision` is the lowercase SHA-256 of the exact raw `bundle-manifest.json` bytes after those bytes pass schema and semantic validation. List and scan return that value; install compares the supplied value in constant time before reading or writing an archive. Re-serialization, whitespace normalization, or hashing only selected fields is not compatible.

## Filesystem and lifecycle semantics

Host is configured at process launch with the canonical read-only bundle root and canonical managed installation root. Wire callers cannot change either root.

Installation extracts into a same-volume private staging directory, validates the complete tree, writes a bounded receipt, then atomically renames. Successful first installation defaults to enabled. Upgrade preserves the previous enabled state and does not replace the usable old version until the new tree is completely verified. Failure removes only the new staging tree.

Enabled-state changes map the exact managed `SKILL.md` to Runtime `skills/config/write`. Host registers only the managed installed root through `skills/extraRoots/set`; the bundled read-only source is never registered. Runtime `skills/changed` invalidates the projection and causes a bounded `skills/list` refresh. Model visibility changes apply to the next Runtime Skill snapshot.

Uninstall first removes Runtime visibility, then removes only the canonical managed directory and receipt/disabled marker. It never follows an untrusted symlink, deletes the bundled source, or accepts a caller-provided path. A known but already absent installation returns the converged not-installed result.

Startup, page-open, application-upgrade, window-resume, directory-change, and user-retry scans converge UI and Runtime state to the managed directory. Missing files become not installed; corrupt files remain not visible and expose a stable recoverable failure code.

## Fixture outcomes

`tests/fixtures/skills/bundle-v1` contains the deterministic synthetic v1 archives and schema-valid manifests:

- valid model-only archive: digest and paths pass;
- checksum mismatch archive: manifest-declared digest does not match the bytes;
- Zip Slip archive: digest matches, but the `../escape.txt` entry is unsafe.

`tests/fixtures/skills/bundle-v2` contains the 38-item Catalog First manifest: five categories contain exactly `5/9/7/9/8` entries; one synthetic CC0 copywriting entry is bundled/installable and 37 entries are metadata-only/blocked with no archive.

`tests/fixtures/agent/host-skills-v1/list-response.json` is generated from the exact raw 38-item manifest bytes. Its `catalog_revision` is their SHA-256, every ID/runtime/version/status is projected in manifest order, and every blocked entry has the same stable primary reason. `error-skill-not-installable.json` fixes the blocked-install outcome.

The fixtures contain only synthetic CC0 test content. They are not the re-authored product Skill packaged by `yijie-skills` and do not establish redistribution rights for any observed upstream candidate.

## Release and rollback

Development order is Contracts → yijie-skills deterministic catalog/package → Agent Host implementation/conformance → Desktop/Tauri consumer. Activation is consumer-first for the new strict response projection: Desktop must accept the optional blocked reason before Host emits it, and Host/Desktop must accept catalog-only entries before yijie-skills places the 38-item manifest in App Resource. Public/production activation is outside FEAT-129.

Rollback keeps the new contracts additive but disables the consumer feature, omits the managed root from Runtime extra roots, and continues to use existing session/turn/artifact operations. No tag, publish, deployment, or supported-baseline promotion is authorized by this candidate.
