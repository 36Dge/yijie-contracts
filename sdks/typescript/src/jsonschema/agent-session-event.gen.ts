/* Generated from JSON Schema. Do not edit by hand. */

/**
 * A sanitized Agent Host event. The event_type discriminator selects one payload, correlation-ID, and terminal-state variant. Sequence is monotonic only within one stream_id. A new Host process creates a new stream_id and does not replay content from an earlier process.
 */
export type AgentSessionEvent = (ThreadStartedEvent | TurnStartedEvent | ItemStartedEvent | AgentMessageDeltaEvent | ItemCompletedEvent | TurnCompletedEvent | AgentErrorEvent | AgentWarningEvent)
export type SchemaVersion = 1
export type EventId = string
export type StreamId = string
export type Sequence = number
export type OccurredAt = string
export type TraceId = string
export type RequestId = string
export type TenantId = string
export type UserId = string
export type TaskId = string
export type AgentSessionId = string
export type CodexThreadId = string
export type TurnId = string
export type ItemId = string

export interface ThreadStartedEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
event_type: "thread.started"
terminal: false
payload: ThreadStartedPayload
}
export interface ThreadStartedPayload {
model: string
model_provider: string
}
export interface TurnStartedEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
event_type: "turn.started"
terminal: false
payload: TurnStartedPayload
}
export interface TurnStartedPayload {
status: "in_progress"
}
export interface ItemStartedEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
item_id: ItemId
event_type: "item.started"
terminal: false
payload: ItemLifecyclePayload
}
export interface ItemLifecyclePayload {
item_type: string
text?: string
}
export interface AgentMessageDeltaEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
item_id: ItemId
event_type: "item.agent_message.delta"
terminal: false
payload: AgentMessageDeltaPayload
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface ItemCompletedEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
item_id: ItemId
event_type: "item.completed"
terminal: false
payload: ItemLifecyclePayload
}
export interface TurnCompletedEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
event_type: "turn.completed"
terminal: true
payload: TurnCompletedPayload
}
export interface TurnCompletedPayload {
status: ("completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface AgentErrorEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
turn_id: TurnId
event_type: "error"
terminal: false
payload: AgentProblemPayload
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
export interface AgentWarningEvent {
schema_version: SchemaVersion
event_id: EventId
stream_id: StreamId
sequence: Sequence
occurred_at: OccurredAt
trace_id?: TraceId
request_id?: RequestId
tenant_id?: TenantId
user_id?: UserId
task_id: TaskId
agent_session_id: AgentSessionId
codex_thread_id: CodexThreadId
event_type: "warning"
terminal: false
payload: AgentWarningPayload
}
export interface AgentWarningPayload {
code?: string
message: string
will_retry: false
}
