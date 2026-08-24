# Contracts v0.5.0 candidate

Status: FEAT-129 local candidate; not tagged, published, deployed, or promoted to a supported baseline.

## Additive scope

- `SkillBundleManifestV1` JSON Schema for bounded Desktop-bundled Skill archives;
- owner-only Agent Host v1 list, scan, install, enabled-state, and uninstall operations;
- initial `plugin.manage` capability governance key alongside existing `plugin.read`;
- pinned Runtime projection for `skills/list`, `skills/extraRoots/set`, `skills/config/write`, and `skills/changed`;
- deterministic valid, checksum-mismatch, and Zip Slip contract fixtures.

Existing Public, Agent Host session/turn/event/artifact, Protobuf, and AsyncAPI wire behavior remains unchanged. `plugin.manage` is an additive initial value on the existing open capability string, not a closed enum expansion required in every projection.

## Security and license boundary

The bundle manifest fails closed: an installable entry requires verified provenance and verified redistribution evidence. Skill management requests accept stable IDs and immutable digests only, never local paths or Skill content. Owner-only bearer and operation-level `plugin.read`/`plugin.manage` requirements are independent.

The observed upstream candidate `copywriting@0.0.94` is not covered by the synthetic contract fixture. Its local cache marks it official, but no LICENSE/NOTICE or reachable upstream repository currently proves redistribution rights; no upstream text is included in the candidate package.

`yijie-skills` instead owns a narrower, re-authored `yijie.content-marketing.copywriting@0.1.0` model-only artifact. The exact artifact is authorized and reviewable only for the `local-development` candidate and can be deterministically packaged for this Contract First loop. Its `desktop-release` redistribution remains blocked until product/legal records an approved YiJie license notice and desktop-distribution authorization.

In exact `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast`, Desktop supplies the fixed local identity and owner-only bearer without any user login, account authentication, or permission prompt. Host bearer and `plugin.read`/`plugin.manage` checks remain mandatory internally; this rule is not valid for public or production profiles.

## Generation and compatibility

Required candidate checks:

```bash
pnpm generate
pnpm lint
pnpm test
pnpm breaking HEAD
pnpm breaking f16a497e1377f45747f8ff9292b4b60cf2027f88
```

Structural green checks do not replace the Host/Desktop semantic and security review. Final immutable contracts commit, generated artifact digests, downstream consumer pins, and conformance results must be recorded outside this self-referential candidate document.

Reviewed source digests for the immutable candidate commit:

- Agent Host OpenAPI: `406b55dad02d5a3d489955bcf29c973b94252c3e300f8ff853709a71d6874431`;
- Public OpenAPI: `f70a88bab6f8fa6e813a828ed58f8559edeb3651812c601f31e2b8a516086518`;
- Skill Bundle Manifest v1: `d86185a1d5f4d9a136c88b679d50ac3e83bcc2b722eee39cba674c5be3b88469`;
- Runtime compatibility projection: `6b7662d4237486300456f16abd0305fe1ea267b70a85e497ba7ab15a654939ee`.

The full Git commit is intentionally recorded by downstream locks and the FEAT-129 delivery package after commit creation; a commit cannot truthfully embed its own final identity.

## Rollout

1. Merge/tag/publish is not part of this task; keep the candidate local.
2. `yijie-skills` produces a reviewed deterministic archive and manifest entry.
3. Agent Host implements the owner-only operations and pins the exact contracts commit/digest.
4. Desktop/Tauri implements the local capability and filesystem boundary and pins the same candidate.
5. A fresh local process proves install → enabled → next-turn model visibility and the negative fixtures.

## Rollback

Disable the Desktop Skill marketplace consumer and do not register the managed extra root. Existing Runtime session/turn/artifact projections and all published `0.2.0` behavior remain available. Bundled archives and managed App Data are not deleted automatically by contract rollback.
