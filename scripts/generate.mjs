// Canonical full generation: stage, compare, then publish completed outputs.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {artifactFamilies, families, focused} from './generation-plan.mjs';
import {difference, outputFile, publish, snapshot, withWorkspace} from './generation-workspace.mjs';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.ok(args.every(arg => focused.has(arg) || ['--check', '--skip-skill-fixture-generation'].includes(arg)), 'Unknown generation option');
const focus = args.filter(arg => focused.has(arg));
assert.ok(focus.length <= 1, 'Choose one focused family');
const check = args.includes('--check');
// SDK generation never invokes archive/attack fixture production. That remains
// a separate historical command, outside this normal generation entrypoint.
await withWorkspace(root, async (stage, before) => {
  const run = async scriptArgs => {
    try {
      const result = await exec(process.execPath, scriptArgs, {cwd: stage, env: {...process.env, GOPROXY: 'off', pnpm_config_verify_deps_before_run: 'false', npm_config_offline: 'true', npm_config_update_notifier: 'false'}, maxBuffer: 32 * 1024 * 1024});
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    } catch (error) {
      if (error.stdout) process.stdout.write(error.stdout);
      if (error.stderr) process.stderr.write(error.stderr);
      throw Error(`Generation failed: ${scriptArgs.join(' ')}`, {cause: error});
    }
  };
  const locks = (await readdir(path.join(stage, 'compatibility'), {withFileTypes:true})).filter(e => e.isDirectory());
  const registered = new Set(families.map(([family]) => family));
  for (const entry of locks) {
    try { await readFile(path.join(stage, 'compatibility', entry.name, 'source.lock.json')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.ok(registered.has(entry.name), `Unregistered generation family: ${entry.name}`);
  }
  if (focus[0] !== '--workflow-local-only') await run(['scripts/generate-core.mjs', ...focus]);
  const selected = !focus.length ? families : focus[0] === '--workflow-local-only'
    ? families.filter(([f]) => f === 'workflow-local') : focus[0] === '--artifact-files-only'
    ? families.filter(([f]) => artifactFamilies.has(f)) : [];
  for (const [family, generator, mode] of selected) {
    const leafArgs = [`scripts/generate-${generator}.mjs`];
    if (mode === 'base') {
      const lock = JSON.parse(await readFile(path.join(stage, `compatibility/${family}/source.lock.json`)));
      leafArgs.push('--base-commit', lock.base_commit);
    }
    await run(leafArgs);
  }
  if (!focus.length) await run(['scripts/generate-native-process.mjs']);
  const after = await snapshot(stage);
  const changed = difference(before, after);
  assert.ok(changed.every(outputFile), `Source mutation by generator: ${changed.filter(f => !outputFile(f))}`);
  // A stale check is read-only, including ordinary generator failure.
  assert.deepEqual(difference(before, await snapshot(root)), [], 'Worktree changed during generation; rerun');
  if (check) assert.deepEqual(changed, [], `Generated SDK files are stale:\n${changed.join('\n')}`);
  else await publish(root, before, after);
  console.log(`${check ? 'Verified' : 'Generated'} ${selected.length} registered families plus selected core/native SDKs; ${changed.length} updated files; no fixture generation.`);
});
