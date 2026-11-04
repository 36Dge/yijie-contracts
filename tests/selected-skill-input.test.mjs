import assert from 'node:assert/strict';
import {test} from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {loadMarketSelectionSource} from '../scripts/market-selection-v2-source.mjs';
import {loadMarketHostSource} from '../scripts/market-host-v2-source.mjs';

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
