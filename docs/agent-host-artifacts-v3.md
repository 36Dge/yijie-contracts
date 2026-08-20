# Agent Host Artifact Resources v3

The Agent Host v3 artifact surface is owner-only loopback API. It is authoritative in
`openapi/agent-host/agent-host.yaml` and consists of:

- `GET|HEAD /v3/agent-sessions/{agent_session_id}/artifacts/{artifact_id}/content`;
- `GET|HEAD /v3/agent-sessions/{agent_session_id}/artifacts/{artifact_id}/poster`;
- `POST /v3/agent-sessions/{agent_session_id}/artifacts/{artifact_id}/ack`.

There is no public Host history endpoint. Desktop history remains a private local projection.

## Resource reads

Content and optional poster reads require the same owner-only bearer as the event stream. They do
not redirect and return `Cache-Control: no-store`, a verified length and ETag, safe content
disposition, byte-range support, and `X-Content-Type-Options: nosniff`. A single byte range may
return `206`; malformed or multiple ranges fail closed. The API never returns a path, bearer,
provider payload, or unverified byte stream.

Stable resource failures distinguish malformed input, missing/foreign scope, expired staging,
invalid ranges, and sanitized internal unavailability. An expired tombstone is content-free: it
does not retain or return a path, digest, body, or token.

## Desktop commit acknowledgement

Desktop native sends ACK only after an atomic local commit has verified the completed manifest's
exact `size_bytes` and lowercase `sha256`. The request contains `ack_id`, `size_bytes`, `sha256`,
and `local_committed_at`. Repeating the same canonical request under the same `ack_id` returns the
original result; reusing that ID for different canonical input returns
`409 artifact_ack_conflict`. A not-ready artifact or manifest mismatch also returns a stable
conflict without deleting staging.

An accepted ACK returns the artifact and ACK identifiers, `status=acknowledged`, cleanup status,
and acknowledgement time. It authorizes early staging cleanup. Host restart and staging TTL remain
independent cleanup authorities if ACK is lost.

## Retention clocks

Host staging is a bounded owner-only encrypted spool with a 24-hour clock starting at `staged_at`;
it is purged on ACK, TTL, or Host restart. Durable Desktop artifact retention is a different clock:
`expires_at = local_committed_at + 168h`. The HTTP ACK does not claim that Desktop SQLCipher or
content retention has already expired.

## ReportDocumentV1

`application/vnd.yijie.report+json;version=1` content validates against
`jsonschema/report/report-document-v1.schema.json`. The root and every known section are closed.
Known `summary`, `metrics`, `paragraph`, `table`, `chart`, and `callout` payloads are strictly
decoded and contain data, not HTML, JavaScript, URLs, or ECharts options. An unknown section is skippable only when its
envelope says `required=false`; its payload remains opaque and must not be traversed or rendered.
An unknown required section rejects the report.

Before traversing the document, validators cap the complete Artifact at 64 MiB. An unknown
optional payload has the additional contract annotations `x-yijie-max-utf8-bytes=131072` and
`x-yijie-max-json-depth=8`; producer and native consumer conformance must enforce both before
retaining the opaque slice. These annotations do not authorize a renderer to inspect the payload.
