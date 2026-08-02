# Public Tasks v2 contract candidate

Status: G2A source-contract candidate. This document and generated SDKs do not authorize provider,
consumer, route, database, or production implementation.

## Authority and consumers

- HTTP authority: `openapi/public/public.yaml#/paths/~1v2~1tasks`.
- Owner: 段成威 / platform-team.
- Producer: future `yijie-api` secure provider.
- Registered consumer: future `yijie-desktop` transport.
- Compatibility category: `unknown-public`; repository-local source inventory found no active v1 consumer.

Legacy `/v1/tasks*` remains unchanged and must stay denied by both approved service profile and ingress
throughout expand, migration, observation, and retirement. Generated SDK symbols are artifacts, not
evidence of active traffic.

## Security semantics

- Every v2 operation requires external user bearer authentication and the untrusted
  `X-Yijie-Tenant-ID` selector.
- The provider independently resolves the internal user, validates active tenant membership, and checks
  the exact task action. Missing authorization data fails closed.
- `tenant_id` and `created_by_user_id` are server-derived. `CreateTaskV2Request` rejects either field.
- Tasks are creator-private. A normal role never grants cross-creator access. A future expansion requires
  explicit `task.read_all` or `task.manage_all`; neither capability is introduced by this candidate.
- Rows without a trustworthy creator are quarantined by implementation policy and are not guessed or
  backfilled by the wire contract.
- Unauthorized and absent resource identifiers converge on `task_not_found` where enumeration resistance
  is required. Every response is `Cache-Control: no-store`.

## Idempotency and errors

Create requires a UUID `Idempotency-Key`, scoped by verified user, tenant, and operation. A retry after an
unknown network result reuses the same key and canonical request. Same key plus different input returns
`idempotency_conflict`; permanent delete is not part of this candidate.

Stable errors are `invalid_request`, `invalid_tenant_context`, `unauthenticated`, `access_denied`,
`task_not_found`, `idempotency_conflict`, `authorization_unavailable`, and `internal_error`. Bodies never
contain SQL, stack, credential, provider response, message text, or authorization internals.

## Compatibility and retirement

The accepted sequence is `/v2/tasks` provider expand, immutable SDK pin, known-consumer migration,
observation, then v1 retirement. Retirement requires all of:

- at least 30 calendar days of the approved observation window;
- at least two Desktop release candidates;
- Owner attestation over available release/traffic inventory;
- zero approved/authenticated v1 use.

Anonymous deny hits remain security signals and do not become supported-consumer evidence. Rollback keeps
or restores the versioned v2 lane disabled while v1 remains denied; it never re-enables anonymous v1.
