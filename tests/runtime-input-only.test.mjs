import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';

const ajv = new Ajv({strict: true, allErrors: true});
ajv.addFormat('uint32', {type: 'number', validate: value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff});
const schema = JSON.parse(readFileSync(new URL('../sdks/jsonschema/runtime-input-only/response.schema.json', import.meta.url)));
const validate = ajv.compile(schema);
const policy = {version: 1, cwd: '/ordinary-fixture', fileReadRoots: [], fileWriteRoots: [], networkAccess: false, toolNames: [], instructionSources: [], extensionContributorsEnabled: false};

test('native input-only schema distinguishes actual restricted evidence and ordinary null', () => {
  assert.equal(validate({threadId: 'native-thread', policy}), true);
  assert.equal(validate({threadId: 'ordinary-thread', policy: null}), true);
});

test('native policy receipt is closed and does not default missing restrictions to safe', () => {
  for (const field of Object.keys(policy)) {
    const incomplete = {...policy}; delete incomplete[field];
    assert.equal(validate({threadId: 'native-thread', policy: incomplete}), false, field);
  }
  assert.equal(validate({threadId: 'native-thread', policy: {...policy, futureField: true}}), false);
  assert.equal(validate({threadId: 'native-thread', policy: {...policy, toolNames: null}}), false);
});

test('local candidate authority keeps experimental disabled and FEAT-137 retired', () => {
  const lock = JSON.parse(readFileSync(new URL('../compatibility/runtime-input-only/source.lock.json', import.meta.url)));
  assert.equal(lock.release, false);
  assert.equal(lock.experimental_api, false);
  assert.deepEqual(lock.methods, ['thread/inputOnlyPolicy/read']);
  const patches = lock.native_sources.filter(row => row.path.endsWith('.patch'));
  assert.equal(patches.length, 3);
  assert.equal(patches.some(row => row.path.includes('feat-137')), false);
});
