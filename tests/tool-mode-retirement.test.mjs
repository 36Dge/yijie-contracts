import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv';

test('new chat uses the original closed request without tool-mode negotiation', () => {
  const api=YAML.parse(readFileSync(new URL('../openapi/agent-host/agent-host.yaml',import.meta.url),'utf8'));
  const validate=new Ajv({strict:false}).compile(api.components.schemas.StartSessionRequest);
  assert.equal(validate({cwd:'/ordinary'}),true);
  assert.equal(validate({cwd:'/ordinary',tool_profile:'light'}),false);
  assert.equal(validate({cwd:'/ordinary',tool_profile:'full'}),false);
  assert.equal(api.components.schemas.ToolProfile,undefined);
});
