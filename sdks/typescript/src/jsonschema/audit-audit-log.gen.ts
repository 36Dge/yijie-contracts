/* Generated from JSON Schema. Do not edit by hand. */

export interface AuditLog {
id: string
tenant_id: string
actor_type: string
actor_id?: (string | null)
action: string
resource_type: string
resource_id: string
request_id: string
trace_id?: (string | null)
outcome: ("success" | "failure")
metadata?: {
[k: string]: unknown
}
occurred_at: string
}
