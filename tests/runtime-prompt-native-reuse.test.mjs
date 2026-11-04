import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import Ajv from 'ajv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = name => readFileSync(path.join(root, name));

test('prompt adapters consume the pinned native config and Skill input schemas', () => {
  const lock = JSON.parse(load('compatibility/runtime-kimi-k31-pro/source.lock.json'));
  for (const filename of ['config.schema.json', 'turn-start.schema.json', 'config-batch-write.schema.json', 'config-write-response.schema.json']) {
    const target = `sdks/go/openapi/runtime-kimi-k31-pro/${filename}`;
    const record = lock.generated.find(entry => entry.path === target);
    assert.ok(record);
    assert.equal(createHash('sha256').update(load(target)).digest('hex'), record.sha256);
  }
  const config = JSON.parse(load('sdks/go/openapi/runtime-kimi-k31-pro/config.schema.json'));
  const ajv = new Ajv({strict: false, validateFormats: false});
  const validConfig = ajv.compile(config);
  assert.equal(validConfig({projects: {'/ordinary/workspace': {trust_level: 'trusted'}}, skills: {config: [{path: '/ordinary/skills/sample/SKILL.md', enabled: false}]}}), true);
  assert.equal(validConfig({skills: {config: [{path: '/ordinary/skills/sample/SKILL.md', enabled: 'false'}]}}), false);
  const turn = JSON.parse(load('sdks/go/openapi/runtime-kimi-k31-pro/turn-start.schema.json'));
  const validTurn = ajv.compile(turn);
  assert.equal(validTurn({threadId: 'ordinary-thread', input: [{type: 'text', text: 'Explain six times seven.'}, {type: 'skill', name: 'sample', path: '/ordinary/skills/sample/SKILL.md'}]}), true);
  assert.ok(lock.methods.includes('config/batchWrite'));
  const refresh = JSON.parse(load('sdks/go/openapi/runtime-kimi-k31-pro/config-batch-write.schema.json'));
  assert.equal(ajv.compile(refresh)({edits: [], reloadUserConfig: true}), true);
});
