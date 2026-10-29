// Explicit acceptance consumer adapter uses existing owner authority only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import YAML from 'yaml';
import Ajv from 'ajv';
const source = YAML.parse(readFileSync('openapi/agent-host/agent-host.yaml', 'utf8'));
test('FEAT-162 owner stop adapter remains within canonical GET/interrupt authority', () => {
  const session = '/v1/agent-sessions/{agent_session_id}';
  const interrupt = `${session}/turns/{turn_id}/interrupt`;
  assert.ok(source.paths[session].get.responses['200']);
  assert.equal(source.paths[interrupt].post.operationId, 'interruptAgentTurn');
  assert.ok(source.paths[interrupt].post.responses['204']);
  assert.equal(source.paths[interrupt].post.requestBody.content['application/json'].schema.$ref, '#/components/schemas/TraceRequest');
  assert.ok(new Ajv().compile(source.components.schemas.TraceRequest)({}));
  for (const field of ['agent_session_id', 'codex_thread_id', 'active_turn_id', 'state']) {
    assert.ok(source.components.schemas.AgentSession.required.includes(field));
  }
  // Existing owner bearer is used as-is; trace is never treated as authority.
  assert.ok(source.security || source.paths[interrupt].post.security);
});
