/* Generated from JSON Schema. Do not edit by hand. */

/**
 * Closed manifest for Skill archives bundled with the YiJie Desktop application.
 */
export type SkillBundleManifestV1 = ({
[k: string]: unknown
} & {
schema_version: 1
bundle_id: "yijie.desktop.skill-packages"
bundle_version: SemanticVersion
distribution_channel: ("local-development" | "desktop-release")
source: BundleSource
/**
 * @minItems 1
 * @maxItems 256
 */
skills: [SkillEntry, ...(SkillEntry)[]]
})
export type SemanticVersion = string
export type Sha256 = string
export type SkillEntry = ({
[k: string]: unknown
} & {
[k: string]: unknown
} & {
id: string
runtime_name: string
category: ("sourcing-selection" | "market-research" | "content-marketing" | "traffic-advertising" | "store-operations")
order: number
display_name: string
description: string
version: SemanticVersion
entrypoint: "SKILL.md"
icon: Icon
risk: Risk
provenance: Provenance
license: License
capabilities: Capabilities
archive: Archive
release: Release
} & {
id: string
runtime_name: string
category: ("sourcing-selection" | "market-research" | "content-marketing" | "traffic-advertising" | "store-operations")
order: number
display_name: string
description: string
version: SemanticVersion
entrypoint: "SKILL.md"
icon: Icon
risk: Risk
provenance: Provenance
license: License
capabilities: Capabilities
archive: Archive
release: Release
})
export type RelativeReference = string

export interface BundleSource {
repository: string
revision_kind: ("git-commit" | "working-tree")
revision: string
tree_sha256: Sha256
}
export interface Icon {
registry: "yj-icon-v1"
key: string
}
export interface Risk {
level: ("low" | "medium" | "high" | "critical")
/**
 * @minItems 1
 * @maxItems 8
 */
reasons: [string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]
}
export interface Provenance {
source_type: ("internal" | "partner" | "third-party")
source_reference: RelativeReference
source_version: SemanticVersion
source_sha256: Sha256
review_status: ("verified" | "blocked")
reviewed_by: string
reviewed_at: string
}
export interface License {
expression: string
redistribution_status: ("verified" | "unverified" | "blocked")
authorization_scope: ("local-development" | "desktop-distribution")
evidence_reference: RelativeReference
reviewed_by: string
reviewed_at: string
}
export interface Capabilities {
execution_mode: ("model-only" | "tool-assisted")
network: ("none" | "optional" | "required")
filesystem: ("none" | "read" | "write")
/**
 * @maxItems 32
 */
required_tools: string[]
}
export interface Archive {
path: string
sha256: Sha256
compressed_size_bytes: number
uncompressed_size_bytes: number
file_count: number
}
export interface Release {
catalog_status: ("installable" | "blocked")
maintenance_status: ("maintained" | "unmaintained")
}
