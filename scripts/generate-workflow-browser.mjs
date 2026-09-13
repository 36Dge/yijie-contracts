import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { _ } from "ajv/dist/compile/codegen/index.js";
import unicodeLengthModule from "ajv/dist/runtime/ucs2length.js";

// Compilation happens only in this canonical build tool. The emitted module is
// self-contained browser code and never compiles schemas under the editor CSP.
export function generateWorkflowBrowser(schema, bridge) {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, code: { source: true, esm: true, lines: true } });
  ajv.addKeyword({ keyword: "x-utf8-max-bytes", type: "string", schemaType: "number", code(context) {
    context.fail(_`new TextEncoder().encode(${context.data}).length > ${context.schemaCode}`);
  } });
  for (const keyword of ["x-operation-required", "x-operation-field", "x-operation-restrict-fields", "x-operation-optional"]) ajv.addKeyword({ keyword });
  ajv.addSchema(schema);
  const names = Object.keys(schema.$defs);
  const refs = {};
  for (const name of names) {
    const id = `https://schemas.yijie.ai/browser/workflow-local/${name}`;
    ajv.addSchema({ $id: id, $ref: `${schema.$id}#/$defs/${name}` });
    refs[`v_${name}`] = id;
  }
  ajv.addSchema(bridge);
  refs.validateBridge = bridge.$id;
  let js = standaloneCode(ajv, refs);
  // Ajv emits one standard Unicode code-point helper. Inline its locked source
  // rather than weakening maxLength to UTF-16 units or shipping a Node require.
  const unicodeLength = unicodeLengthModule.default ?? unicodeLengthModule;
  js = js.replaceAll('require("ajv/dist/runtime/ucs2length").default', `(${unicodeLength.toString()})`);
  if (/\brequire\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\bBuffer\b|\bprocess\b/.test(js)) throw new Error("Browser validator unexpectedly depends on Node or runtime code generation");
  js = "/* Canonical workflow source AOT validators. DO NOT EDIT. */\n" + js;
  js += `\nexport const validators = Object.freeze({\n${names.map(name => `  ${name}: v_${name},`).join("\n")}\n});\n`;
  const dts = `/* Canonical workflow source validator declarations. DO NOT EDIT. */
import type { components } from "../openapi/workflow-local.gen.js";
import type { WorkflowEditorBridgeV1 } from "../jsonschema/workflow-editor-bridge-v1.gen.js";
export type SchemaName = keyof components["schemas"];
export declare const validators: { readonly [K in SchemaName]: (value: unknown) => value is components["schemas"][K] };
export declare function validateBridge(value: unknown): value is WorkflowEditorBridgeV1;
`;
  return { js, dts };
}
