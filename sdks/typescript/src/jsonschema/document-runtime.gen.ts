// Generated from document-runtime/v1; DO NOT EDIT.
export interface EnvironmentInput {
format?: "txt" | "md" | "html" | "csv" | "json" | "docx" | "pptx" | "xlsx" | "pdf";
}
export interface StatusInput {
artifact_id: string;
}
export interface EnvironmentRequest {
thread_id: string;
turn_id: string;
input: EnvironmentInput;
}
export interface StatusRequest {
thread_id: string;
turn_id: string;
input: StatusInput;
}
export interface Guide {
format: "txt" | "md" | "html" | "csv" | "json" | "docx" | "pptx" | "xlsx" | "pdf";
path: string;
}
export interface Limits {
generated_file_bytes: 10485760;
text_source_bytes: 1048576;
max_pages: 50;
max_sheets: 10;
max_cells: 12000;
max_visual_tiles: 32;
max_artifacts: 12;
step_soft_timeout_seconds: 180;
job_soft_timeout_seconds: 900;
}
export interface EnvironmentResponse {
schema_version: 1;
status: "ready" | "unavailable";
code: "ok" | "missing" | "incompatible" | "integrity_failed" | "not_ready";
bundle_id: string;
platform: "macos-arm64";
python_path: string;
helper_path: string;
renderer_path: string;
guides: Array<Guide>;
limits: Limits;
}
export interface StatusResponse {
schema_version: 1;
artifact_id: string;
status: "staged" | "committed" | "expired" | "unknown";
}
export interface BundleFile {
path: string;
kind: "file" | "symlink";
sha256: string;
size_bytes: number;
link_target: string;
}
export interface BundleManifest {
schema_version: 1;
bundle_id: string;
platform: "macos-arm64";
minimum_macos: "14.0";
python_version: "3.12.16";
libreoffice_version: "26.8.2";
python: string;
helper: string;
renderer: string;
libreoffice: string;
fonts: Array<string>;
guides: Array<Guide>;
limits: Limits;
files: Array<BundleFile>;
}
export interface AdapterStartup {
host_origin: string;
host_token: string;
capability: string;
document_runtime_enabled?: boolean;
}
export interface InputReceipt {
schema_version: 1;
operation_id: string;
attachment_id: string;
sha256: string;
size_bytes: number;
format: "txt" | "md" | "html" | "csv" | "json" | "docx" | "pptx" | "xlsx" | "pdf";
expires_at: number;
}
