import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {root, loadBuiltinWebSource, nativeOpenApiSchema} from '../scripts/builtin-web-source.mjs';

const {schema, policy, portableTools, tools, standalone} = loadBuiltinWebSource();
const ajv = new Ajv2020({strict: true, allErrors: true}); addFormats(ajv);
ajv.addKeyword({keyword: 'x-sensitive', schemaType: 'boolean'});
ajv.addSchema(schema);

test('only the deep search gateway advertises exact in-flight coalescing', () => {
  const pro = tools.find(t => t.name === 'kimi_web_search_pro');
  const portable = portableTools.find(t => t.name === pro.name);
  assert.equal(pro._meta['ai.yijie/coalescesExactTurnRequests'], true);
  assert.equal(portable._meta, undefined);
  assert.equal(pro.inputSchema, portable.inputSchema);
  assert.equal(pro.outputSchema, portable.outputSchema);
  assert(tools.filter(t => t !== pro).every(t => t._meta === undefined));
});

test('FEAT175 every private/public candidate definition compiles with strict validation', () => {
  for (const name of Object.keys(schema.$defs)) assert.equal(typeof ajv.getSchema(schema.$id + '#/$defs/' + name), 'function', name);
  const valid = ajv.compile(standalone('OperationStatus'));
  assert(valid({operation_id:'019a8811-0000-7000-8000-000000000175',state:'unknown',dispatch:'may_have_dispatched',result_availability:'none'}), JSON.stringify(valid.errors));
  assert(valid({operation_id:'019a8811-0000-7000-8000-000000000175',state:'completed',dispatch:'completed',result_availability:'result_unavailable'}), JSON.stringify(valid.errors));
});

test('FEAT175 retains existing retrieval inputs and stable tool names with native read-only policy', () => {
  assert.equal(policy.approval_mode, 'auto');
  assert.equal(policy.parameters.subject_concurrency, 2);
  assert.equal(policy.parameters.gateway_queue_wait_seconds, 5);
  assert(policy.parameters.gateway_queue_wait_seconds + policy.parameters.binding_wait_seconds + policy.parameters.api_timeout_seconds < policy.tool_timeout_seconds);
  assert.equal(tools.length, 3);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.idempotentHint, false);
    assert.equal(tool.annotations.openWorldHint, true);
    const valid = ajv.compile(tool.inputSchema);
    const args = tool.name === 'kimi_web_fetch' ? {url: 'https://example.com/reference'} : {query: 'ordinary public reference'};
    assert(valid(args), JSON.stringify(valid.errors));
    assert(!valid({...args, model: 'unsupported-field'}));
    assert(!valid(tool.name === 'kimi_web_fetch' ? {} : {query: ''}));
    ajv.compile(tool.outputSchema);
  }
  assert(tools[1].description.includes('native web_search'));
  const completion = policy.completion_instructions;
  assert(completion.includes('needs no connector selection'));
  assert(completion.includes('specific missing part of the requested deliverable'));
  assert(completion.includes("user's full output limit"));
  for (const description of [policy.server_instructions, ...tools.map(t => t.description)]) {
    assert(description.startsWith(completion + ' '));
    assert.equal(description.split(completion).length - 1, 1);
  }
  const collection = policy.collection_instructions;
  assert(collection.includes('unfiltered source list or material collection, call kimi_web_search (Basic)'));
  assert(collection.includes('does not replace this Basic step'));
  assert(collection.includes('enough relevant titles, URLs and snippets satisfy a metadata-only list'));
  assert(collection.includes('Do not run Pro or Fetch merely to verify those links'));
  assert(collection.includes('Site/date filters or researched conclusions instead require Pro'));
  for (const description of [policy.server_instructions, tools[0].description]) {
    assert.equal(description.split(collection).length - 1, 1);
  }
  const research = policy.research_instructions;
  assert(research.includes('call kimi_web_search_pro before answering'));
  assert(research.includes('does not replace this Pro step or its filters'));
  assert(research.includes('Reuse sufficient Pro evidence'));
  assert(research.includes('An unfiltered list of sources for later reading belongs to Basic'));
  for (const description of [policy.server_instructions, tools[1].description]) {
    assert.equal(description.split(research).length - 1, 1);
  }
  assert(tools[2].description.includes('Changing only #fragment is not pagination'));
  assert(tools[2].description.includes('A URL in a source list or used only as an example is not itself a reading request'));
  assert.deepEqual(Object.keys(tools[2].inputSchema.properties), ['url']);
});

test('FEAT175 operation schema binds UUIDv7, the exact tool and its argument variant', () => {
  const valid = ajv.compile(standalone('OperationRequest'));
  const operation_id = '019a8811-0000-7000-8000-000000000175';
  assert(valid({operation_id, tool: 'kimi_web_search_pro', arguments: {query: 'ordinary research', sites: ['example.com'], time_window: {start: '2026-01', end: '2026-11'}}}), JSON.stringify(valid.errors));
  assert(!valid({operation_id, tool: 'kimi_web_fetch', arguments: {query: 'ordinary query'}}));
  assert(!valid({operation_id: '019a8811-0000-4000-8000-000000000175', tool: 'kimi_web_fetch', arguments: {url: 'https://example.com/'}}));
});

test('FEAT175 error output distinguishes product identity from supplier service failure', () => {
  const valid = ajv.compile(standalone('AppErrorOutput'));
  for (const [code, message] of Object.entries(policy.error_messages)) assert(valid({error: {code, message}}), JSON.stringify(valid.errors));
  assert(!valid({error: {code: 'upstream_unavailable', message: policy.error_messages.session_expired}}));
  assert(!valid({error: {code: 'authentication_failed', message: 'ordinary obsolete message'}}));
});

test('FEAT175 canonical projection preserves nullable turn, metadata and form property names', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'compatibility/runtime-tool-search/source.lock.json')));
  const canonical = JSON.parse(readFileSync(path.resolve(root, '../yijie-codex', lock.runtime_relative_path, 'generated-json-schema/McpServerElicitationRequestParams.json')));
  const projected = nativeOpenApiSchema(canonical);
  assert.equal(projected.properties.turnId.nullable, true);
  assert(!projected.required.includes('turnId'));
  for (let i = 0; i < canonical.oneOf.length; i++) assert.deepEqual(Object.keys(projected.oneOf[i].properties), Object.keys(canonical.oneOf[i].properties));
  assert.deepEqual(projected.oneOf[0].properties._meta, {});
  const string = nativeOpenApiSchema(canonical.definitions.McpElicitationStringSchema);
  assert.equal(string.properties.format.nullable, true);
  assert.equal(string.properties.format.allOf[0].$ref, '#/components/schemas/McpElicitationStringFormat');
  assert.equal(string.additionalProperties, false);
  assert.equal(nativeOpenApiSchema(canonical.definitions.McpElicitationSchema).properties.properties.type, 'object');
});

test('FEAT175 uses the fixed Runtime MCP configuration without extending its schema', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'compatibility/runtime-tool-search/source.lock.json')));
  const config = JSON.parse(readFileSync(path.resolve(root, '../yijie-codex', lock.runtime_relative_path, 'config.schema.json')));
  const v = new Ajv({strict: false, allErrors: true}); addFormats(v);
  for (const f of ['uint', 'uint64', 'uint32', 'uint16', 'int64']) v.addFormat(f, {type: 'number', validate: Number.isSafeInteger});
  const valid = v.compile(config);
  const server = {url: 'http://127.0.0.1:18080/mcp', enabled: true, enabled_tools: tools.map(t => t.name), default_tools_approval_mode: policy.approval_mode, startup_timeout_sec: policy.startup_timeout_seconds, tool_timeout_sec: policy.tool_timeout_seconds};
  assert(valid({web_search: 'cached', mcp_servers: {yijie_web: server}}), JSON.stringify(valid.errors));
  assert(valid({web_search: 'disabled', mcp_servers: {yijie_web: {...server, enabled: false}}}), JSON.stringify(valid.errors));
});

test('FEAT175 public and internal operations keep separate authentication authorities', () => {
  const pub = JSON.parse(readFileSync(path.join(root, 'openapi/public/web-retrieval.yaml')));
  const internal = JSON.parse(readFileSync(path.join(root, 'openapi/internal/web-retrieval.yaml')));
  assert.equal(Object.keys(pub.paths).length, 5);
  assert.equal(Object.keys(internal.paths).length, 4);
  assert.deepEqual(pub.paths['/v1/web-retrieval/delegations'].post.security, [{ProductSession: []}]);
  assert.deepEqual(pub.paths['/v1/web-retrieval/operations'].post.security, [{WebDelegation: []}]);
  for (const item of Object.values(internal.paths)) for (const op of Object.values(item)) assert.deepEqual(op.security, [{ServiceIdentity: []}]);
  assert.equal(policy.expert_policies.length, 3);
  assert(policy.expert_policies.every(p => p.expert_id === 'data-analyst-pro' && p.policy === 'disabled'));
});
