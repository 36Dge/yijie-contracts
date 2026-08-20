/* Generated from JSON Schema. Do not edit by hand. */

/**
 * Explicitly negotiated v3 Agent Host event. It preserves v2 lifecycle and reasoning semantics and adds sanitized structured-artifact lifecycle events. Ordering is monotonic only within stream_id and delivery is at least once.
 */
export type AgentSessionEventV3 = ({
schema_version: 3
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
} & (ThreadStartedEventV3 | TurnStartedEventV3 | ItemStartedEventV3 | AgentMessageDeltaEventV3 | ReasoningTextDeltaEventV3 | ReasoningTextFinalizedEventV3 | ItemCompletedEventV3 | TurnCompletedEventV3 | AgentErrorEventV3 | AgentWarningEventV3 | ArtifactStartedEvent | ArtifactProgressEvent | ArtifactCompletedEvent | ArtifactFailedEvent))
export type ThreadStartedEventV3 = (NoTurnOrItem & {
event_type?: "thread.started"
terminal?: false
payload?: ThreadStartedPayload
})
export type TurnStartedEventV3 = (TurnWithoutItem & {
event_type?: "turn.started"
terminal?: false
payload?: TurnStartedPayload
})
export type ReasoningTextFinalizedPayloadV3 = ({
[k: string]: unknown
} & {
status: ("complete" | "incomplete" | "unavailable")
/**
 * @maxItems 8
 */
contents: []|[ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]|[ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3, ReasoningContentPartV3]
reason_code?: ReasoningReasonCodeV3
})
export type ReasoningReasonCodeV3 = ("reasoning_not_emitted" | "turn_interrupted" | "stream_gap" | "runtime_error" | "limit_exceeded" | "protocol_error" | "host_shutdown")
export type TurnCompletedEventV3 = (TurnWithoutItem & {
event_type?: "turn.completed"
terminal?: true
payload?: TurnCompletedPayloadV3
})
export type AgentErrorEventV3 = (TurnWithoutItem & {
event_type?: "error"
terminal?: false
payload?: AgentProblemPayload
})
export type AgentWarningEventV3 = (NoTurnOrItem & {
event_type?: "warning"
terminal?: false
payload?: AgentWarningPayload
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
export interface ThreadStartedPayload {
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
export interface ItemStartedEventV3 {
turn_id: unknown
item_id: unknown
event_type?: "item.started"
terminal?: false
payload?: ItemLifecyclePayload
}
export interface ItemLifecyclePayload {
item_type: string
text?: string
}
export interface AgentMessageDeltaEventV3 {
turn_id: unknown
item_id: unknown
event_type?: "item.agent_message.delta"
terminal?: false
payload?: AgentMessageDeltaPayload
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface ReasoningTextDeltaEventV3 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.delta"
terminal?: false
payload?: ReasoningTextDeltaPayloadV3
}
export interface ReasoningTextDeltaPayloadV3 {
content_index: number
delta: string
}
export interface ReasoningTextFinalizedEventV3 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.finalized"
terminal?: false
payload?: ReasoningTextFinalizedPayloadV3
}
export interface ReasoningContentPartV3 {
content_index: number
text: string
}
export interface ItemCompletedEventV3 {
turn_id: unknown
item_id: unknown
event_type?: "item.completed"
terminal?: false
payload?: ItemLifecyclePayload
}
export interface TurnCompletedPayloadV3 {
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
