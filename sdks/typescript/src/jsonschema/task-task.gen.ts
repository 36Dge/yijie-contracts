/* Generated from JSON Schema. Do not edit by hand. */

export interface AgentTask {
id: string
tenant_id?: string
task_type?: string
status: ("draft" | "running" | "waiting_approval" | "completed" | "failed")
title: string
input?: {
[k: string]: unknown
}
result?: ({
[k: string]: unknown
} | null)
error_message?: (string | null)
created_at?: string
updated_at?: string
}
