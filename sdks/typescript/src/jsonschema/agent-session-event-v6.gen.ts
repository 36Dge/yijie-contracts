/* Generated from JSON Schema. Do not edit by hand. */

/**
 * Explicitly negotiated v6 Agent Host event. It preserves every v5 event family and adds the closed FEAT-137 local Command approval requested/resolved lifecycle. Ordering is monotonic only within stream_id and delivery is at least once.
 */
export type AgentSessionEventV6 = ({
schema_version: 6
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
} & (ThreadStartedEventV6 | TurnStartedEventV6 | TurnPlanUpdatedEventV6 | ItemStartedEventV6 | AgentMessageDeltaEventV6 | CommandOutputDeltaEventV6 | ToolProgressEventV6 | ApprovalRequestedEventV6 | ApprovalResolvedEventV6 | ReasoningTextDeltaEventV6 | ReasoningTextFinalizedEventV6 | ItemCompletedEventV6 | TurnCompletedEventV6 | AgentErrorEventV6 | AgentWarningEventV6 | ArtifactStartedEvent | ArtifactProgressEvent | ArtifactCompletedEvent | ArtifactFailedEvent))
export type ThreadStartedEventV6 = (NoTurnOrItem & {
event_type?: "thread.started"
terminal?: false
payload?: ThreadStartedPayloadV6
})
export type TurnStartedEventV6 = (TurnWithoutItem & {
event_type?: "turn.started"
terminal?: false
payload?: TurnStartedPayload
})
export type TurnPlanUpdatedEventV6 = (TurnWithoutItem & {
event_type?: "turn.plan.updated"
terminal?: false
payload?: TurnPlanUpdatedPayloadV6
})
export type ItemStartedPayloadV6 = (AgentMessageLifecyclePayloadV6 | CommandStartedPayloadV6 | ToolStartedPayloadV6 | GenericItemLifecyclePayloadV6)
export type CommandSummaryV6 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV6
})
export type TruncationReasonV6 = ("utf8_byte_limit" | "upstream_truncated")
export type CommandCwdV6 = ({
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
export type ToolIdentityV6 = ({
resolution: "known"
server_name: string
tool_name: string
} | {
resolution: "unknown"
server_name: "unknown"
tool_name: "unknown"
})
export type ToolArgumentsSummaryV6 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV6
})
export type CommandOutputDeltaPayloadV6 = ({
[k: string]: unknown
} & {
delta: string
truncated: boolean
truncation_reason?: TruncationReasonV6
})
export type ToolProgressSummaryV6 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV6
})
/**
 * Host-minted opaque approval identity. It is never the Runtime request id or nullable Runtime approvalId.
 */
export type ApprovalRequestIdV6 = string
export type ApprovalResolvedPayloadV6 = ({
[k: string]: unknown
} & {
item_type: "commandExecution"
approval_request_id: ApprovalRequestIdV6
revision: 2
action_id: "git_repository_check"
workspace_scope: "current_workspace"
outcome: ("accepted_once" | "cancelled_current_turn" | "expired" | "resolved_elsewhere")
decision_id?: string
decision?: ApprovalDecisionV6
requested_at: string
expires_at: string
resolved_at: string
})
export type ApprovalDecisionV6 = ("accept_once" | "cancel_current_turn")
export type ReasoningTextFinalizedPayloadV6 = ({
[k: string]: unknown
} & {
status: ("complete" | "incomplete" | "unavailable")
/**
 * @maxItems 8
 */
contents: []|[ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]|[ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6, ReasoningContentPartV6]
reason_code?: ReasoningReasonCodeV6
})
export type ReasoningReasonCodeV6 = ("reasoning_not_emitted" | "turn_interrupted" | "stream_gap" | "runtime_error" | "limit_exceeded" | "protocol_error" | "host_shutdown")
export type ItemCompletedPayloadV6 = (AgentMessageLifecyclePayloadV6 | CommandCompletedPayloadV6 | ToolCompletedPayloadV6 | GenericItemLifecyclePayloadV6)
export type CommandCompletedPayloadV6 = ({
[k: string]: unknown
} & {
item_type: "commandExecution"
status: ("completed" | "failed" | "declined")
command_summary: CommandSummaryV6
cwd: CommandCwdV6
duration_ms?: number
exit_code?: number
output: CommandOutputSnapshotV6
error?: CommandErrorV6
})
export type CommandOutputSnapshotV6 = ({
retention: "complete"
text: string
truncated: false
} | {
retention: "head_tail"
head: string
tail: string
truncated: true
truncation_reason: TruncationReasonV6
} | {
retention: "unavailable"
reason: "not_available"
truncated: false
})
export type CommandErrorCodeV6 = ("command_failed" | "command_declined" | "projection_limit_exceeded" | "projection_redaction_failed" | "protocol_error")
export type ToolCompletedPayloadV6 = ({
[k: string]: unknown
} & {
item_type: "mcpToolCall"
status: ("completed" | "failed" | "declined")
identity: ToolIdentityV6
arguments_summary: ToolArgumentsSummaryV6
duration_ms?: number
result_summary?: ToolResultSummaryV6
error?: ToolErrorV6
})
export type ToolResultSummaryV6 = ({
[k: string]: unknown
} & {
text: string
truncated: boolean
truncation_reason?: TruncationReasonV6
})
export type ToolErrorCodeV6 = ("tool_failed" | "tool_declined" | "unknown_tool" | "projection_limit_exceeded" | "projection_redaction_failed" | "protocol_error")
export type TurnCompletedEventV6 = (TurnWithoutItem & {
event_type?: "turn.completed"
terminal?: true
payload?: TurnCompletedPayloadV6
})
export type AgentErrorEventV6 = (TurnWithoutItem & {
event_type?: "error"
terminal?: false
payload?: AgentProblemPayload
})
export type AgentWarningEventV6 = (NoTurnOrItem & {
event_type?: "warning"
terminal?: false
payload?: AgentWarningPayloadV6
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
export interface ThreadStartedPayloadV6 {
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
export interface TurnPlanUpdatedPayloadV6 {
explanation?: (string | null)
/**
 * @maxItems 128
 */
plan: TurnPlanStepV6[]
}
export interface TurnPlanStepV6 {
step: string
status: ("pending" | "in_progress" | "completed")
}
export interface ItemStartedEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.started"
terminal?: false
payload?: ItemStartedPayloadV6
}
export interface AgentMessageLifecyclePayloadV6 {
item_type: "agentMessage"
text: string
phase: (("commentary" | "final_answer") | null)
}
export interface CommandStartedPayloadV6 {
item_type: "commandExecution"
status: "running"
command_summary: CommandSummaryV6
cwd: CommandCwdV6
}
export interface ToolStartedPayloadV6 {
item_type: "mcpToolCall"
status: "in_progress"
identity: ToolIdentityV6
arguments_summary: ToolArgumentsSummaryV6
}
export interface GenericItemLifecyclePayloadV6 {
item_type: ("userMessage" | "hookPrompt" | "reasoning" | "collabAgentToolCall" | "subAgentActivity" | "webSearch" | "imageView" | "sleep" | "imageGeneration" | "enteredReviewMode" | "exitedReviewMode" | "contextCompaction")
}
export interface AgentMessageDeltaEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.agent_message.delta"
terminal?: false
payload?: AgentMessageDeltaPayload
}
export interface AgentMessageDeltaPayload {
delta: string
}
export interface CommandOutputDeltaEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.command_output.delta"
terminal?: false
payload?: CommandOutputDeltaPayloadV6
}
export interface ToolProgressEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.tool.progress"
terminal?: false
payload?: ToolProgressPayloadV6
}
export interface ToolProgressPayloadV6 {
item_type: "mcpToolCall"
status: "in_progress"
identity: ToolIdentityV6
progress_index: number
summary: ToolProgressSummaryV6
}
export interface ApprovalRequestedEventV6 {
request_id?: never
turn_id: unknown
item_id: unknown
event_type?: "approval.requested"
terminal?: false
payload?: ApprovalRequestedPayloadV6
}
export interface ApprovalRequestedPayloadV6 {
item_type: "commandExecution"
approval_request_id: ApprovalRequestIdV6
revision: 1
action_id: "git_repository_check"
workspace_scope: "current_workspace"
decisions: ApprovalDecisionSetV6
requested_at: string
expires_at: string
ttl_seconds: 120
}
export interface ApprovalDecisionSetV6 {
primary: "accept_once"
secondary: "cancel_current_turn"
}
export interface ApprovalResolvedEventV6 {
request_id?: never
turn_id: unknown
item_id: unknown
event_type?: "approval.resolved"
terminal?: false
payload?: ApprovalResolvedPayloadV6
}
export interface ReasoningTextDeltaEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.delta"
terminal?: false
payload?: ReasoningTextDeltaPayloadV6
}
export interface ReasoningTextDeltaPayloadV6 {
content_index: number
delta: string
}
export interface ReasoningTextFinalizedEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.reasoning_text.finalized"
terminal?: false
payload?: ReasoningTextFinalizedPayloadV6
}
export interface ReasoningContentPartV6 {
content_index: number
text: string
}
export interface ItemCompletedEventV6 {
turn_id: unknown
item_id: unknown
event_type?: "item.completed"
terminal?: false
payload?: ItemCompletedPayloadV6
}
export interface CommandErrorV6 {
code: CommandErrorCodeV6
summary: string
}
export interface ToolErrorV6 {
code: ToolErrorCodeV6
summary: string
}
export interface TurnCompletedPayloadV6 {
status: ("completed" | "interrupted" | "failed")
code?: string
message?: string
}
export interface AgentProblemPayload {
code?: string
message: string
will_retry: boolean
}
export interface AgentWarningPayloadV6 {
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
