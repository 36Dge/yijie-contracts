# Contracts v0.5.1 candidate

Status: FEAT-129 Catalog First local candidate; not tagged, published, deployed, or promoted to a supported baseline.

## Contract impact and authorities

`contract-impact = semantic`.

- Compatibility authority: unchanged `jsonschema/skills/skill-bundle-manifest-v1.schema.json` for `0.5.0` bundled manifests.
- Catalog First authority: `jsonschema/skills/skill-bundle-manifest-v2.schema.json`.
- Desktop ↔ Host wire authority: `openapi/agent-host/agent-host.yaml` Skills v1 operations and schemas.
- Runtime projection authority: `compatibility/agent-host-runtime-v1.json`; Runtime methods and notifications are unchanged.
- Owner: YiJie Contracts / Agent Runtime Team.
- Producer: `yijie-skills`.
- Known consumers: `yijie-agent-host`, `yijie-desktop`.

The v1 schema is byte-for-byte unchanged, and every valid `0.5.0` bundled manifest entry and Host response remains valid under `0.5.1`. The versioned v2 manifest and optional Host response field are output expansions: strict Host/Desktop consumers must be upgraded before a producer emits them. This candidate is not a supported public contract and does not alter any published `0.2.0` behavior.

## Catalog First expansion

- `catalog_entry_mode: catalog-only` is allowed only with `catalog_status: blocked`.
- A catalog-only entry must declare stable ID/runtime name, category/order, display metadata, version, registered icon key, risk, provenance, license review, capabilities, maintenance state, and one closed `blocked_reason`.
- A catalog-only entry must not contain `entrypoint` or `archive`; its license authorization scope is `none` and redistribution cannot be `verified`.
- A bundled/installable entry still requires `SKILL.md`, archive path/digest/sizes/count, verified provenance, verified redistribution, and for `desktop-release`, `desktop-distribution` authorization.
- Host list/scan responses may expose `catalog_blocked_reason` only for blocked entries. Install of any catalog-only or blocked entry returns HTTP `422` / `skill_not_installable` before archive access.

The stable blocked reasons are `source_unverified`, `license_unverified`, `distribution_not_authorized`, `security_review_pending`, `capability_unavailable`, and `maintenance_ended`.

## Synthetic fixtures

`tests/fixtures/skills/bundle-v2/manifest-catalog-38.json` is deterministic synthetic contract data. It contains exactly:

- sourcing-selection: 5;
- market-research: 9;
- content-marketing: 7;
- traffic-advertising: 9;
- store-operations: 8.

One synthetic CC0 copywriting archive is installable; the other 37 entries are catalog-only and blocked without archive bytes. The exact Host list fixture is generated from the raw manifest bytes and uses their SHA-256 as `catalog_revision`. The fixture does not copy observed Skill instructions and establishes no rights for any product Skill.

The existing normal, checksum-mismatch, and Zip Slip fixtures remain unchanged in purpose. `error-skill-not-installable.json` fixes the catalog-only install failure projection.

## License boundary

The re-authored product `yijie.content-marketing.copywriting@0.1.0` remains authorized only for `local-development`. Its `desktop-distribution` license/source proof is still a parallel release blocker. The synthetic CC0 archive in this repository is a test fixture and cannot be substituted for the product Skill.

## Required checks

```bash
pnpm generate
pnpm lint
pnpm test
pnpm build
./scripts/check-breaking.sh d6dff903e0c12b6a5e69599df1e33ef46d8bea6b
./scripts/check-breaking.sh f16a497e1377f45747f8ff9292b4b60cf2027f88
```

Structural checks do not replace semantic review of the new output values and strict consumer behavior.

Generated candidate digests:

- Agent Host OpenAPI: `f1aefb55285a12963a37e0cc008f90e7b081373d77623ce92127b06e1fbcdb31`;
- unchanged Skill Bundle Manifest v1: `d86185a1d5f4d9a136c88b679d50ac3e83bcc2b722eee39cba674c5be3b88469`;
- Skill Bundle Manifest v2: `39a898111ba3dcae2f369fdcb571a2e892830d1d0a57c90ab6210a0ab897a649`;
- Runtime compatibility projection: `5eadca026cdc8813cf529fa8e074de7532a2c78bebc5c89d9364180942869311`;
- raw 38-item catalog manifest: `407d0760e1d06ef3446955fba19b39da26d1f740b2f63b601edae903b1664c18`;
- Host 38-item list projection fixture: `c615889a263cf2d9c78b0704dc46c57200dd6a0b748ddcb4c72ae818c88923a2`;
- generated TypeScript Manifest v2: `187d95a3027dd88f2b0d8080b809aed3cca27396b62bfa0eea83c32bec7c1eb4`;
- generated TypeScript Agent Host: `811822aa53221251c5c6aa65cea949603f3adbe0052b4bac527fcfcf1860a387`;
- generated Go Agent Host: `06c1dd1b685ae3d719ff52faa7c999a63b0ff0f7989a2266eeb4534f1a0fa832`.

The immutable candidate Git commit cannot truthfully be embedded before commit creation. Downstream locks must pin the final full commit plus the applicable source/generated digests above.

## Rollout and rollback

Development follows Contracts → Skills → Agent Host → Desktop. Activation is consumer-first: Host/Desktop must accept catalog-only entries and Desktop must accept `catalog_blocked_reason` before Skills places the 38-item manifest in App Resource or Host emits the new field.

Rollback keeps the `0.5.0` one-entry bundled manifest and omits catalog-only entries and blocked reasons. Existing session, turn, artifact, Skill lifecycle, bearer, `plugin.read`, and `plugin.manage` behavior remains available.
