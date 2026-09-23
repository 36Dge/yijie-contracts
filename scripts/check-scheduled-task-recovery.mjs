import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(path.join(root, name));
const lockPath = 'compatibility/scheduled-task-recovery/source.lock.json';
const lock = JSON.parse(read(lockPath));
for (const file of [...lock.sources, ...lock.generated]) {
  assert.equal(createHash('sha256').update(read(file.path)).digest('hex'), file.sha256, `Digest drift: ${file.path}`);
}
const before = new Map([...lock.generated.map(file => file.path), lockPath].map(file => [file, read(file)]));
execFileSync(process.execPath, ['scripts/generate-scheduled-task-recovery.mjs', '--base-commit', lock.base_commit], { cwd: root, stdio: 'inherit' });
for (const [file, bytes] of before) assert.deepEqual(read(file), bytes, `Regeneration drift: ${file}`);
console.log('Verified scheduled recovery digests and deterministic generation.');

const schema = JSON.parse(read('sdks/jsonschema/scheduled-task-recovery.schema.json'));
const ajv = new Ajv2020({strict:true,allErrors:true}); addFormats(ajv); ajv.addSchema(schema);
for (const name of Object.keys(schema.$defs)) ajv.compile({$ref:schema.$id+'#/$defs/'+name});
ajv.compile(JSON.parse(read('jsonschema/scheduled-tasks/plan-draft-v1.schema.json')));
console.log('Strict scheduled-task-recovery schema lint passed.');
