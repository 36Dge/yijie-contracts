/* Canonical workflow source validator declarations. DO NOT EDIT. */
import type { components } from "../openapi/workflow-local.gen.js";
import type { WorkflowEditorBridgeV1 } from "../jsonschema/workflow-editor-bridge-v1.gen.js";
export type SchemaName = keyof components["schemas"];
export declare const validators: { readonly [K in SchemaName]: (value: unknown) => value is components["schemas"][K] };
export declare function validateBridge(value: unknown): value is WorkflowEditorBridgeV1;
