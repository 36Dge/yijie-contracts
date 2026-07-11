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
const files = await findSchemas("jsonschema");
for (const file of files) {
  const schema = JSON.parse(await readFile(file, "utf8"));
  ajv.compile(schema);
}

console.log(`Validated ${files.length} JSON Schema documents.`);
