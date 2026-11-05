import assert from 'node:assert/strict';
import {test} from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {loadMarketSelectionSource} from '../scripts/market-selection-v2-source.mjs';
import {loadMarketHostSource} from '../scripts/market-host-v2-source.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import YAML from 'yaml';

test('P1 text authority relocation retains previous text constraints and adds only optional skills', () => {
  const base = 'dfd9012954c716d360f702d6be3bdbdef75e0633';
  const previous = file => execFileSync('git', ['show', `${base}:${file}`], {encoding: 'utf8'});
  const oldText = JSON.parse(previous('jsonschema/chat/message.schema.json')).$defs.textContentBlock;
  const oldHost = YAML.parse(previous('openapi/agent-host/agent-host.yaml')).components.schemas.StartTurnV2TextBlock;
  const current = YAML.parse(readFileSync('openapi/agent-host/agent-host.yaml', 'utf8')).components.schemas.StartTurnV2TextBlock;
  // The conservative checker still flags the changed $ref. Prove the specific
  // known relocation without adding a global reference-change exception.
  for (const keyword of ['type', 'minLength', 'maxLength', 'pattern']) {
    assert.deepEqual(current.properties.text[keyword], oldText.properties.text[keyword]);
  }
  assert.deepEqual(current.required, oldText.required);
  assert.equal(current.additionalProperties, oldText.additionalProperties);
  assert.deepEqual(current.properties.type.enum, [oldText.properties.type.const]);
  assert.equal(current.properties.type.type, typeof oldText.properties.type.const);
  const existing = structuredClone(current);
  delete existing.properties.skills;
  assert.deepEqual(existing, oldHost); // includes the pre-existing UTF-8 bound
  assert.ok(current.properties.skills.$ref);
  assert.equal(current.required.includes('skills'), false);
});

test('Native and Host inputs preserve the same selected managed Skill identity', () => {
  const native = loadMarketSelectionSource();
  const host = loadMarketHostSource();
  const ajv = new Ajv({strict: false, allErrors: true});
  addFormats(ajv);
  ajv.addSchema(native.schema);
  ajv.addSchema(host.schema);
  const validNative = ajv.getSchema(native.schema.$id + '#/$defs/TextInput');
  const validHost = ajv.getSchema(host.schema.$id + '#/$defs/StartTurnV2TextBlock');
  const legacy = {type: 'text', text: 'Explain ordinary arithmetic.'};
  const selected = {...legacy, skills: [{id: 'ordinary-sample', version: '1.0.0'}]};
  for (const valid of [validNative, validHost]) {
    assert.ok(valid);
    assert.equal(valid(legacy), true);
    assert.equal(valid(selected), true);
    assert.equal(valid({...selected, type: 'image'}), false);
    assert.equal(valid({...selected, skills: []}), false);
    assert.equal(valid({...selected, skills: [{id: 'ordinary-sample'}]}), false);
    assert.equal(valid({...selected, skills: [{id: 'ordinary-sample', version: '1.0.0', path: '/ordinary/SKILL.md'}]}), false);
  }
});
