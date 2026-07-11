import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const baseRef = process.argv[2] ?? "main";

async function findSchemas(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findSchemas(fullPath)));
    else if (entry.name.endsWith(".json")) files.push(fullPath);
  }
  return files;
}

function compareSchema(oldSchema, newSchema, location, errors) {
  if (oldSchema.type && newSchema.type && oldSchema.type !== newSchema.type) {
    errors.push(`${location}: type changed from ${oldSchema.type} to ${newSchema.type}`);
  }
  const oldProperties = oldSchema.properties ?? {};
  const newProperties = newSchema.properties ?? {};
  for (const property of Object.keys(oldProperties)) {
    if (!(property in newProperties)) errors.push(`${location}: property removed: ${property}`);
    else compareSchema(oldProperties[property], newProperties[property], `${location}.${property}`, errors);
  }
  const oldRequired = new Set(oldSchema.required ?? []);
  for (const property of newSchema.required ?? []) {
    if (!oldRequired.has(property)) errors.push(`${location}: new required property: ${property}`);
  }
  if (Array.isArray(oldSchema.enum) && Array.isArray(newSchema.enum)) {
    for (const value of oldSchema.enum) {
      if (!newSchema.enum.includes(value)) errors.push(`${location}: enum value removed: ${value}`);
    }
  }
}

const errors = [];
for (const file of await findSchemas("jsonschema")) {
  const relativePath = file.split(path.sep).join("/");
  let previous;
  try {
    ({ stdout: previous } = await exec("git", ["show", `${baseRef}:${relativePath}`], { maxBuffer: 10_000_000 }));
  } catch {
    continue;
  }
  compareSchema(JSON.parse(previous), JSON.parse(await readFile(file, "utf8")), relativePath, errors);
}

if (errors.length > 0) {
  throw new Error(`Breaking JSON Schema changes detected:\n${errors.join("\n")}`);
}
console.log(`No breaking JSON Schema changes relative to ${baseRef}.`);
