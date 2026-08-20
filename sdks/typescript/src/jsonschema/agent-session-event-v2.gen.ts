/* Generated from JSON Schema. Do not edit by hand. */

/**
 * A sanitized Agent Host event negotiated through the v2 stream. It preserves v1 lifecycle semantics and adds bounded raw-reasoning text projection. Sequence is monotonic only within one stream_id and delivery is at least once.
 */
export type AgentSessionEventV2 = (ThreadStartedEventV2 | TurnStartedEventV2 | ItemStartedEventV2 | AgentMessageDeltaEventV2 | ReasoningTextDeltaEventV2 | ReasoningTextFinalizedEventV2 | ItemCompletedEventV2 | TurnCompletedEventV2 | AgentErrorEventV2 | AgentWarningEventV2)
export type ThreadStartedEventV2 = (EventBase & {
event_type?: "thread.started"
terminal?: false
payload?: ThreadStartedPayload
})
export type TurnId = string
export type ItemId = string
export type TurnStartedEventV2 = (EventBase & {
turn_id: TurnId
event_type?: "turn.started"
terminal?: false
payload?: TurnStartedPayload
})
export type ItemStartedEventV2 = (EventBase & {
turn_id: TurnId
item_id: ItemId
event_type?: "item.started"
terminal?: false
payload?: ItemLifecyclePayload
})
export type AgentMessageDeltaEventV2 = (EventBase & {
turn_id: TurnId
item_id: ItemId
event_type?: "item.agent_message.delta"
terminal?: false
payload?: AgentMessageDeltaPayload
})
export type ReasoningTextDeltaEventV2 = (EventBase & {
turn_id: TurnId
item_id: ItemId
event_type?: "item.reasoning_text.delta"
terminal?: false
payload?: ReasoningTextDeltaPayload
})
export type ReasoningTextFinalizedEventV2 = (EventBase & {
turn_id: TurnId
item_id: ItemId
event_type?: "item.reasoning_text.finalized"
terminal?: false
payload?: ReasoningTextFinalizedPayload
})
export type ReasoningTextFinalizedPayload = ({
[k: string]: unknown
} & {
status: ("complete" | "incomplete" | "unavailable")
/**
 * @maxItems 8
 */
contents: []|[ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]|[ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart, ReasoningContentPart]
reason_code?: ReasoningReasonCode
})
export type ReasoningReasonCode = ("reasoning_not_emitted" | "turn_interrupted" | "stream_gap" | "runtime_error" | "limit_exceeded" | "protocol_error" | "host_shutdown")
export type ItemCompletedEventV2 = (EventBase & {
turn_id: TurnId
item_id: ItemId
event_type?: "item.completed"
terminal?: false
payload?: ItemLifecyclePayload
})
export type TurnCompletedEventV2 = (EventBase & {
turn_id: TurnId
event_type?: "turn.completed"
terminal?: true
payload?: TurnCompletedPayload
})
export type AgentErrorEventV2 = (EventBase & {
turn_id: TurnId
event_type?: "error"
terminal?: false
payload?: AgentProblemPayload
})
export type AgentWarningEventV2 = (EventBase & {
event_type?: "warning"
terminal?: false
payload?: AgentWarningPayload
})

export interface EventBase {
schema_version: 2
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
turn_id?: TurnId
item_id?: ItemId
event_type: string
terminal: boolean
payload: {

}
}
export interface ThreadStartedPayload {
model: string
model_provider: string
}
export interface TurnStartedPayload {
status: "in_progress"
}
export interface ItemLifecyclePayload {
item_type: string
text?: string
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface ReasoningTextDeltaPayload {
content_index: number
delta: string
}
export interface ReasoningContentPart {
content_index: number
text: string
}
export interface TurnCompletedPayload {
status: ("completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
export interface AgentWarningPayload {
code?: string
message: string
will_retry: false
}
