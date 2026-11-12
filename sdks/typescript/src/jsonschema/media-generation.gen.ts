// Generated from media-generation/v1; DO NOT EDIT.

/**
 * FEAT-172 application-owned MCP image generation. Existing Runtime, provider and Artifact lifecycle; no public media service or generation job database.
 */
export type BuiltinMediaGenerationV1 =
  GenerateInput | GenerateRequest | GenerateStatus | GenerateCode | NextAction | GenerateResult;
export type GenerateStatus = "staged" | "committed" | "blocked" | "failed" | "unknown";
export type GenerateCode =
  | "ok"
  | "expert_required"
  | "state_pending"
  | "outcome_unknown"
  | "cancelled"
  | "service_unavailable"
  | "generation_failed"
  | "input_unsupported"
  | "operation_conflict"
  | "content_rejected";
export type NextAction = "check_artifact" | "use_expert" | "report_failure";
export type GenerateResult = {
  [k: string]: unknown;
} & {
  status: GenerateStatus;
  code: GenerateCode;
  next_action: NextAction;
  source: "builtin";
  artifact_id?: string;
};

export interface GenerateInput {
  prompt: string;
  use_current_reference: boolean;
}
export interface GenerateRequest {
  thread_id: string;
  turn_id: string;
  input: GenerateInput;
}
