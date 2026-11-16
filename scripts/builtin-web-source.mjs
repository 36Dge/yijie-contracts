import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadWebRetrievalSource} from './web-retrieval-source.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const family = 'compatibility/builtin-web-retrieval';

// Mechanical representation conversion only. Property names such as "format"
// and "properties" are data keys inside a property dictionary, not keywords.
// JSON Schema `true` is equivalent to OpenAPI's unconstrained schema `{}`.
export function nativeOpenApiSchema(value, dictionary = false) {
  if (value === true) return {};
  if (value === false) return {not: {}};
  if (Array.isArray(value)) return value.map(v => nativeOpenApiSchema(v));
  if (!value || typeof value !== 'object') return value;
  if (dictionary) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nativeOpenApiSchema(v)]));
  if (value.anyOf?.length === 2 && value.anyOf.some(v => v.type === 'null')) {
    const {anyOf, ...rest} = value;
    const other = nativeOpenApiSchema(anyOf.find(v => v.type !== 'null'));
    return {...nativeOpenApiSchema(rest), ...(other.$ref ? {allOf: [other]} : other), nullable: true};
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (['$schema', 'definitions', 'title'].includes(key)) continue;
    if (key === '$ref') out[key] = child.replace('#/definitions/', '#/components/schemas/');
    else if (key === 'properties') out[key] = nativeOpenApiSchema(child, true);
    else if (key === 'additionalProperties' && typeof child === 'boolean') out[key] = child;
    else if (key === 'type' && Array.isArray(child)) {
      assert(child.includes('null') && child.length === 2);
      out.type = child.find(t => t !== 'null'); out.nullable = true;
    } else if (key === 'format' && typeof child === 'string' && child.startsWith('uint')) out[key] = 'int64';
    else if (['default', 'enum', 'const', 'examples'].includes(key)) out[key] = structuredClone(child);
    else out[key] = nativeOpenApiSchema(child);
  }
  return out;
}
export function loadBuiltinWebSource() {
  const source = JSON.parse(readFileSync(path.join(root, family, 'wire.schema.json')));
  const policy = JSON.parse(readFileSync(path.join(root, family, 'policy.json')));
  const legacy = loadWebRetrievalSource();
  assert.equal(policy.contract_id, 'builtin-web-retrieval/1');
  assert.equal(policy.release, false);
  for (const field of ['server_instructions', 'completion_instructions', 'collection_instructions', 'research_instructions']) {
    assert(typeof policy[field] === 'string' && policy[field].trim().length > 0, field);
  }
  assert(Number.isInteger(policy.parameters.subject_concurrency) && policy.parameters.subject_concurrency > 0);
  assert(Number.isInteger(policy.parameters.gateway_queue_wait_seconds) && policy.parameters.gateway_queue_wait_seconds > 0);
  assert(policy.parameters.gateway_queue_wait_seconds + policy.parameters.binding_wait_seconds + policy.parameters.api_timeout_seconds < policy.tool_timeout_seconds);
  assert.deepEqual(policy.tools.map(t => t.name), legacy.manifest.tools.map(t => t.name));
  // Native standalone functions retain their description, not the namespace.
  // Project each task rule and the shared completion rule from the same source.
  const taskInstructions = {
    kimi_web_search: policy.collection_instructions,
    kimi_web_search_pro: policy.research_instructions,
  };
  policy.server_instructions = [policy.completion_instructions, policy.collection_instructions,
    policy.research_instructions, policy.tools.find(t => t.name === 'kimi_web_fetch').description,
    policy.server_instructions].join(' ');
  // This bundle is derived. The existing retrieval source still owns all input
  // and successful output shapes; only the application error belongs here.
  const schema = {...source, $defs: {...structuredClone(legacy.schema.$defs), ...source.$defs}};
  function resolve(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref?.startsWith('../web-retrieval/wire.schema.json#/$defs/')) {
      value.$ref = value.$ref.replace('../web-retrieval/wire.schema.json', '');
    }
    for (const child of Object.values(value)) resolve(child);
  }
  resolve(schema);
  function standalone(name) {
    const definition = structuredClone(schema.$defs[name]);
    const deps = {};
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) {
        assert(value.$ref.startsWith('#/$defs/'));
        const key = value.$ref.slice('#/$defs/'.length);
        assert(schema.$defs[key]);
        if (!deps[key]) { deps[key] = structuredClone(schema.$defs[key]); walk(deps[key]); }
      }
      Object.values(value).forEach(walk);
    }
    walk(definition);
    return {$schema: schema.$schema, ...definition, ...(Object.keys(deps).length ? {$defs: deps} : {})};
  }
  const tools = policy.tools.map(t => {
    assert.deepEqual(t.annotations, {readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true});
    const output = standalone(t.output);
    output.oneOf = output.oneOf.map(v => v.$ref === '#/$defs/ErrorOutput' ? {$ref: '#/$defs/AppErrorOutput'} : v);
    delete output.$defs.ErrorOutput; delete output.$defs.ToolError; delete output.$defs.ErrorCode;
    Object.assign(output.$defs, standalone('AppErrorOutput').$defs, {AppErrorOutput: schema.$defs.AppErrorOutput});
    const description = [policy.completion_instructions, taskInstructions[t.name], t.description].filter(Boolean).join(' ');
    return {name: t.name, title: t.title, description, inputSchema: standalone(t.input), outputSchema: output, annotations: t.annotations};
  });
  return {source, schema, policy, tools, standalone};
}
