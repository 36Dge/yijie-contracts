/* Generated from JSON Schema. Do not edit by hand. */

/**
 * A sanitized Agent Host event. Sequence is monotonic only within one stream_id. A new Host process creates a new stream_id and does not replay content from an earlier process.
 */
export type AgentSessionEvent = ({
[k: string]: unknown
} & {
schema_version: 1
event_id: string
stream_id: string
sequence: number
occurred_at: string
trace_id?: string
request_id?: string
tenant_id?: string
user_id?: string
task_id: string
agent_session_id: string
codex_thread_id: string
turn_id?: string
item_id?: string
event_type: ("thread.started" | "turn.started" | "item.started" | "item.agent_message.delta" | "item.completed" | "turn.completed" | "error" | "warning")
terminal: boolean
payload: (ThreadStartedPayload | TurnLifecyclePayload | ItemLifecyclePayload | AgentMessageDeltaPayload | AgentProblemPayload)
})

export interface ThreadStartedPayload {
model: string
model_provider: string
}
export interface TurnLifecyclePayload {
status: ("in_progress" | "completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface ItemLifecyclePayload {
item_type: string
text?: string
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
