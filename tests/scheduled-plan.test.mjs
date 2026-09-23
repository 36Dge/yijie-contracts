import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema = JSON.parse(readFileSync('sdks/jsonschema/scheduled-plan.schema.json'));
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
const validate = name => ajv.compile({ $ref: schema.$id+'#/$defs/'+name });
const id = '15500000-0000-4000-8000-000000000002';
const definition = { name: '每日检查', content: '汇总公开信息', rule: { frequency: 'daily', time_zone: 'Asia/Shanghai', local_time: '09:00' }, target: { mode: 'dedicated_chat' } };
test('save and revision fields remain paired, and no caller identity/grant is accepted', () => {
  const v = validate('SavePlanRequest'); const input = { request_id: id, definition };
  assert.equal(v(input), true); assert.equal(v({ ...input, plan_id: id }), false);
  assert.equal(v({ ...input, plan_id: id, expected_revision: 1 }), true);
  assert.equal(v({ ...input, plan_id: null, expected_revision: null }), false);
  for (const field of ['scope', 'tenant_id', 'authorization_ref', 'enabled']) assert.equal(v({ ...input, [field]: 'ordinary' }), false);
});
test('existing target requires local ID; managed targets cannot take a caller binding', () => {
  const v = validate('SavePlanRequest');
  for (const mode of ['dedicated_chat', 'new_chat_each_run', 'existing_chat']) {
    const value = { request_id: id, definition: { ...definition, target: { mode } } };
    assert.equal(v(value), mode !== 'existing_chat');
    assert.equal(v({ ...value, definition: { ...value.definition, target: { mode, conversation_id: id } } }), mode === 'existing_chat');
  }
});
test('time shape is projected from original draft, with no independent calendar schema', () => {
  const original = JSON.parse(readFileSync('jsonschema/scheduled-tasks/plan-draft-v1.schema.json'));
  const source = JSON.parse(readFileSync('jsonschema/scheduled-tasks/plan-storage-v1.schema.json'));
  assert.equal(source.$defs.TimeRule.$ref, original.$id+'#/oneOf/1/properties/schedule');
  assert.deepEqual(schema.$defs.TimeRule.properties, original.oneOf[1].properties.schedule.properties);
  const v = validate('TimeRule'); assert.equal(v(definition.rule), true);
  assert.equal(v({ ...definition.rule, frequency: 'once' }), false);
  assert.equal(v({ ...definition.rule, frequency: 'weekly', weekdays: [1, 1] }), false);
});
test('views allow missing target tombstones; preview instants and slots are paired', () => {
  const view = { plan_id:id,revision:2,schedule_epoch:1,definition:{...definition,target:{mode:'existing_chat'}},state:'paused',target_state:'missing',effective_from:1,rule_version:1,tzdb_version:'2025b' };
  assert.equal(validate('PlanView')(view), true);
  assert.equal(validate('PlanView')({ ...view, authorization_ref:id }), false);
  const preview = { skipped_slots:[],candidates_examined:0,rule_version:1,tzdb_version:'2025b' };
  assert.equal(validate('TimePreview')(preview), true);
  assert.equal(validate('TimePreview')({...preview,next_at:2}), false);
  assert.equal(validate('TimePreview')({...preview,next_at:2,logical_slot:'2026-09-18T09:00'}), true);
});
