import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const projection = JSON.parse(readFileSync('sdks/jsonschema/scheduled-task-recovery.schema.json'));
const draft = JSON.parse(readFileSync('jsonschema/scheduled-tasks/plan-draft-v1.schema.json'));
const source = JSON.parse(readFileSync('openapi/scheduled-task-recovery/scheduled-task-recovery.yaml'));
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv); ajv.addSchema(projection);
const validates = name => ajv.compile({ $ref: `${projection.$id}#/$defs/${name}` });
const id = '15500000-0000-4000-8000-000000000001';

test('accepted identifies an original turn; pending and uncertain never supply a turn', () => {
  const validate = validates('TurnOperationResult');
  for (const state of ['pending', 'uncertain', 'accepted']) {
    const value = { agent_session_id: id, operation_id: id, state };
    assert.equal(validate(value), state !== 'accepted');
    assert.equal(validate({ ...value, turn_id: id }), state === 'accepted');
  }
  assert.equal(validate({ agent_session_id: id, operation_id: id, state: 'completed' }), false);
});

test('reserved mapping, optional responder identity and minimal bounded payload', () => {
  const validate = validates('SessionMapping');
  const value = { task_id: id, agent_session_id: id, mapping_state: 'reserved' };
  assert.equal(validate(value), true);
  assert.equal(validate({ ...value, codex_thread_id: id }), false);
  assert.equal(validate({ ...value, mapping_state: 'bound' }), false);
  assert.equal(validate({ ...value, mapping_state: 'bound', codex_thread_id: id, responding_host_instance_id: id }), true);
  assert.equal(validate({ ...value, responding_host_instance_id: null }), false);
  for (const name of ['cwd', 'prompt', 'tenant_id', 'execution_generation']) assert.equal(validate({ ...value, [name]: 'ordinary-value' }), false);
});

test('query inputs require canonical nonzero IDs and preserve existing bearer boundary', () => {
  const validate = validates('CanonicalID');
  assert.equal(validate(id), true);
  for (const value of ['not-an-id', '00000000-0000-0000-0000-000000000000', '15500000-0000-4000-8000-00000000000A']) assert.equal(validate(value), false);
  assert.equal(Object.keys(source.paths).length, 2);
  assert.deepEqual(source.security, [{ localBearer: [] }]);
  for (const methods of Object.values(source.paths)) {
    assert.deepEqual(Object.keys(methods), ['get']);
    assert.ok(methods.get.parameters.every(parameter => parameter.in === 'path'));
    assert.equal(methods.get.requestBody, undefined);
  }
});

const candidate = { schema_version: 1, kind: 'candidate', name: '每日检查', content: '汇总用户提供的公开信息', schedule: { frequency: 'daily', local_time: '09:00', time_zone: 'Asia/Shanghai' }, target: { mode: 'dedicated_chat' } };
test('bounded draft distinguishes clarification from candidate and has no authority or save result', () => {
  const validate = ajv.compile(draft);
  assert.equal(validate(candidate), true);
  assert.equal(validate({ schema_version: 1, kind: 'needs_clarification', missing_fields: ['time_zone'], question: '使用哪个时区？' }), true);
  for (const field of ['name', 'content', 'schedule', 'target']) { const value = structuredClone(candidate); delete value[field]; assert.equal(validate(value), false); }
  for (const field of ['plan_id', 'grant_id', 'scope', 'cwd', 'saved']) assert.equal(validate({ ...candidate, [field]: 'ordinary-value' }), false);
  assert.equal(validate({ ...candidate, name: '界'.repeat(81) }), false);
  assert.equal(validate({ ...candidate, content: 'a'.repeat(10001) }), false);
});

test('draft calendar and target intent preserve three modes and native resolution', () => {
  const validate = ajv.compile(draft);
  for (const mode of ['dedicated_chat', 'new_chat_each_run', 'existing_chat']) {
    const value = { ...candidate, target: { mode } };
    assert.equal(validate(value), mode !== 'existing_chat');
    assert.equal(validate({ ...value, target: { mode, existing_chat_label: '选定聊天' } }), mode === 'existing_chat');
  }
  const weekly = { ...candidate, schedule: { ...candidate.schedule, frequency: 'weekly', weekdays: [1, 5] } };
  assert.equal(validate(weekly), true);
  assert.equal(validate({ ...weekly, schedule: { ...weekly.schedule, weekdays: [1, 1] } }), false);
  assert.equal(validate({ ...candidate, schedule: { ...candidate.schedule, local_time: '25:00' } }), false);
  assert.equal(validate({ ...candidate, schedule: { ...candidate.schedule, frequency: 'once' } }), false);
  assert.equal(validate({ ...candidate, schedule: { ...candidate.schedule, frequency: 'once', local_date: '2027-01-01' } }), true);
});
