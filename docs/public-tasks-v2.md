# Public Tasks v2 contract candidate

Status: DEC-126-023 replacement source-contract candidate; DEC-126-024 final G2A approval is pending.
This document and generated SDKs do not authorize provider, consumer, route, database, or production
implementation.

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
- The request contains only the closed `task_type=conversation` discriminator and a closed
  `TaskContentReferenceV2`. The reference consists of schema version `1`, `content_mode=local_only`, and
  a fresh opaque UUID. Neither field is a container for task-specific input.
- Request and success response have no `title`, `result`, or `error_message` field. They reject all
  additional properties, including prompt, message, raw reasoning, title-derived content and project
  paths.
- Tasks are creator-private. A normal role never grants cross-creator access. A future expansion requires
  explicit `task.read_all` or `task.manage_all`; neither capability is introduced by this candidate.
- Rows without a trustworthy creator are quarantined by implementation policy and are not guessed or
  backfilled by the wire contract.
- Unauthorized and absent resource identifiers converge on `task_not_found` where enumeration resistance
  is required. Every response is `Cache-Control: no-store`.

## Idempotency and errors

Create requires a UUID `Idempotency-Key`, scoped by verified user, tenant, and operation. A retry after an
unknown network result reuses the same key and canonical request. Same key plus different input returns
`idempotency_conflict`; here input means only the closed content-free reference. Permanent delete is not
part of this candidate.

Stable errors are `invalid_request`, `invalid_tenant_context`, `unauthenticated`, `access_denied`,
`task_not_found`, `idempotency_conflict`, `authorization_unavailable`, and `internal_error`. The closed v2
error body contains only `code`; SQL, stack, credential, provider response, message text and authorization
internals remain server-side. Legacy v1 continues using its unchanged `ErrorResponse`.

## Data authority and migration from the prior candidate

- Desktop SQLCipher is the sole durable authority for local prompt, message, raw reasoning, generated
  title and project path. Public Tasks/PostgreSQL must neither store nor reconstruct those values.
- `client_reference_id` is generated independently as an opaque UUID. It must not be a hash, encoding,
  slug or other derivative of local content, filesystem paths, identity, tenant or authorization data.
- The immutable prior candidate
  `c000a0245acb5c3f7ead5d2a877fb60c281c588c` remains unchanged. Consumers must not combine its arbitrary
  `input` semantics with this replacement shape.
- Because the prior candidate was not a supported release, migration is replacement-by-exact-SHA after
  DEC-126-024 rather than a wire-compatible rollout. No provider or consumer may pin this branch name.
- `/v1/tasks*` source and wire remain byte/structure isolated from this v2-only correction.

## Compatibility and retirement

The accepted sequence is `/v2/tasks` provider expand, immutable SDK pin, known-consumer migration,
observation, then v1 retirement. Retirement requires all of:

- at least 30 calendar days of the approved observation window;
- at least two Desktop release candidates;
- Owner attestation over available release/traffic inventory;
- zero approved/authenticated v1 use.

Anonymous deny hits remain security signals and do not become supported-consumer evidence. Rollback keeps
or restores the versioned v2 lane disabled while v1 remains denied; it never re-enables anonymous v1.
