import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {families} from '../scripts/generation-plan.mjs';
import {difference, publish, snapshot, withWorkspace} from '../scripts/generation-workspace.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all registered receipt outputs and existing public exports remain covered', async () => {
  const exports = JSON.parse(await readFile(path.join(root, 'scripts/sdk-exports.json')));
  const old = execFileSync('git', ['show', '61137174a25dc368e0006f27633fd4a9ad097aa6:sdks/typescript/src/index.ts'], {cwd: root, encoding: 'utf8'}).trim().split('\n').slice(1);
  for (const line of old) assert.ok(exports.includes(line), `Lost export: ${line}`);
  assert.equal(new Set(families.map(([f]) => f)).size, 23);
  const generated = new Map();
  for (const [family] of families) {
    const lock = JSON.parse(await readFile(path.join(root, `compatibility/${family}/source.lock.json`)));
    for (const file of lock.generated) {
      if (generated.has(file.path)) assert.equal(generated.get(file.path), file.sha256, `Conflicting output: ${file.path}`);
      generated.set(file.path, file.sha256);
      await readFile(path.join(root, file.path));
    }
  }
  assert.ok(generated.size > 100);
});

test('ordinary producer failure and stale comparison never write the checkout', async () => {
  const before = await snapshot(root);
  await assert.rejects(withWorkspace(root, async stage => {
    await writeFile(path.join(stage, 'sdks/typescript/src/index.ts'), '// ordinary temporary output\n');
    throw Error('ordinary generation error');
  }), /ordinary generation error/);
  assert.deepEqual(difference(before, await snapshot(root)), []);
  await withWorkspace(root, async (stage, original) => {
    await writeFile(path.join(stage, 'sdks/typescript/src/index.ts'), '// ordinary stale comparison\n');
    assert.deepEqual(difference(original, await snapshot(stage)), ['sdks/typescript/src/index.ts']);
  });
  assert.deepEqual(difference(before, await snapshot(root)), []);
});

test('publication rejects concurrent normal edits and accepts completed outputs', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'yijie-generation-test-'));
  try {
    for (const dir of ['scripts','openapi','jsonschema','protobuf','asyncapi','compatibility','sdks']) await mkdir(path.join(temp, dir));
    await writeFile(path.join(temp, 'sdks/example.txt'), 'before');
    const before = await snapshot(temp);
    const after = new Map(before); after.set('sdks/example.txt', Buffer.from('generated'));
    await writeFile(path.join(temp, 'sdks/example.txt'), 'concurrent edit');
    await assert.rejects(publish(temp, before, after), /changed concurrently/);
    assert.equal(await readFile(path.join(temp, 'sdks/example.txt'), 'utf8'), 'concurrent edit');
    const latest = await snapshot(temp);
    assert.deepEqual(await publish(temp, latest, after), ['sdks/example.txt']);
    assert.equal(await readFile(path.join(temp, 'sdks/example.txt'), 'utf8'), 'generated');
  } finally { await rm(temp, {recursive: true, force: true}); }
});

test('empty file additions/deletions are not hidden by the comparator', () => {
  const empty = new Map([['sdks/empty', Buffer.alloc(0)]]);
  assert.deepEqual(difference(empty, new Map()), ['sdks/empty']);
  assert.deepEqual(difference(new Map(), empty), ['sdks/empty']);
});
