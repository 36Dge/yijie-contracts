import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

async function findSchemas(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findSchemas(fullPath)));
    else if (entry.name.endsWith(".json")) files.push(fullPath);
  }
  return files;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const keyword of [
  "x-yijie-max-reasoning-items-per-turn",
  "x-yijie-max-reasoning-utf8-bytes-per-turn",
  "x-yijie-max-total-utf8-bytes",
  "x-yijie-max-utf8-bytes",
  "x-yijie-max-json-depth",
]) {
  ajv.addKeyword({ keyword, schemaType: "number" });
}
ajv.addKeyword({
  keyword: "x-yijie-max-sse-data-utf8-bytes",
  schemaType: "number",
  type: "object",
  errors: false,
  validate: (maximum, value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= maximum,
});
ajv.addKeyword({ keyword: "x-yijie-content-index-rule", schemaType: "string" });
ajv.addKeyword({ keyword: "x-yijie-projection-limit-policy", schemaType: "object" });
ajv.addKeyword({ keyword: "x-yijie-command-tool-projection-policy", schemaType: "object" });
ajv.addKeyword({ keyword: "x-yijie-command-approval-policy", schemaType: "object" });
ajv.addKeyword({
  keyword: "x-yijie-approval-time-window",
  schemaType: "object",
  type: "object",
  errors: false,
  validate: (policy, value) => {
    const requestedAt = Date.parse(value[policy.requested_at_field]);
    const expiresAt = Date.parse(value[policy.expires_at_field]);
    if (!Number.isFinite(requestedAt) || !Number.isFinite(expiresAt)) return false;
    if (expiresAt - requestedAt !== policy.ttl_seconds * 1000) return false;
    if (!policy.resolved_at_field) return true;
    const resolvedAt = Date.parse(value[policy.resolved_at_field]);
    if (!Number.isFinite(resolvedAt) || resolvedAt < requestedAt) return false;
    const isDeadlineOutcome = value[policy.outcome_field] === policy.deadline_outcome;
    return isDeadlineOutcome ? resolvedAt >= expiresAt : resolvedAt < expiresAt;
  },
});
const files = await findSchemas("jsonschema");
for (const file of files) {
  const schema = JSON.parse(await readFile(file, "utf8"));
  ajv.compile(schema);
}

console.log(`Validated ${files.length} JSON Schema documents.`);
