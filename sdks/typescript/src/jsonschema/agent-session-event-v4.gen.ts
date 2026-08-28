/* Generated from JSON Schema. Do not edit by hand. */

/**
 * Explicitly negotiated v4 Agent Host event. It preserves every v3 lifecycle, reasoning, and structured-artifact variant, adds authoritative AgentMessage phase on lifecycle events, and adds stable turn.plan.updated snapshots. Ordering is monotonic only within stream_id and delivery is at least once.
 */
export type AgentSessionEventV4 = ({
schema_version: 4
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
event_type: string
terminal: boolean
payload: {

}
} & (ThreadStartedEventV4 | TurnStartedEventV4 | TurnPlanUpdatedEventV4 | ItemStartedEventV4 | AgentMessageDeltaEventV4 | ReasoningTextDeltaEventV4 | ReasoningTextFinalizedEventV4 | ItemCompletedEventV4 | TurnCompletedEventV4 | AgentErrorEventV4 | AgentWarningEventV4 | ArtifactStartedEvent | ArtifactProgressEvent | ArtifactCompletedEvent | ArtifactFailedEvent))
export type ThreadStartedEventV4 = (NoTurnOrItem & {
event_type?: "thread.started"
terminal?: false
payload?: ThreadStartedPayloadV4
})
export type TurnStartedEventV4 = (TurnWithoutItem & {
event_type?: "turn.started"
terminal?: false
payload?: TurnStartedPayload
})
export type TurnPlanUpdatedEventV4 = (TurnWithoutItem & {
event_type?: "turn.plan.updated"
terminal?: false
payload?: TurnPlanUpdatedPayloadV4
})
export type ItemLifecyclePayloadV4 = (AgentMessageLifecyclePayloadV4 | NonAgentMessageLifecyclePayloadV4)
export type ReasoningTextFinalizedPayloadV4 = ({
[k: string]: unknown
} & {
status: ("complete" | "incomplete" | "unavailable")
/**
 * @maxItems 8
 */
contents: []|[ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]|[ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4, ReasoningContentPartV4]
reason_code?: ReasoningReasonCodeV4
})
export type ReasoningReasonCodeV4 = ("reasoning_not_emitted" | "turn_interrupted" | "stream_gap" | "runtime_error" | "limit_exceeded" | "protocol_error" | "host_shutdown")
export type TurnCompletedEventV4 = (TurnWithoutItem & {
event_type?: "turn.completed"
terminal?: true
payload?: TurnCompletedPayloadV4
})
export type AgentErrorEventV4 = (TurnWithoutItem & {
event_type?: "error"
terminal?: false
payload?: AgentProblemPayload
})
export type AgentWarningEventV4 = (NoTurnOrItem & {
event_type?: "warning"
terminal?: false
payload?: AgentWarningPayloadV4
})
export type ArtifactKind = ("image" | "video" | "file" | "report")
export type ArtifactProvenance = ("synthetic" | "provider" | "tool")
export type ArtifactProgressPayload = (ArtifactProgressPayload1 & {
artifact_id: string
kind: ArtifactKind
provenance: ArtifactProvenance
status: "in_progress"
ordinal: number
stage?: ("generating" | "processing" | "finalizing")
progress_percent?: number
})
export type ArtifactProgressPayload1 = ({
stage: unknown
} | {
progress_percent: unknown
})
export type ArtifactCompletedPayload = ({
[k: string]: unknown
} & {
artifact_id: string
kind: ArtifactKind
provenance: ArtifactProvenance
status: "ready"
ordinal: number
display_name?: string
media_type: ("image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "text/plain" | "text/csv" | "application/json" | "application/pdf" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.yijie.report+json;version=1")
size_bytes: number
sha256: string
content_href: string
poster_href?: string
})

export interface NoTurnOrItem {

}
export interface ThreadStartedPayloadV4 {
model: string
model_provider: string
}
export interface TurnWithoutItem {
turn_id: unknown
item_id?: unknown
}
export interface TurnStartedPayload {
status: "in_progress"
}
export interface TurnPlanUpdatedPayloadV4 {
explanation?: (string | null)
/**
 * @maxItems 128
 */
plan: TurnPlanStepV4[]
}
export interface TurnPlanStepV4 {
step: string
status: ("pending" | "in_progress" | "completed")
}
export interface ItemStartedEventV4 {
turn_id: unknown
item_id: unknown
event_type?: "item.started"
terminal?: false
payload?: ItemLifecyclePayloadV4
}
export interface AgentMessageLifecyclePayloadV4 {
item_type: "agentMessage"
text: string
phase: (("commentary" | "final_answer") | null)
}
export interface NonAgentMessageLifecyclePayloadV4 {
item_type: string
text?: string
}
export interface AgentMessageDeltaEventV4 {
turn_id: unknown
item_id: unknown
event_type?: "item.agent_message.delta"
terminal?: false
payload?: AgentMessageDeltaPayload
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface ReasoningTextDeltaEventV4 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.delta"
terminal?: false
payload?: ReasoningTextDeltaPayloadV4
}
export interface ReasoningTextDeltaPayloadV4 {
content_index: number
delta: string
}
export interface ReasoningTextFinalizedEventV4 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.finalized"
terminal?: false
payload?: ReasoningTextFinalizedPayloadV4
}
export interface ReasoningContentPartV4 {
content_index: number
text: string
}
export interface ItemCompletedEventV4 {
turn_id: unknown
item_id: unknown
event_type?: "item.completed"
terminal?: false
payload?: ItemLifecyclePayloadV4
}
export interface TurnCompletedPayloadV4 {
status: ("completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
export interface AgentWarningPayloadV4 {
code?: string
message: string
will_retry: false
}
export interface ArtifactStartedEvent {
turn_id: unknown
event_type?: "item.artifact.started"
terminal?: false
payload?: ArtifactStartedPayload
}
export interface ArtifactStartedPayload {
artifact_id: string
kind: ArtifactKind
provenance: ArtifactProvenance
status: "in_progress"
ordinal: number
display_name?: string
}
export interface ArtifactProgressEvent {
turn_id: unknown
event_type?: "item.artifact.progress"
terminal?: false
payload?: ArtifactProgressPayload
}
export interface ArtifactCompletedEvent {
turn_id: unknown
event_type?: "item.artifact.completed"
terminal?: false
payload?: ArtifactCompletedPayload
}
export interface ArtifactFailedEvent {
turn_id: unknown
event_type?: "item.artifact.failed"
terminal?: false
payload?: ArtifactFailedPayload
}
export interface ArtifactFailedPayload {
artifact_id: string
kind: ArtifactKind
provenance: ArtifactProvenance
status: "failed"
ordinal: number
error_code: ("generation_failed" | "unsupported_provider" | "resource_unavailable" | "limit_exceeded" | "integrity_failed" | "protocol_error" | "turn_interrupted" | "host_shutdown")
retryable: boolean
message?: string
}
