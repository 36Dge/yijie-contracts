import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";

export function workflowValidators() {
  const lock = JSON.parse(readFileSync("compatibility/workflow-local/source.lock.json"));
  for (const file of [...lock.sources, ...lock.generated]) {
    const digest = createHash("sha256").update(readFileSync(file.path)).digest("hex");
    if (digest !== file.sha256) throw new Error(`Workflow source/projection drift: ${file.path}`);
  }
  const schema = JSON.parse(readFileSync("sdks/jsonschema/workflow-local.schema.json"));
  const bridge = JSON.parse(readFileSync("sdks/jsonschema/workflow-editor-bridge-v1.schema.json"));
  // Required fields inside conditional branches are declared by the parent.
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  ajv.addKeyword({ keyword: "x-utf8-max-bytes", type: "string", schemaType: "number", validate: (max, value) => Buffer.byteLength(value, "utf8") <= max });
  ajv.addKeyword({ keyword: "x-operation-required", schemaType: "object" });
  ajv.addKeyword({ keyword: "x-operation-field", schemaType: "string" });
  ajv.addKeyword({ keyword: "x-operation-restrict-fields", schemaType: "boolean" });
  ajv.addKeyword({ keyword: "x-operation-optional", schemaType: "object" });
  ajv.addSchema(schema);
  const components = Object.fromEntries(Object.keys(schema.$defs).map(name => [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));
  return { components, bridge: ajv.compile(bridge), schema };
}
