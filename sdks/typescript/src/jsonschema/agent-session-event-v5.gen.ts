/* Generated from JSON Schema. Do not edit by hand. */

/**
 * Explicitly negotiated v5 Agent Host event. It keeps the named v4 event families, closes generic Item kinds to a stable allowlist, and adds bounded Command and Tool projections. Ordering is monotonic only within stream_id and delivery is at least once.
 */
export type AgentSessionEventV5 = ({
schema_version: 5
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
} & (ThreadStartedEventV5 | TurnStartedEventV5 | TurnPlanUpdatedEventV5 | ItemStartedEventV5 | AgentMessageDeltaEventV5 | CommandOutputDeltaEventV5 | ToolProgressEventV5 | ReasoningTextDeltaEventV5 | ReasoningTextFinalizedEventV5 | ItemCompletedEventV5 | TurnCompletedEventV5 | AgentErrorEventV5 | AgentWarningEventV5 | ArtifactStartedEvent | ArtifactProgressEvent | ArtifactCompletedEvent | ArtifactFailedEvent))
export type ThreadStartedEventV5 = (NoTurnOrItem & {
event_type?: "thread.started"
terminal?: false
payload?: ThreadStartedPayloadV5
})
export type TurnStartedEventV5 = (TurnWithoutItem & {
event_type?: "turn.started"
terminal?: false
payload?: TurnStartedPayload
})
export type TurnPlanUpdatedEventV5 = (TurnWithoutItem & {
event_type?: "turn.plan.updated"
terminal?: false
payload?: TurnPlanUpdatedPayloadV5
})
export type ItemStartedPayloadV5 = (AgentMessageLifecyclePayloadV5 | CommandStartedPayloadV5 | ToolStartedPayloadV5 | GenericItemLifecyclePayloadV5)
export type CommandSummaryV5 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV5
})
export type TruncationReasonV5 = ("utf8_byte_limit" | "upstream_truncated")
export type CommandCwdV5 = ({
kind: "workspace_root"
} | {
kind: "workspace_relative"
/**
 * @minItems 1
 * @maxItems 128
 */
segments: [string, ...(string)[]]
} | {
kind: "redacted"
})
export type ToolIdentityV5 = ({
resolution: "known"
server_name: string
tool_name: string
} | {
resolution: "unknown"
server_name: "unknown"
tool_name: "unknown"
})
export type ToolArgumentsSummaryV5 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV5
})
export type CommandOutputDeltaPayloadV5 = ({
[k: string]: unknown
} & {
delta: string
truncated: boolean
truncation_reason?: TruncationReasonV5
})
export type ToolProgressSummaryV5 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV5
})
export type ReasoningTextFinalizedPayloadV5 = ({
[k: string]: unknown
} & {
status: ("complete" | "incomplete" | "unavailable")
/**
 * @maxItems 8
 */
contents: []|[ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]|[ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5, ReasoningContentPartV5]
reason_code?: ReasoningReasonCodeV5
})
export type ReasoningReasonCodeV5 = ("reasoning_not_emitted" | "turn_interrupted" | "stream_gap" | "runtime_error" | "limit_exceeded" | "protocol_error" | "host_shutdown")
export type ItemCompletedPayloadV5 = (AgentMessageLifecyclePayloadV5 | CommandCompletedPayloadV5 | ToolCompletedPayloadV5 | GenericItemLifecyclePayloadV5)
export type CommandCompletedPayloadV5 = ({
[k: string]: unknown
} & {
item_type: "commandExecution"
status: ("completed" | "failed" | "declined")
command_summary: CommandSummaryV5
cwd: CommandCwdV5
duration_ms?: number
exit_code?: number
output: CommandOutputSnapshotV5
error?: CommandErrorV5
})
export type CommandOutputSnapshotV5 = ({
retention: "complete"
text: string
truncated: false
} | {
retention: "head_tail"
head: string
tail: string
truncated: true
truncation_reason: TruncationReasonV5
} | {
retention: "unavailable"
reason: "not_available"
truncated: false
})
export type CommandErrorCodeV5 = ("command_failed" | "command_declined" | "projection_limit_exceeded" | "projection_redaction_failed" | "protocol_error")
export type ToolCompletedPayloadV5 = ({
[k: string]: unknown
} & {
item_type: "mcpToolCall"
status: ("completed" | "failed" | "declined")
identity: ToolIdentityV5
arguments_summary: ToolArgumentsSummaryV5
duration_ms?: number
result_summary?: ToolResultSummaryV5
error?: ToolErrorV5
})
export type ToolResultSummaryV5 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV5
})
export type ToolErrorCodeV5 = ("tool_failed" | "tool_declined" | "unknown_tool" | "projection_limit_exceeded" | "projection_redaction_failed" | "protocol_error")
export type TurnCompletedEventV5 = (TurnWithoutItem & {
event_type?: "turn.completed"
terminal?: true
payload?: TurnCompletedPayloadV5
})
export type AgentErrorEventV5 = (TurnWithoutItem & {
event_type?: "error"
terminal?: false
payload?: AgentProblemPayload
})
export type AgentWarningEventV5 = (NoTurnOrItem & {
event_type?: "warning"
terminal?: false
payload?: AgentWarningPayloadV5
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
export interface ThreadStartedPayloadV5 {
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
export interface TurnPlanUpdatedPayloadV5 {
explanation?: (string | null)
/**
 * @maxItems 128
 */
plan: TurnPlanStepV5[]
}
export interface TurnPlanStepV5 {
step: string
status: ("pending" | "in_progress" | "completed")
}
export interface ItemStartedEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.started"
terminal?: false
payload?: ItemStartedPayloadV5
}
export interface AgentMessageLifecyclePayloadV5 {
item_type: "agentMessage"
text: string
phase: (("commentary" | "final_answer") | null)
}
export interface CommandStartedPayloadV5 {
item_type: "commandExecution"
status: "running"
command_summary: CommandSummaryV5
cwd: CommandCwdV5
}
export interface ToolStartedPayloadV5 {
item_type: "mcpToolCall"
status: "in_progress"
identity: ToolIdentityV5
arguments_summary: ToolArgumentsSummaryV5
}
export interface GenericItemLifecyclePayloadV5 {
item_type: ("userMessage" | "hookPrompt" | "reasoning" | "collabAgentToolCall" | "subAgentActivity" | "webSearch" | "imageView" | "sleep" | "imageGeneration" | "enteredReviewMode" | "exitedReviewMode" | "contextCompaction")
}
export interface AgentMessageDeltaEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.agent_message.delta"
terminal?: false
payload?: AgentMessageDeltaPayload
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface CommandOutputDeltaEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.command_output.delta"
terminal?: false
payload?: CommandOutputDeltaPayloadV5
}
export interface ToolProgressEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.tool.progress"
terminal?: false
payload?: ToolProgressPayloadV5
}
export interface ToolProgressPayloadV5 {
item_type: "mcpToolCall"
status: "in_progress"
identity: ToolIdentityV5
progress_index: number
summary: ToolProgressSummaryV5
}
export interface ReasoningTextDeltaEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.delta"
terminal?: false
payload?: ReasoningTextDeltaPayloadV5
}
export interface ReasoningTextDeltaPayloadV5 {
content_index: number
delta: string
}
export interface ReasoningTextFinalizedEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.finalized"
terminal?: false
payload?: ReasoningTextFinalizedPayloadV5
}
export interface ReasoningContentPartV5 {
content_index: number
text: string
}
export interface ItemCompletedEventV5 {
turn_id: unknown
item_id: unknown
event_type?: "item.completed"
terminal?: false
payload?: ItemCompletedPayloadV5
}
export interface CommandErrorV5 {
code: CommandErrorCodeV5
summary: string
}
export interface ToolErrorV5 {
code: ToolErrorCodeV5
summary: string
}
export interface TurnCompletedPayloadV5 {
status: ("completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
export interface AgentWarningPayloadV5 {
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
