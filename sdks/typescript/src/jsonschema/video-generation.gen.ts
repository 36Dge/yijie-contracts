// Generated from video-generation/v1. DO NOT EDIT.

/**
 * FEAT-173 additive builtin MCP video operations. Existing image, expert and Artifact contracts remain unchanged.
 */
export type BuiltinVideoGenerationV1 =
  | ImageMode
  | VideoStatus
  | VideoCode
  | NextAction
  | ProviderStatus
  | OperationPhase
  | GenerateInput
  | GetInput
  | GenerateRequest
  | GetRequest
  | OperationCandidate
  | VideoResult;
export type ImageMode = "none" | "first_frame" | "first_last_frames" | "reference_images";
export type VideoStatus = "pending" | "staged" | "committed" | "blocked" | "failed" | "unknown";
export type VideoCode =
  | "ok"
  | "provider_pending"
  | "existing_operation"
  | "selection_required"
  | "operation_not_found"
  | "expert_required"
  | "input_unsupported"
  | "operation_conflict"
  | "service_unavailable"
  | "outcome_unknown"
  | "provider_failed"
  | "provider_expired"
  | "delivery_rejected"
  | "delivery_unconfirmed"
  | "local_cancelled";
export type NextAction = "get_video_result" | "select_operation" | "check_artifact" | "report_status" | "use_expert";
export type ProviderStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
export type OperationPhase = "submitting" | "pending" | "succeeded" | "handed_off" | "failed" | "unknown";
export type GenerateInput = {
  [k: string]: unknown;
} & {
  prompt: string;
  image_mode: ImageMode;
  /**
   * @maxItems 10
   */
  image_indices:
    | []
    | [number]
    | [number, number]
    | [number, number, number]
    | [number, number, number, number]
    | [number, number, number, number, number]
    | [number, number, number, number, number, number]
    | [number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number]
    | [number, number, number, number, number, number, number, number, number, number];
};
export type VideoResult = {
  [k: string]: unknown;
} & {
  status: VideoStatus;
  code: VideoCode;
  next_action: NextAction;
  source: "builtin";
  video_operation_id?: string;
  provider_status?: ProviderStatus;
  provider_observed_at?: number;
  artifact_id?: string;
  delivery_turn_id?: string;
  /**
   * @minItems 1
   * @maxItems 5
   */
  candidates?:
    | [OperationCandidate]
    | [OperationCandidate, OperationCandidate]
    | [OperationCandidate, OperationCandidate, OperationCandidate]
    | [OperationCandidate, OperationCandidate, OperationCandidate, OperationCandidate]
    | [OperationCandidate, OperationCandidate, OperationCandidate, OperationCandidate, OperationCandidate];
  candidates_complete?: boolean;
};

export interface GetInput {
  video_operation_id?: string;
}
export interface GenerateRequest {
  thread_id: string;
  turn_id: string;
  input: GenerateInput;
}
export interface GetRequest {
  thread_id: string;
  turn_id: string;
  input: GetInput;
}
export interface OperationCandidate {
  video_operation_id: string;
  created_at: number;
  image_mode: ImageMode;
  phase: OperationPhase;
}
