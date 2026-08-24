# Agent Host managed Skills v1

Status: FEAT-129 additive local candidate. This contract does not enable Host routes, ship Skill content, or authorize public/production use.

## Authorities

- `jsonschema/skills/skill-bundle-manifest-v1.schema.json` is authoritative for the read-only Desktop bundle catalog.
- `openapi/agent-host/agent-host.yaml` is authoritative for Desktop ↔ Agent Host list, scan, install, enabled-state, and uninstall wire behavior.
- `compatibility/agent-host-runtime-v1.json` is authoritative for the pinned Runtime methods and notification projected by Host.
- `yijie-skills` is authoritative for Skill instructions, versions, provenance review, license evidence, capability declarations, evals, and deterministic archives.

The current upstream Runtime remains `0.144.6` and exposes `skills/list`, `skills/extraRoots/set`, `skills/config/write`, and `skills/changed`. FEAT-129 does not change Runtime core.

## Bundle manifest invariants

The manifest is closed and bounded. Each entry binds a stable catalog ID to:

- Runtime name, business category, display metadata, semantic version, entrypoint, and YjIcon key;
- risk level and reasons;
- source type/reference/version/digest and a named provenance review;
- license expression, redistribution status, local-development/desktop-distribution authorization scope, evidence reference, and a named license review;
- model/tool, network, and filesystem capability requirements;
- relative archive path, SHA-256, compressed/expanded byte limits, and file count;
- catalog installability and maintenance state.

An `installable` entry must have both verified provenance and verified redistribution evidence. The schema rejects an installable entry whose redistribution status is `unverified` or `blocked`. A `desktop-release` bundle additionally requires `desktop-distribution` authorization for every entry; `local-development` authorization is never sufficient for a released client bundle. A `model-only` entry must declare no network, filesystem, or tool dependency.

Schema validation does not prove archive safety. Host must additionally verify the exact archive SHA-256 and declared counts, reject absolute/traversal/backslash/NUL entries, symlinks and other non-regular file types, duplicate/case-colliding paths, expansion limit violations, and a missing or non-regular `SKILL.md`.

Producer and consumer semantic validation must also reject duplicate catalog `id`, duplicate `runtime_name`, and duplicate archive path values, even if the duplicate objects differ enough to pass JSON Schema `uniqueItems`.

## Local API

| Operation | Capability | Result |
|---|---|---|
| `GET /v1/skills` | `plugin.read` | Bounded catalog/installation/Runtime visibility projection. |
| `POST /v1/skills/scan-operations` | `plugin.manage` | Reconciles the preconfigured managed root; accepts no path. |
| `POST /v1/skills/{skill_id}/install-operations` | `plugin.manage` | Validates one bundled entry and atomically installs it. |
| `PUT /v1/skills/{skill_id}/enabled` | `plugin.manage` | Persists and projects the enabled state. |
| `POST /v1/skills/{skill_id}/uninstall-operations` | `plugin.manage` | Removes only the managed installed copy. |

Every operation remains owner-only bearer protected and `Cache-Control: no-store`. The capability extension is an additional allow-only policy requirement; bearer possession alone does not grant `plugin.read` or `plugin.manage`.

For the exact `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` Desktop profile, the native launcher automatically establishes the fixed local identity, grants that profile `plugin.read` and `plugin.manage`, and supplies the owner-only bearer to Host calls. The user must not encounter a login page, account authentication, or an interactive permission prompt after starting the local project. This is a Desktop bootstrap rule, not an unauthenticated Host route: direct callers without the bearer still receive `401`, callers outside the fixed capability projection receive `403`, and the exception cannot be reused by public or production profiles.

Mutation requests use a Desktop-generated UUID `operation_id`. Install also binds expected semantic version, archive digest, and catalog revision. Requests never carry App Resource, App Data, archive, source, destination, or SKILL.md paths. Reusing an operation ID with different canonical input is `skill_operation_conflict`.

## Filesystem and lifecycle semantics

Host is configured at process launch with the canonical read-only bundle root and canonical managed installation root. Wire callers cannot change either root.

Installation extracts into a same-volume private staging directory, validates the complete tree, writes a bounded receipt, then atomically renames. Successful first installation defaults to enabled. Upgrade preserves the previous enabled state and does not replace the usable old version until the new tree is completely verified. Failure removes only the new staging tree.

Enabled-state changes map the exact managed `SKILL.md` to Runtime `skills/config/write`. Host registers only the managed installed root through `skills/extraRoots/set`; the bundled read-only source is never registered. Runtime `skills/changed` invalidates the projection and causes a bounded `skills/list` refresh. Model visibility changes apply to the next Runtime Skill snapshot.

Uninstall first removes Runtime visibility, then removes only the canonical managed directory and receipt/disabled marker. It never follows an untrusted symlink, deletes the bundled source, or accepts a caller-provided path. A known but already absent installation returns the converged not-installed result.

Startup, page-open, application-upgrade, window-resume, directory-change, and user-retry scans converge UI and Runtime state to the managed directory. Missing files become not installed; corrupt files remain not visible and expose a stable recoverable failure code.

## Fixture outcomes

`tests/fixtures/skills/bundle-v1` contains deterministic synthetic archives and schema-valid manifests:

- valid model-only archive: digest and paths pass;
- checksum mismatch archive: manifest-declared digest does not match the bytes;
- Zip Slip archive: digest matches, but the `../escape.txt` entry is unsafe.

The fixtures contain only synthetic CC0 test content. They are not the re-authored product Skill packaged by `yijie-skills` and do not establish redistribution rights for any observed upstream candidate.

## Release and rollback

Provider-first order is Contracts → yijie-skills deterministic package → Agent Host implementation/conformance → Desktop/Tauri consumer → local feature enablement. Public/production activation is outside FEAT-129.

Rollback keeps the new contracts additive but disables the consumer feature, omits the managed root from Runtime extra roots, and continues to use existing session/turn/artifact operations. No tag, publish, deployment, or supported-baseline promotion is authorized by this candidate.
