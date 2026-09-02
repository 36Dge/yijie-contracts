/* Generated from JSON Schema. Do not edit by hand. */

export interface AgentHostRuntimeApprovalCompatibilityV6V4 {
schema_version: 4
projection_id: "agent-host-runtime-approval-v6-v4"
contracts_version: "0.7.0"
status: "deterministic_d4_producer_authority"
runtime: Runtime
activation: Activation
reverse_request: ReverseRequest
runtime_response: RuntimeResponse
lifecycle: Lifecycle
}
export interface Runtime {
repository: "https://github.com/36Dge/yijie-codex.git"
repository_commit: "9ed24710d73f22a9b269092b8cdf2225199ea222"
repository_tree: "984e0f5bb48aaa953ed3a329614d00e5905514fb"
upstream_tag: "rust-v0.144.6"
upstream_commit: "5d1fbf26c43abc65a203928b2e31561cb039e06d"
version: "0.144.6"
transport: "stdio"
experimental_api: false
schema_file_count: 267
schema_tree_sha256: "d82a33f683e554c10dd056a0101c26fd24477928e3f98ee3d9ef250b97395228"
schema_artifacts: {
"ServerRequest.json": "4ec349fc75bcc8a123a36e4e7fbbdb969b3b13a2d8d223afddaf26c389c12a87"
"CommandExecutionRequestApprovalParams.json": "8fb08a9f71ceb0e492740afeb97658698360db13d2f6483433a7a56211ae6e6a"
"CommandExecutionRequestApprovalResponse.json": "db8384b633b9cee62f152328c5053ebaaa90299e0e686451c13de75fc01bafbd"
"ServerNotification.json": "cf64e0f4a26e0e6c34f242d6c96f9151eb90484fc37d0bf206cd4b0bff1f3d58"
}
artifact_identity: {
binary_sha256: "896d303658a0978c3628f10e9e78f12139168be9508dd5f2abc658db186a828b"
manifest_sha256: "c428c0d06c9cf578e4bcfe53b328015977578469fc46e9461cb85f8c8bcd66fb"
patch_0004_sha256: "b66583db09948fda038eaf056310d6116a37930e8b4d08e73d483c7ed1cf74e6"
}
}
export interface Activation {
exposure: "local"
profile: "demo_fast"
required_feature_gates: ["FEAT-134","FEAT-136","FEAT-137"]
approval_policy: "on-request"
fallback_approval_policy: "never"
sandbox: "read-only"
experimental_api: false
producer: {
mechanism: "runtime_owned_deterministic_execpolicy_prompt"
rule_pattern: ["git","rev-parse","--is-inside-work-tree"]
justification: "Confirm the one read-only repository check."
load_time_examples: {
match: [["git","rev-parse","--is-inside-work-tree"]]
not_match: [["git","status"],["git","show","HEAD"]]
authority: "validation_only_not_runtime_exactness"
}
runtime_match_semantics: "prefix"
exact_admission_authority: "host_wire_and_command_action_allowlist"
owner_gate: {
host_environment: "YIJIE_FEAT137_D4_DETERMINISTIC_PRODUCER_ENABLED"
enabled_value: "true"
default_state: "disabled"
ambient_handling: "strip_before_exact_authorization"
authorization_scope: "exact_local_demo_fast_feat_134_feat_136_feat_137_owner_run_d4"
}
runtime_child_gate: {
environment: "YIJIE_FEAT137_DETERMINISTIC_APPROVAL_PRODUCER"
enabled_value: "1"
injection: "host_child_process_only_exactly_once_after_owner_gate"
ambient_handling: "always_strip_before_conditional_injection"
}
first_sampling_step: {
tools: ["exec_command"]
tool_schema: {
strict: true
required: []
additional_properties: false
}
tool_choice: "required"
parallel_tool_calls: false
}
provider_arguments: "ignored_only_when_runtime_child_gate_enabled"
runtime_owned_arguments: {
command: "git rev-parse --is-inside-work-tree"
sandbox_permissions: "use_default"
}
after_first_exec_call: {
tools: []
tool_choice: "auto"
parallel_tool_calls: false
}
sandbox_permissions: "use_default"
sandbox_override: "forbidden"
permission_escalation: false
installation_scope: "exact_local_demo_fast_feat_134_feat_136_feat_137"
gate_off_state: "tools_choice_parallel_and_provider_arguments_byte_identical"
}
}
export interface ReverseRequest {
method: "item/commandExecution/requestApproval"
jsonrpc_version_member: "absent"
outer_request_id: OuterRequestId
stable_required_params: {
item_id: "itemId"
sandbox_permissions: "sandboxPermissions"
started_at_ms: "startedAtMs"
thread_id: "threadId"
turn_id: "turnId"
}
wire_shape: WireShape
identity_binding: IdentityBinding
correlation: Correlation
eligibility: Eligibility
}
export interface OuterRequestId {
wire_types: {
runtime_generated: "integer"
schema_alternate: "string"
}
runtime_generator: "integer_monotonic_from_zero_per_runtime_process"
scope: "runtime_process_generation"
exposed_to_yijie_surfaces: false
}
export interface WireShape {
outer_required_fields: {
request_id: "id"
method: "method"
params: "params"
}
outer_additional_properties: "forbidden"
params_required_fields: {
thread_id: "threadId"
turn_id: "turnId"
item_id: "itemId"
sandbox_permissions: "sandboxPermissions"
started_at_ms: "startedAtMs"
command: "command"
command_actions: "commandActions"
cwd: "cwd"
}
params_optional_fields: {
approval_id: "approvalId"
environment_id: "environmentId"
reason: "reason"
available_decisions: "availableDecisions"
}
params_additional_properties: "forbidden"
}
export interface IdentityBinding {
thread_id: "equals_host_session_runtime_thread_id"
turn_id: "equals_host_active_turn_id"
item_id: "equals_host_expected_command_item_id"
validation_order: "before_pending_projection_and_replay_fingerprint"
mismatch_behavior: "cancel_once_without_desktop_projection"
}
export interface Correlation {
replay_key_fields: {
runtime_generation: "runtime_generation"
request_id: "request_id"
}
replay_key_extraction_order: "after_exact_outer_shape_before_params_eligibility"
same_key_replay: "reuse_approval_request_id_revision_requested_at_and_expires_at"
same_key_payload_conflict: "cancel_original_once_resolve_existing_pending_elsewhere_without_new_requested_projection"
replay_payload_equivalence: {
version: 3
canonical_fields: {
thread_id: "exact_host_bound_runtime_thread_identity"
turn_id: "exact_host_active_turn_identity"
item_id: "exact_host_expected_command_item_identity"
command: "normalize_exact_pinned_zsh_login_wrapper_to_command_action_identity"
command_actions: "exact_single_unknown_command_action"
cwd: "canonical_host_workspace_identity"
environment_id: "exact_local_environment_identity"
sandbox_permissions: "exact_use_default_runtime_provenance"
approval_id: "normalize_absent_or_null_to_none"
started_at_ms: "exact_integer_value"
}
ignored_fields: {
available_decisions: "availableDecisions"
}
validated_then_discarded_fields: {
reason: "reason"
}
comparison: "exact_canonical_object"
equivalent_same_key: "reuse_pending_authority_without_ttl_reset"
different_same_key: "cancel_original_once_resolve_existing_pending_elsewhere_without_new_requested_projection"
}
request_id_reuse_across_runtime_generations: "distinct_request"
runtime_identity_storage: "host_pending_memory_only"
}
export interface Eligibility {
command: {
wire: "/bin/zsh -lc 'git rev-parse --is-inside-work-tree'"
role: "non_authoritative_transport_presentation"
validation: "exact_pinned_macos_zsh_login_wrapper"
business_authority: "command_actions"
handling: "validate_normalize_then_discard"
}
command_actions: {
exact_count: 1
type: "unknown"
command: "git rev-parse --is-inside-work-tree"
additional_properties: "forbidden"
}
approval_id: "absent_or_null"
cwd: "canonical_equal_to_host_known_workspace_root"
environment_id: "exact_local"
sandbox_permissions: {
field: "sandboxPermissions"
runtime_enum: ["use_default","require_escalated","with_additional_permissions"]
eligible_value: "use_default"
ineligible_values: ["require_escalated","with_additional_permissions"]
handling: "validate_before_pending_projection_and_retain_in_host_authority"
exposed_to_yijie_surfaces: false
}
reason: {
field: "reason"
forms: "absent_null_or_utf8_string"
max_utf8_bytes: 512
nul: "forbidden"
handling: "validate_then_discard"
replay_fingerprint: "excluded"
exposed_to_yijie_surfaces: false
}
must_be_absent: {
network_approval_context: "networkApprovalContext"
additional_permissions: "additionalPermissions"
proposed_execpolicy_amendment: "proposedExecpolicyAmendment"
proposed_network_policy_amendments: "proposedNetworkPolicyAmendments"
}
ignored_if_present: {
available_decisions: "availableDecisions"
}
started_at_ms: "required_integer_non_authoritative_for_ttl"
ineligible_request: "cancel_once_without_desktop_projection"
}
export interface RuntimeResponse {
accept_once: AcceptResponse
cancel_current_turn: CancelResponse
ttl_expired: CancelResponse
forbidden_runtime_decisions: {
accept_for_session: "acceptForSession"
accept_with_execpolicy_amendment: "acceptWithExecpolicyAmendment"
apply_network_policy_amendment: "applyNetworkPolicyAmendment"
decline: "decline"
}
malformed_response_fallback: "forbidden"
max_responses_per_request: 1
}
export interface AcceptResponse {
decision: "accept"
}
export interface CancelResponse {
decision: "cancel"
}
export interface Lifecycle {
ttl_seconds: 120
ttl_clock: "host_monotonic_receive_time"
runtime_started_at_ms_is_ttl_authority: false
race_policy: "first_writer_wins"
race_participants: {
user_decision: "user_decision"
ttl: "ttl"
server_request_resolved: "server_request_resolved"
item_terminal: "item_terminal"
turn_terminal: "turn_terminal"
}
ttl_winner: "send_cancel_once_then_resolve_expired"
authority_cleanup_winner: "resolve_elsewhere_without_runtime_response"
decision_ack_authority: "serverRequest/resolved"
resolution_acknowledgement: {
method: "serverRequest/resolved"
required_params: {
request_id: "requestId"
thread_id: "threadId"
}
correlation: {
runtime_generation: "same_runtime_process_generation"
request_id: "exact_json_type_and_value"
thread_id: "exact_runtime_thread_id"
}
matching_notification: "permit_one_decision_http_200_transition"
mismatch_behavior: "does_not_acknowledge_or_emit_http_200"
duplicate_behavior: "idempotent_no_second_transition"
timeout_behavior: "approval_unavailable_without_http_200_then_snapshot_reconcile"
}
terminal_authority: "runtime_item_and_turn_terminal"
max_pending_per_session: 1
pending_overflow: "cancel_new_request_once_without_desktop_projection"
automatic_decision_retry: false
}
