import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateContextWindowSnapshot } from '../sdks/typescript/src/context-window-validator.gen.js';
const id = '10000000-0000-4000-8000-000000000001';
const empty = { schema_version: 1, thread_id: id, model_profile: 'ordinary-model', model_revision: 1, sample: null, compactions: [] };
test('context snapshot preserves null, measured zero, effective capacity and native lifecycle', () => {
  assert(validateContextWindowSnapshot(empty));
  const sample = { used_tokens: 0, capacity_tokens: null, turn_id: 'turn', window_id: id, observed_at: '2026-11-08T12:00:00Z' };
  assert(validateContextWindowSnapshot({ ...empty, sample }));
  assert(validateContextWindowSnapshot({ ...empty, sample: { ...sample, used_tokens: 143000, capacity_tokens: 730000 }, compactions: [{ turn_id: 'turn', item_id: 'native-item', state: 'in_progress' }] }));
  assert(!validateContextWindowSnapshot({ ...empty, sample: { ...sample, capacity_tokens: 0 } }));
  assert(!validateContextWindowSnapshot({ ...empty, sample: { ...sample, used_tokens: undefined } }));
  assert(!validateContextWindowSnapshot({ ...empty, compactions: [{ turn_id: 'turn', item_id: 'native-item', state: 'future' }] }));
});
test('native TokenUsage schema is copied from the qualified Runtime without rewriting its fields', () => {
  const lock = JSON.parse(readFileSync('compatibility/context-window/source.lock.json'));
  const file = Object.keys(lock.sources).find(p => p.endsWith('/ThreadTokenUsageUpdatedNotification.json'));
  const bytes = readFileSync(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), lock.sources[file]);
  assert.deepEqual(JSON.parse(bytes), JSON.parse(readFileSync('sdks/jsonschema/context-window-native.schema.json')));
});
