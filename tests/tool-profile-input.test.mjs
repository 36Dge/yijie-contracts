import assert from 'node:assert/strict';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadMarketSelectionSource } from '../scripts/market-selection-v2-source.mjs';
import { loadMarketHostSource } from '../scripts/market-host-v2-source.mjs';

test('new-chat tool profile uses one closed authority and leaves old submissions valid', () => {
  const native = loadMarketSelectionSource();
  const host = loadMarketHostSource();
  assert.deepEqual(native.defs.ToolProfile, host.defs.ToolProfile);
  const ajv = new Ajv({ strict: false }); addFormats(ajv);
  ajv.addSchema(native.schema); ajv.addSchema(host.schema);
  const validate = ajv.getSchema(native.schema.$id + '#/$defs/SubmitPayload');
  const original = { operationId: '00000000-0000-4000-8000-000000000001', projectId: null,
    contentBlocks: [{ type: 'text', text: 'Explain ordinary arithmetic.' }],
    intent: { profileId: 'kimi-k3-1-pro-max-v1', expectedRevision: 0 }, selection: [] };
  assert.equal(validate(original), true);
  for (const toolProfile of ['full', 'light']) assert.equal(validate({ ...original, toolProfile }), true);
  for (const toolProfile of ['automatic', null, false, {}]) assert.equal(validate({ ...original, toolProfile }), false);
  const hostProfile = ajv.getSchema(host.schema.$id + '#/$defs/ToolProfile');
  assert.equal(hostProfile('light'), true);
  assert.equal(hostProfile('automatic'), false);
});
