import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

const sourceDirs = ['scripts', 'openapi', 'jsonschema', 'protobuf', 'asyncapi', 'compatibility'];
const sourceFiles = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'go.mod', 'go.sum', 'buf.yaml', 'buf.gen.yaml', 'openapi-typescript.redocly.yaml', 'redocly.yaml', 'tsconfig.json'];
export const outputFile = file => file.startsWith('sdks/') || /^compatibility\/[^/]+\/source\.lock\.json$/.test(file);
const excluded = new Set(['node_modules', 'target', 'dist', '.git', 'fixtures']);
async function filesUnder(root, dir) {
  const files = [];
  for (const entry of await readdir(path.join(root, dir), {withFileTypes: true})) {
    if (excluded.has(entry.name)) continue;
    const name = path.posix.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink in generation inputs: ${name}`);
    if (entry.isDirectory()) files.push(...await filesUnder(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}
export async function snapshot(root) {
  const names = [...sourceFiles];
  for (const dir of [...sourceDirs, 'sdks']) names.push(...await filesUnder(root, dir));
  const result = new Map();
  for (const name of [...new Set(names)].sort()) {
    try { result.set(name, await readFile(path.join(root, name))); }
    catch (error) { if (error.code !== 'ENOENT' || !sourceFiles.includes(name)) throw error; }
  }
  return result;
}
export function difference(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])].filter(file =>
    before.has(file) !== after.has(file) || !before.get(file)?.equals(after.get(file))).sort();
}
export async function verifyDependencyPins(root) {
  const read = file => readFile(path.join(root, file), 'utf8');
  const manifest = JSON.parse(await read('package.json'));
  for (const [name, version] of Object.entries({...manifest.dependencies, ...manifest.devDependencies})) {
    const installed = JSON.parse(await read(`node_modules/${name}/package.json`));
    assert.equal(installed.version, version, `Installed generator dependency differs: ${name}`);
  }
  assert.deepEqual(YAML.parse(await read('node_modules/.pnpm/lock.yaml')), YAML.parse(await read('pnpm-lock.yaml')),
    'Installed dependency graph differs from the frozen lockfile; run an explicit canonical install');
}

export async function withWorkspace(root, action) {
  await verifyDependencyPins(root);
  const before = await snapshot(root);
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'yijie-generation-'));
  const stage = path.join(scratch, 'yijie-contracts');
  try {
    for (const [file, bytes] of before) {
      await mkdir(path.dirname(path.join(stage, file)), {recursive: true});
      await writeFile(path.join(stage, file), bytes);
    }
    await symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
    // Read-only provenance queries in leaf generators use the real repository.
    // This is NOT an immutable checkout or a source qualification receipt.
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {cwd: root, encoding: 'utf8'}).trim();
    await symlink(gitDir, path.join(stage, '.git'), 'dir');
    await symlink(path.resolve(root, '../yijie-codex'), path.join(scratch, 'yijie-codex'), 'dir');
    return await action(stage, before);
  } finally { await rm(scratch, {recursive: true, force: true}); }
}

// All producers finish before publication. Keep a recoverable journal through
// the short publication phase; normal I/O failures restore only our own writes.
export async function publish(root, before, after) {
  assert.deepEqual(difference(before, await snapshot(root)), [], 'Generation inputs/outputs changed concurrently; rerun');
  const changed = difference(before, after);
  assert.ok(changed.every(outputFile), `Generator changed a source: ${changed.filter(f => !outputFile(f))}`);
  assert.ok(changed.every(f => after.has(f)), 'Unexpected generated output deletion');
  if (!changed.length) return changed;
  const journal = await mkdtemp(path.join(root, '.generation-recovery-'));
  const written = [];
  try {
    for (const file of changed) {
      await mkdir(path.dirname(path.join(journal, file)), {recursive: true});
      if (before.has(file)) await writeFile(path.join(journal, file), before.get(file));
    }
    await writeFile(path.join(journal, 'manifest.json'), JSON.stringify(changed.map(file => ({file, existed: before.has(file), intended_sha256: createHash('sha256').update(after.get(file)).digest('hex')})), null, 2));
    for (const file of changed) {
      const target = path.join(root, file);
      let current; try { current = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      assert.ok(before.has(file) ? current?.equals(before.get(file)) : !current, `Concurrent output edit: ${file}`);
      await mkdir(path.dirname(target), {recursive: true});
      const temp = path.join(journal, 'next');
      await writeFile(temp, after.get(file));
      await rename(temp, target);
      written.push(file);
    }
    assert.deepEqual(difference(after, await snapshot(root)), [], "Concurrent edit during publication; restore our outputs");
  } catch (error) {
    for (const file of written.reverse()) {
      const target = path.join(root, file);
      assert.ok((await readFile(target)).equals(after.get(file)), `Concurrent edit; preserve recovery journal ${journal}`);
      if (before.has(file)) await cp(path.join(journal, file), target);
      else await rm(target);
    }
    await rm(journal, {recursive: true, force: true});
    throw error;
  }
  await rm(journal, {recursive: true, force: true});
  return changed;
}
