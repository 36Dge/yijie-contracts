// FEAT-162 canonical local tool authority; never performs remote discovery.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sourcePath = 'compatibility/web-retrieval/wire.schema.json';
export const manifestPath = 'compatibility/web-retrieval/tools.json';
export function loadWebRetrievalSource() {
  const schema = JSON.parse(readFileSync(path.join(root, sourcePath)));
  const manifest = JSON.parse(readFileSync(path.join(root, manifestPath)));
  assert.equal(schema.$id, 'https://schemas.yijie.ai/web-retrieval/v1');
  assert.equal(manifest.contract_id, 'web-retrieval/1');
  assert.equal(manifest.contract_version, '0.2.0');
  assert.equal(manifest.wire_authority, sourcePath);
  assert.equal(manifest.service_id, 'kimi-web');
  assert.deepEqual(manifest.tools.map(t => t.name), ['kimi_web_search', 'kimi_web_fetch']);
  assert.deepEqual(Object.keys(manifest.error_messages), schema.$defs.ErrorCode.enum);
  for (const tool of manifest.tools) {
    assert.ok(schema.$defs[tool.input] && schema.$defs[tool.output]);
    assert.deepEqual(tool.annotations, {readOnlyHint:true, destructiveHint:false, idempotentHint:false, openWorldHint:true});
    assert.equal(tool.method, 'POST');
  }
  assert.equal(manifest.semantics.permissionMode, 'ask');
  assert.equal(manifest.semantics.businessRetry, 'never');
  assert.deepEqual(manifest.limits, {defaultSearchLimit:5, maxResultBytes:65536, maxResponseBytes:1048576, httpTimeoutMs:15000, searchTimeoutSeconds:10});
  assert.equal(schema.$defs.SearchArguments.properties.limit.default, manifest.limits.defaultSearchLimit);
  const errorConditions = schema.$defs.ToolError.allOf;
  assert.deepEqual(errorConditions, Object.entries(manifest.error_messages).map(([code,message]) => ({if:{properties:{code:{const:code}},required:['code']},then:{properties:{message:{const:message}},required:['message']}})));
  function standalone(name) {
    const definition = structuredClone(schema.$defs[name]);
    const dependencies = {};
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) {
        assert.ok(value.$ref.startsWith('#/$defs/'), 'Only this local authority may be referenced');
        const target = value.$ref.slice('#/$defs/'.length);
        assert.ok(schema.$defs[target]);
        if (!dependencies[target]) {
          dependencies[target] = structuredClone(schema.$defs[target]);
          walk(dependencies[target]);
        }
      }
      Object.values(value).forEach(walk);
    }
    walk(definition);
    return {$schema:schema.$schema, ...definition, ...(Object.keys(dependencies).length ? {$defs:dependencies} : {})};
  }
  const tools = manifest.tools.map(tool => ({name:tool.name,description:tool.description,inputSchema:standalone(tool.input),outputSchema:standalone(tool.output),annotations:tool.annotations}));
  return {schema,manifest,standalone,tools};
}
