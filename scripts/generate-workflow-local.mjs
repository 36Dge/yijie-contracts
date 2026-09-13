import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";
import { generateWorkflowBrowser } from "./generate-workflow-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A generation baseline is provenance, not the commit containing its own lock.
// Checkers replay it explicitly so committing unchanged outputs cannot cause drift.
const baseArgument = process.argv.indexOf("--base-commit");
const base = baseArgument === -1
  ? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  : process.argv[baseArgument + 1];
if (!/^[0-9a-f]{40}$/.test(base ?? "")) throw new Error("Use a full generation baseline commit.");
execFileSync("git", ["cat-file", "-e", `${base}^{commit}`], { cwd: root });
const source = "openapi/workflow-local/workflow-local.yaml";
const bridge = "jsonschema/workflow-editor/bridge-v1.schema.json";
const spec = JSON.parse(readFileSync(path.join(root, source), "utf8"));
const schemas = spec.components.schemas;
const go = process.env.YIJIE_GO ?? "go";
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: "inherit" });
const write = (file, data) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), data);
};
const sha = file => createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex");

// A dedicated path: no legacy fixture generation, no deletion or rewrite of old SDKs.
const goOut = "sdks/go/openapi/workflow-local/types.gen.go";
const tsOut = "sdks/typescript/src/openapi/workflow-local.gen.ts";
mkdirSync(path.dirname(path.join(root, goOut)), { recursive: true });
run(go, ["tool", "oapi-codegen", "-generate", "types,skip-prune", "-package", "workflowlocal", "-o", goOut, source]);
run("pnpm", ["exec", "openapi-typescript", source, "--redocly", "openapi-typescript.redocly.yaml", "--default-non-nullable", "false", "-o", tsOut]);

const pascal = value => value.split(/[_-]/).map(word => word[0].toUpperCase() + word.slice(1)).join("");
function rustType(schema) {
  if (schema.$ref) return schema.$ref.split("/").at(-1);
  if (schema.type === "string") return "String";
  if (schema.type === "integer") return "i64";
  if (schema.type === "boolean") return "bool";
  if (schema.type === "array") return `Vec<${rustType(schema.items)}>`;
  throw new Error(`Unsupported workflow Rust schema: ${JSON.stringify(schema)}`);
}
let rust = "// Code generated from workflow-local OpenAPI by generate-workflow-local.mjs. DO NOT EDIT.\n";
rust += "// Debug implementations intentionally omit all field values, including native-only secrets.\n";
rust += "use serde::{Deserialize, Serialize};\n\n";
for (const [name, schema] of Object.entries(schemas)) {
  if (schema.type === "object") {
    rust += `#[derive(Clone, Serialize, Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct ${name} {\n`;
    for (const [field, value] of Object.entries(schema.properties)) {
      const required = (schema.required ?? []).includes(field);
      if (!required) rust += '    #[serde(default, skip_serializing_if = "Option::is_none")]\n';
      // Inline string enums get named variants through the canonical component,
      // where needed; inline enum scalars still validate against the schema.
      rust += `    pub ${field === "type" ? "r#type" : field}: ${required ? rustType(value) : `Option<${rustType(value)}>`},\n`;
    }
    rust += `}\nimpl std::fmt::Debug for ${name} {\n    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("${name}([redacted])") }\n}\n\n`;
  } else if (schema.type === "string" && schema.enum) {
    rust += `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]\npub enum ${name} {\n`;
    for (const value of schema.enum) rust += `    #[serde(rename = "${value}")]\n    ${pascal(value)},\n`;
    rust += "}\n\n";
  } else rust += `pub type ${name} = ${rustType(schema)};\n\n`;
}
const rustOut = "sdks/rust/workflow-local/types.gen.rs";
write(rustOut, rust);
run("rustfmt", ["--edition", "2021", path.join(root, rustOut)]);

// JSON Schema is a generated projection of the OpenAPI authority, not another source.
function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "format" && child === "int64") continue;
    result[key] = key === "$ref" ? child.replace("#/components/schemas/", "#/$defs/") : project(child);
  }
  if (value["x-operation-required"]) {
    const field = value["x-operation-field"] ?? "operation";
    const fieldSchema = value.properties[field];
    const operations = (fieldSchema.$ref ? schemas[fieldSchema.$ref.split("/").at(-1)] : fieldSchema).enum;
    result.allOf = operations.map(operation => {
      const fields = value["x-operation-required"][operation] ?? [];
      const then = { required: fields };
      if (value["x-operation-restrict-fields"]) {
        const allowed = new Set([...(value.required ?? []), ...fields, ...(value["x-operation-optional"]?.[operation] ?? [])]);
        then.properties = Object.fromEntries(Object.keys(value.properties).filter(name => !allowed.has(name)).map(name => [name, false]));
      }
      return { if: { properties: { [field]: { const: operation } } }, then };
    });
  }
  return result;
}
const projection = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://schemas.yijie.ai/workflow-local/v1", $defs: project(schemas) };
const projectionOut = "sdks/jsonschema/workflow-local.schema.json";
write(projectionOut, JSON.stringify(projection, null, 2) + "\n");
const bridgeProjection = JSON.parse(readFileSync(path.join(root, bridge), "utf8"));
for (const value of Object.values(bridgeProjection.properties)) {
  if (value.$ref) value.$ref = value.$ref.replace("../../openapi/workflow-local/workflow-local.yaml#/components/schemas/", "https://schemas.yijie.ai/workflow-local/v1#/$defs/");
  if (value.format === "int64") delete value.format;
}
const bridgeOut = "sdks/jsonschema/workflow-editor-bridge-v1.schema.json";
write(bridgeOut, JSON.stringify(bridgeProjection, null, 2) + "\n");
// Reuse OpenAPI component types; the projected JSON Schema validates conditional
// fields at runtime. This file adds no second, hand-maintained set of wire DTOs.
const bridgeTypes = structuredClone(bridgeProjection);
for (const [field, value] of Object.entries(bridgeTypes.properties)) {
  if (value.$ref) bridgeTypes.properties[field] = { tsType: `components["schemas"]["${value.$ref.split("/").at(-1)}"]` };
}
const bridgeTsOut = "sdks/typescript/src/jsonschema/workflow-editor-bridge-v1.gen.ts";
// Normalize source if/then kind rules into TS unions. Conditional JSON Schema
// otherwise becomes an open index signature in json-schema-to-typescript.
const bridgeBranches = bridgeTypes.allOf.flatMap(rule => {
  const { allOf, $schema, $id, ...baseType } = bridgeTypes;
  const { oneOf, ...then } = rule.then;
  return (oneOf ?? [{}]).map(outcome => {
    const result = structuredClone(baseType);
    result.properties.kind = rule.if.properties.kind;
    result.required = [...new Set([...bridgeTypes.required, ...(then.required ?? []), ...(outcome.required ?? [])])];
    for (const field of outcome.not?.required ?? []) result.properties[field] = { tsType: "never" };
    return result;
  });
});
write(bridgeTsOut, await compile({ title: bridgeTypes.title, oneOf: bridgeBranches }, bridgeTypes.title, {
  bannerComment: '/* Generated from workflow editor source. Do not edit by hand. */\nimport type { components } from "../openapi/workflow-local.gen.js";',
  additionalProperties: false, format: false,
}));
const browser = generateWorkflowBrowser(projection, bridgeProjection);
const browserOut = "sdks/typescript/src/browser/workflow-local-validator.gen.js";
const browserTypesOut = "sdks/typescript/src/browser/workflow-local-validator.gen.d.ts";
write(browserOut, browser.js);
write(browserTypesOut, browser.dts);
const internal = structuredClone(spec);
internal.info.title = "Yijie private Coze workflow adapter";
internal.servers = [{ url: "http://coze-workflow:18889" }];
for (const [route, methods] of Object.entries(internal.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    if (spec["x-private-adapter"].excluded_operations.includes(operation.operationId)) delete methods[method];
    else operation.parameters = operation.parameters.filter(parameter => !spec["x-private-adapter"].omit_request_headers.includes(parameter.name));
  }
  if (!Object.keys(methods).length) delete internal.paths[route];
}
internal.components.securitySchemes.ServiceBearer.description = "Distinct API-to-Coze K_AC, fixed run epoch and principal/resource checks. Never K_NA or browser E.";
const internalOut = "sdks/openapi/workflow-internal.gen.json";
write(internalOut, JSON.stringify(internal, null, 2) + "\n");
const outputs = [goOut, tsOut, rustOut, projectionOut, bridgeOut, bridgeTsOut, browserOut, browserTypesOut, internalOut];
write("compatibility/workflow-local/source.lock.json", JSON.stringify({
  schema_version: 1, contract_version: spec.info.version, mode: "local_candidate", base_commit: base,
  repository: "https://github.com/36Dge/yijie-contracts.git",
  sources: [source, bridge, "scripts/generate-workflow-local.mjs", "scripts/generate-workflow-browser.mjs", "scripts/sync-workflow-consumer.mjs"].map(file => ({ path: file, sha256: sha(file) })),
  generated: outputs.map(file => ({ path: file, sha256: sha(file) })),
  generators: { go: "oapi-codegen/v2@v2.7.2", typescript: "openapi-typescript@7.13.0; defaultNonNullable=false", rust: "source-local deterministic subset; existing serde", browser: "ajv@8.20.0 standalone ESM; TextEncoder UTF8; inlined locked Unicode helper" },
  release: false,
}, null, 2) + "\n");
console.log("Generated isolated workflow-local Go/TypeScript/Rust models and schema projections. Local candidate only.");
