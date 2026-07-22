/* Generated from JSON Schema. Do not edit by hand. */

export interface AgentHostRuntimeCompatibility {
schema_version: 1
contracts_version: string
runtime: {
repository: string
repository_commit: string
upstream_tag: "rust-v0.144.6"
upstream_commit: string
version: "0.144.6"
transport: "stdio"
experimental_api: false
schema_file_count: 267
schema_tree_sha256: string
}
host_projection: {
transport: "local-http-sse"
authentication: "owner-only-bearer"
sandbox: "read-only"
approval_policy: "never"
runtime_methods: string[]
runtime_notifications: string[]
}
}
