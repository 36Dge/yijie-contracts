import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { projectSnapshot, sourceSnapshot } from '../scripts/prepare-breaking-inputs.mjs';

const entry = 'openapi/example/api.yaml';
const source = 'jsonschema/example.schema.json';
const id = 'https://schemas.yijie.ai/ordinary-example/v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function snapshot(maxLength = 20) {
  return new Map([
    [entry, Buffer.from(JSON.stringify({
      openapi: '3.1.0', info: { title: 'Ordinary local comparison', version: '1.0.0' },
      paths: { '/query': { post: {
        operationId: 'query',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: id + '#/$defs/Query' } } } },
        responses: { default: { description: 'Response', content: { 'application/json': { schema: { $ref: id + '#/$defs/Query' } } } } },
      } } },
    }))],
    [source, Buffer.from(JSON.stringify({
      $id: id, $defs: {
        Query: { type: 'object', properties: {
          query: { type: 'string', maxLength },
          // A property named default is a schema, not a default-value literal.
          default: { $ref: '#/$defs/Label' },
        }, required: ['query'], example: { $ref: 'ordinary-literal-value' } },
        Label: { type: 'string' },
      },
    }))],
  ]);
}
function temporary(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'yijie-offline-breaking-'));
  t.after(() => rmSync(root, { recursive: true }));
  return root;
}
test('source-local projection resolves default responses and preserves literal values and local ref identities', t => {
  const root = temporary(t), files = snapshot();
  const receipt = projectSnapshot(files, root, [entry]);
  const api = JSON.parse(readFileSync(path.join(root, entry)));
  const schema = JSON.parse(readFileSync(path.join(root, source)));
  const response = api.paths['/query'].post.responses.default;
  assert.equal(response.content['application/json'].schema.$ref, '../../jsonschema/example.schema.json#/$defs/Query');
  assert.equal(schema.$defs.Query.properties.default.$ref, '#/$defs/Label');
  assert.deepEqual(schema.$defs.Query.example, { $ref: 'ordinary-literal-value' });
  for (const file of receipt.files) assert.equal(file.source_sha256, hash(files.get(file.path)));
  assert.equal(receipt.files.length, 2);
});
test('baseline and current closures preserve their own distinct source bytes', t => {
  const root = temporary(t);
  const old = projectSnapshot(snapshot(20), path.join(root, 'base'), [entry]);
  const current = projectSnapshot(snapshot(10), path.join(root, 'current'), [entry]);
  assert.notEqual(old.files.find(f => f.path === source).source_sha256, current.files.find(f => f.path === source).source_sha256);
  assert.equal(JSON.parse(readFileSync(path.join(root, 'base', source))).$defs.Query.properties.query.maxLength, 20);
  assert.equal(JSON.parse(readFileSync(path.join(root, 'current', source))).$defs.Query.properties.query.maxLength, 10);
});
test('missing authority, missing pointer and ambiguous ID fail without a network fallback', t => {
  const root = temporary(t);
  const absent = snapshot(); absent.delete(source);
  assert.throws(() => projectSnapshot(absent, path.join(root, 'absent'), [entry]), /No local schema authority/);
  const missing = snapshot();
  const value = JSON.parse(missing.get(source)); delete value.$defs.Query;
  missing.set(source, Buffer.from(JSON.stringify(value)));
  assert.throws(() => projectSnapshot(missing, path.join(root, 'pointer'), [entry]), /Unresolved schema pointer/);
  const duplicate = snapshot(); duplicate.set('jsonschema/duplicate.schema.json', duplicate.get(source));
  assert.throws(() => projectSnapshot(duplicate, path.join(root, 'duplicate'), [entry]), /Ambiguous schema ID/);
});
test('pinned oasdiff accepts unchanged projection and fails ordinary request tightening', t => {
  const root = temporary(t);
  for (const [name, maximum] of [['old', 20], ['same', 20], ['changed', 10]]) {
    projectSnapshot(snapshot(maximum), path.join(root, name), [entry]);
  }
  const args = name => ['tool', 'oasdiff', 'breaking', '--fail-on', 'ERR', path.join(root, 'old', entry), path.join(root, name, entry)];
  const options = { encoding: 'utf8', env: { ...process.env, GOPROXY: 'off' } };
  const same = spawnSync('go', args('same'), options);
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /No changes detected/);
  const tightened = spawnSync('go', args('changed'), options);
  assert.equal(tightened.status, 1, tightened.stdout + tightened.stderr);
  assert.match(tightened.stdout + tightened.stderr, /max-length-decreased/);
});
test('historical snapshot reads its complete schema closure from the exact existing Git commit', () => {
  const base = '61137174a25dc368e0006f27633fd4a9ad097aa6';
  const files = sourceSnapshot(process.cwd(), base);
  const file = 'jsonschema/scheduled-tasks/draft-execution-v1.schema.json';
  assert.deepEqual(files.get(file), execFileSync('git', ['show', `${base}:${file}`]));
  assert.ok(files.has('openapi/scheduled-plan-draft/scheduled-plan-draft.yaml'));
});
