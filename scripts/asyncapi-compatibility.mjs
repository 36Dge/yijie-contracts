function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function schemaTypes(schema) {
  if (schema === true) return null;
  if (schema === false) return new Set();
  if (schema?.type === undefined) return null;
  return new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
}

function isSubset(left, right) {
  return [...left].every((value) => right.has(value));
}

function compareMinimum(oldSchema, newSchema, key, location, errors) {
  if (newSchema[key] === undefined) return;
  if (oldSchema[key] === undefined || newSchema[key] > oldSchema[key]) {
    errors.push(
      `${location}: ${key} became more restrictive (${oldSchema[key] ?? "unset"} -> ${newSchema[key]})`,
    );
  }
}

function compareMaximum(oldSchema, newSchema, key, location, errors) {
  if (newSchema[key] === undefined) return;
  if (oldSchema[key] === undefined || newSchema[key] < oldSchema[key]) {
    errors.push(
      `${location}: ${key} became more restrictive (${oldSchema[key] ?? "unset"} -> ${newSchema[key]})`,
    );
  }
}

function compareReference(oldValue, newValue, location, errors) {
  const oldReference = oldValue?.$ref;
  const newReference = newValue?.$ref;
  if (oldReference !== undefined && oldReference !== newReference) {
    errors.push(
      `${location}: reference changed from ${JSON.stringify(oldReference)} to ${JSON.stringify(newReference ?? null)}`,
    );
    return true;
  }
  return oldReference !== undefined;
}

/**
 * Report clear input-compatibility regressions between two JSON Schema fragments.
 * The checker intentionally errs on the side of reporting ambiguous structural
 * rewrites so that a human can review them instead of silently accepting one.
 */
export function compareSchema(oldSchema, newSchema, location, errors) {
  if (oldSchema === undefined) return;
  if (newSchema === undefined) {
    errors.push(`${location}: schema was removed`);
    return;
  }
  if (oldSchema === false || newSchema === true) return;
  if (oldSchema === true) {
    if (newSchema !== true) errors.push(`${location}: unrestricted schema was narrowed`);
    return;
  }
  if (newSchema === false) {
    errors.push(`${location}: schema now rejects every value`);
    return;
  }
  if (
    oldSchema === null ||
    newSchema === null ||
    typeof oldSchema !== "object" ||
    typeof newSchema !== "object"
  ) {
    if (!sameValue(oldSchema, newSchema)) errors.push(`${location}: schema changed incompatibly`);
    return;
  }

  if (compareReference(oldSchema, newSchema, location, errors)) return;

  const oldTypes = schemaTypes(oldSchema);
  const newTypes = schemaTypes(newSchema);
  if (newTypes !== null && (oldTypes === null || !isSubset(oldTypes, newTypes))) {
    errors.push(
      `${location}: allowed types narrowed from ${JSON.stringify(oldSchema.type ?? "any")} to ${JSON.stringify(newSchema.type)}`,
    );
  }

  if (newSchema.const !== undefined && !sameValue(oldSchema.const, newSchema.const)) {
    errors.push(
      `${location}: const changed from ${JSON.stringify(oldSchema.const)} to ${JSON.stringify(newSchema.const)}`,
    );
  }
  if (Array.isArray(newSchema.enum)) {
    if (!Array.isArray(oldSchema.enum)) {
      errors.push(`${location}: enum restriction was added`);
    } else {
      for (const value of oldSchema.enum) {
        if (!newSchema.enum.some((candidate) => sameValue(candidate, value))) {
          errors.push(`${location}: enum value removed: ${JSON.stringify(value)}`);
        }
      }
    }
  }

  const oldProperties = oldSchema.properties ?? {};
  const newProperties = newSchema.properties ?? {};
  for (const property of Object.keys(oldProperties)) {
    if (!(property in newProperties)) {
      errors.push(`${location}: property removed: ${property}`);
    } else {
      compareSchema(
        oldProperties[property],
        newProperties[property],
        `${location}.properties.${property}`,
        errors,
      );
    }
  }

  const oldRequired = new Set(oldSchema.required ?? []);
  for (const property of newSchema.required ?? []) {
    if (!oldRequired.has(property)) errors.push(`${location}: new required property: ${property}`);
  }

  const oldAdditional = oldSchema.additionalProperties ?? true;
  const newAdditional = newSchema.additionalProperties ?? true;
  if (oldAdditional !== false && newAdditional === false) {
    errors.push(`${location}: additional properties are no longer accepted`);
  } else if (
    oldAdditional !== true &&
    newAdditional !== true &&
    typeof oldAdditional === "object" &&
    typeof newAdditional === "object"
  ) {
    compareSchema(oldAdditional, newAdditional, `${location}.additionalProperties`, errors);
  }

  for (const key of [
    "minLength",
    "minimum",
    "exclusiveMinimum",
    "minItems",
    "minContains",
    "minProperties",
  ]) {
    compareMinimum(oldSchema, newSchema, key, location, errors);
  }
  for (const key of [
    "maxLength",
    "maximum",
    "exclusiveMaximum",
    "maxItems",
    "maxContains",
    "maxProperties",
  ]) {
    compareMaximum(oldSchema, newSchema, key, location, errors);
  }
  for (const key of ["format", "pattern", "multipleOf", "contentEncoding", "contentMediaType"]) {
    if (newSchema[key] !== undefined && oldSchema[key] !== newSchema[key]) {
      errors.push(
        `${location}: ${key} restriction changed from ${JSON.stringify(oldSchema[key])} to ${JSON.stringify(newSchema[key])}`,
      );
    }
  }
  if (newSchema.uniqueItems === true && oldSchema.uniqueItems !== true) {
    errors.push(`${location}: uniqueItems restriction was added`);
  }

  if (oldSchema.items !== undefined && newSchema.items !== undefined) {
    compareSchema(oldSchema.items, newSchema.items, `${location}.items`, errors);
  } else if (oldSchema.items === undefined && newSchema.items !== undefined) {
    errors.push(`${location}: items restriction was added`);
  }
  for (const key of ["contains", "propertyNames", "not"]) {
    if (oldSchema[key] !== undefined && newSchema[key] !== undefined) {
      compareSchema(oldSchema[key], newSchema[key], `${location}.${key}`, errors);
    } else if (oldSchema[key] === undefined && newSchema[key] !== undefined) {
      errors.push(`${location}: ${key} restriction was added`);
    }
  }

  for (const key of ["$defs", "definitions", "patternProperties", "dependentSchemas"]) {
    const oldEntries = oldSchema[key] ?? {};
    const newEntries = newSchema[key] ?? {};
    for (const name of Object.keys(oldEntries)) {
      if (!(name in newEntries)) {
        errors.push(`${location}.${key}: schema removed: ${name}`);
      } else {
        compareSchema(oldEntries[name], newEntries[name], `${location}.${key}.${name}`, errors);
      }
    }
  }

  const oldDependentRequired = oldSchema.dependentRequired ?? {};
  const newDependentRequired = newSchema.dependentRequired ?? {};
  for (const [property, dependencies] of Object.entries(newDependentRequired)) {
    const oldDependencies = new Set(oldDependentRequired[property] ?? []);
    for (const dependency of dependencies) {
      if (!oldDependencies.has(dependency)) {
        errors.push(`${location}.dependentRequired.${property}: new required property: ${dependency}`);
      }
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
    const clearlyNarrowed =
      (key === "allOf" && newBranches.length > oldBranches.length) ||
      (key === "anyOf" && newBranches.length < oldBranches.length) ||
      (key === "oneOf" && newBranches.length !== oldBranches.length);
    if (clearlyNarrowed) {
      errors.push(
        `${location}: ${key} branch count changed from ${oldBranches.length} to ${newBranches.length}`,
      );
    }
    const sharedLength = Math.min(oldBranches.length, newBranches.length);
    for (let index = 0; index < sharedLength; index += 1) {
      compareSchema(oldBranches[index], newBranches[index], `${location}.${key}[${index}]`, errors);
    }
  }
}

function compareMessage(oldMessage, newMessage, location, errors) {
  if (compareReference(oldMessage, newMessage, location, errors)) return;

  for (const key of ["name", "contentType", "schemaFormat"]) {
    if (oldMessage[key] !== undefined && oldMessage[key] !== newMessage[key]) {
      errors.push(
        `${location}: ${key} changed from ${JSON.stringify(oldMessage[key])} to ${JSON.stringify(newMessage[key] ?? null)}`,
      );
    }
  }
  if (
    oldMessage.correlationId?.location !== undefined &&
    oldMessage.correlationId.location !== newMessage.correlationId?.location
  ) {
    errors.push(`${location}: correlationId.location changed`);
  }
  compareSchema(oldMessage.headers, newMessage.headers, `${location}.headers`, errors);
  compareSchema(oldMessage.payload, newMessage.payload, `${location}.payload`, errors);
}

function compareNamedEntries(oldEntries, newEntries, location, removedLabel, errors, compare) {
  for (const [name, oldEntry] of Object.entries(oldEntries ?? {})) {
    if (!(name in (newEntries ?? {}))) {
      errors.push(`${location}.${name}: ${removedLabel} was removed`);
    } else if (compare) {
      compare(oldEntry, newEntries[name], `${location}.${name}`, errors);
    }
  }
}

function messageIdentity(message, index) {
  return message?.$ref ?? (message?.name ? `name:${message.name}` : `index:${index}`);
}

function compareOperation(oldOperation, newOperation, location, errors) {
  if (oldOperation.action !== undefined && oldOperation.action !== newOperation.action) {
    errors.push(
      `${location}: action changed from ${JSON.stringify(oldOperation.action)} to ${JSON.stringify(newOperation.action ?? null)}`,
    );
  }
  compareReference(oldOperation.channel, newOperation.channel, `${location}.channel`, errors);

  const newMessages = new Set(
    (newOperation.messages ?? []).map((message, index) => messageIdentity(message, index)),
  );
  for (const [index, message] of (oldOperation.messages ?? []).entries()) {
    const identity = messageIdentity(message, index);
    if (!newMessages.has(identity)) errors.push(`${location}.messages: message removed: ${identity}`);
  }
}

function compareChannel(oldChannel, newChannel, location, errors) {
  if (oldChannel.address !== undefined && oldChannel.address !== newChannel.address) {
    errors.push(
      `${location}: address changed from ${JSON.stringify(oldChannel.address)} to ${JSON.stringify(newChannel.address ?? null)}`,
    );
  }
  compareNamedEntries(
    oldChannel.messages,
    newChannel.messages,
    `${location}.messages`,
    "message",
    errors,
    compareMessage,
  );
  compareNamedEntries(
    oldChannel.parameters,
    newChannel.parameters,
    `${location}.parameters`,
    "parameter",
    errors,
    (oldParameter, newParameter, parameterLocation, parameterErrors) => {
      if (compareReference(oldParameter, newParameter, parameterLocation, parameterErrors)) return;
      compareSchema(
        oldParameter.schema,
        newParameter.schema,
        `${parameterLocation}.schema`,
        parameterErrors,
      );
    },
  );
}

/**
 * Return human-readable breaking changes. A missing baseline is intentionally
 * treated as an additive introduction of the AsyncAPI document.
 */
export function compareAsyncApi(oldApi, newApi) {
  if (oldApi == null) return [];

  const errors = [];
  const oldMajor = String(oldApi.asyncapi ?? "").split(".")[0];
  const newMajor = String(newApi.asyncapi ?? "").split(".")[0];
  if (oldMajor && newMajor && oldMajor !== newMajor) {
    errors.push(`asyncapi: specification major version changed from ${oldApi.asyncapi} to ${newApi.asyncapi}`);
  }

  compareNamedEntries(
    oldApi.channels,
    newApi.channels,
    "channels",
    "channel",
    errors,
    compareChannel,
  );
  compareNamedEntries(
    oldApi.operations,
    newApi.operations,
    "operations",
    "operation",
    errors,
    compareOperation,
  );
  compareNamedEntries(
    oldApi.components?.messages,
    newApi.components?.messages,
    "components.messages",
    "message",
    errors,
    compareMessage,
  );
  compareNamedEntries(
    oldApi.components?.schemas,
    newApi.components?.schemas,
    "components.schemas",
    "schema",
    errors,
    compareSchema,
  );

  return errors;
}
