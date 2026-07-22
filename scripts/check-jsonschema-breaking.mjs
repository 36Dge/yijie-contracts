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
    else if (entry.name.endsWith(".json")) files.push(fullPath.split(path.sep).join("/"));
  }
  return files.sort();
}

function schemaTypes(schema) {
  if (schema === true) return null;
  if (schema === false) return new Set();
  if (schema.type === undefined) return null;
  return new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
}

function isSubset(left, right) {
  return [...left].every((value) => right.has(value));
}

function compareNumberConstraint(oldSchema, newSchema, key, direction, location, errors) {
  if (newSchema[key] === undefined) return;
  if (
    oldSchema[key] === undefined ||
    (direction === "minimum" && newSchema[key] > oldSchema[key]) ||
    (direction === "maximum" && newSchema[key] < oldSchema[key])
  ) {
    errors.push(`${location}: ${key} became more restrictive (${oldSchema[key] ?? "unset"} -> ${newSchema[key]})`);
  }
}

function compareSchema(oldSchema, newSchema, location, errors) {
  if (oldSchema === false || newSchema === true) return;
  if (oldSchema === true) {
    if (newSchema !== true) errors.push(`${location}: unrestricted schema was narrowed`);
    return;
  }
  if (newSchema === false) {
    errors.push(`${location}: schema now rejects every value`);
    return;
  }

  for (const key of ["$id", "$ref", "$dynamicRef", "default"]) {
    if (newSchema[key] !== undefined && oldSchema[key] !== newSchema[key]) {
      errors.push(
        `${location}: ${key} changed from ${JSON.stringify(oldSchema[key])} to ${JSON.stringify(newSchema[key])}`,
      );
    }
  }

  const oldTypes = schemaTypes(oldSchema);
  const newTypes = schemaTypes(newSchema);
  if (newTypes !== null && (oldTypes === null || !isSubset(oldTypes, newTypes))) {
    errors.push(
      `${location}: allowed types narrowed from ${JSON.stringify(oldSchema.type ?? "any")} to ${JSON.stringify(newSchema.type)}`,
    );
  }

  if (newSchema.const !== undefined && oldSchema.const !== newSchema.const) {
    errors.push(`${location}: const changed from ${JSON.stringify(oldSchema.const)} to ${JSON.stringify(newSchema.const)}`);
  }
  if (Array.isArray(newSchema.enum)) {
    if (!Array.isArray(oldSchema.enum)) {
      errors.push(`${location}: enum restriction was added`);
    } else {
      for (const value of oldSchema.enum) {
        if (!newSchema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
          errors.push(`${location}: enum value removed: ${JSON.stringify(value)}`);
        }
      }
    }
  }

  const oldProperties = oldSchema.properties ?? {};
  const newProperties = newSchema.properties ?? {};
  for (const property of Object.keys(oldProperties)) {
    if (!(property in newProperties)) errors.push(`${location}: property removed: ${property}`);
    else compareSchema(oldProperties[property], newProperties[property], `${location}.properties.${property}`, errors);
  }
  const oldRequired = new Set(oldSchema.required ?? []);
  for (const property of newSchema.required ?? []) {
    if (!oldRequired.has(property)) errors.push(`${location}: new required property: ${property}`);
  }

  const oldAdditional = oldSchema.additionalProperties ?? true;
  const newAdditional = newSchema.additionalProperties ?? true;
  if (oldAdditional !== false && newAdditional === false) {
    errors.push(`${location}: additional properties are no longer accepted`);
  } else if (typeof oldAdditional === "object" && typeof newAdditional === "object") {
    compareSchema(oldAdditional, newAdditional, `${location}.additionalProperties`, errors);
  } else if (oldAdditional === true && typeof newAdditional === "object") {
    errors.push(`${location}: additional properties are now schema-constrained`);
  }

  const oldUnevaluatedProperties = oldSchema.unevaluatedProperties ?? true;
  const newUnevaluatedProperties = newSchema.unevaluatedProperties ?? true;
  if (oldUnevaluatedProperties !== false && newUnevaluatedProperties === false) {
    errors.push(`${location}: unevaluated properties are no longer accepted`);
  } else if (
    typeof oldUnevaluatedProperties === "object" &&
    typeof newUnevaluatedProperties === "object"
  ) {
    compareSchema(
      oldUnevaluatedProperties,
      newUnevaluatedProperties,
      `${location}.unevaluatedProperties`,
      errors,
    );
  } else if (oldUnevaluatedProperties === true && typeof newUnevaluatedProperties === "object") {
    errors.push(`${location}: unevaluated properties are now schema-constrained`);
  }

  for (const key of [
    "minLength",
    "minimum",
    "exclusiveMinimum",
    "minItems",
    "minContains",
    "minProperties",
  ]) {
    compareNumberConstraint(oldSchema, newSchema, key, "minimum", location, errors);
  }
  for (const key of [
    "maxLength",
    "maximum",
    "exclusiveMaximum",
    "maxItems",
    "maxContains",
    "maxProperties",
  ]) {
    compareNumberConstraint(oldSchema, newSchema, key, "maximum", location, errors);
  }
  for (const key of ["format", "pattern", "multipleOf"]) {
    if (newSchema[key] !== undefined && oldSchema[key] !== newSchema[key]) {
      errors.push(`${location}: ${key} restriction changed from ${JSON.stringify(oldSchema[key])} to ${JSON.stringify(newSchema[key])}`);
    }
  }
  if (newSchema.uniqueItems === true && oldSchema.uniqueItems !== true) {
    errors.push(`${location}: uniqueItems restriction was added`);
  }

  for (const key of [
    "items",
    "contains",
    "propertyNames",
    "not",
    "if",
    "then",
    "else",
    "unevaluatedItems",
  ]) {
    if (oldSchema[key] !== undefined && newSchema[key] !== undefined) {
      compareSchema(oldSchema[key], newSchema[key], `${location}.${key}`, errors);
    } else if (oldSchema[key] === undefined && newSchema[key] !== undefined) {
      errors.push(`${location}: ${key} restriction was added`);
    }
  }

  const oldPrefixItems = oldSchema.prefixItems ?? [];
  const newPrefixItems = newSchema.prefixItems ?? [];
  if (oldPrefixItems.length !== newPrefixItems.length) {
    errors.push(
      `${location}: prefixItems count changed from ${oldPrefixItems.length} to ${newPrefixItems.length}`,
    );
  }
  for (let index = 0; index < Math.min(oldPrefixItems.length, newPrefixItems.length); index += 1) {
    compareSchema(
      oldPrefixItems[index],
      newPrefixItems[index],
      `${location}.prefixItems[${index}]`,
      errors,
    );
  }

  const oldDependentRequired = oldSchema.dependentRequired ?? {};
  const newDependentRequired = newSchema.dependentRequired ?? {};
  for (const [property, dependencies] of Object.entries(newDependentRequired)) {
    const previousDependencies = new Set(oldDependentRequired[property] ?? []);
    for (const dependency of dependencies) {
      if (!previousDependencies.has(dependency)) {
        errors.push(`${location}.dependentRequired.${property}: new required property: ${dependency}`);
      }
    }
  }

  for (const key of ["definitions", "$defs"]) {
    const oldEntries = oldSchema[key] ?? {};
    const newEntries = newSchema[key] ?? {};
    for (const name of Object.keys(oldEntries)) {
      if (!(name in newEntries)) errors.push(`${location}.${key}: schema removed: ${name}`);
      else compareSchema(oldEntries[name], newEntries[name], `${location}.${key}.${name}`, errors);
    }
  }

  for (const key of ["patternProperties", "dependentSchemas"]) {
    const oldEntries = oldSchema[key] ?? {};
    const newEntries = newSchema[key] ?? {};
    for (const name of Object.keys(oldEntries)) {
      if (!(name in newEntries)) errors.push(`${location}.${key}: schema removed: ${name}`);
      else compareSchema(oldEntries[name], newEntries[name], `${location}.${key}.${name}`, errors);
    }
    for (const name of Object.keys(newEntries)) {
      if (!(name in oldEntries)) errors.push(`${location}.${key}: restriction added: ${name}`);
    }
  }

  for (const key of ["allOf", "anyOf", "oneOf"]) {
    const oldBranches = oldSchema[key];
    const newBranches = newSchema[key];
    if (!oldBranches && newBranches) {
      errors.push(`${location}: ${key} restriction was added`);
      continue;
    }
    if (!oldBranches || !newBranches) continue;
    if (oldBranches.length !== newBranches.length) {
      errors.push(`${location}: ${key} branch count changed from ${oldBranches.length} to ${newBranches.length}`);
      continue;
    }
    for (let index = 0; index < oldBranches.length; index += 1) {
      compareSchema(oldBranches[index], newBranches[index], `${location}.${key}[${index}]`, errors);
    }
  }
}

const currentFiles = await findSchemas("jsonschema");
const { stdout: previousFileList } = await exec("git", [
  "ls-tree",
  "-r",
  "--name-only",
  baseRef,
  "jsonschema",
]);
const previousFiles = previousFileList.split("\n").filter((file) => file.endsWith(".json"));
const currentSet = new Set(currentFiles);
const errors = [];

for (const file of previousFiles) {
  if (!currentSet.has(file)) errors.push(`${file}: schema file was removed`);
}
for (const file of currentFiles) {
  if (!previousFiles.includes(file)) continue;
  const { stdout: previous } = await exec("git", ["show", `${baseRef}:${file}`], {
    maxBuffer: 10_000_000,
  });
  compareSchema(JSON.parse(previous), JSON.parse(await readFile(file, "utf8")), file, errors);
}

if (errors.length > 0) {
  throw new Error(`Breaking JSON Schema changes detected:\n${errors.join("\n")}`);
}
console.log(`No breaking JSON Schema changes relative to ${baseRef}.`);
