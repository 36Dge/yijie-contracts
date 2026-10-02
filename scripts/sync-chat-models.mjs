import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(x=>x==='--check'));
execFileSync(process.execPath,['scripts/generate-chat-models.mjs','--check'],{cwd:root,stdio:'inherit'});
const lockPath='compatibility/chat-models/source.lock.json';
const lock=JSON.parse(readFileSync(path.join(root,lockPath)));
assert.equal(lock.release,false);assert.equal(lock.mode,'local_worktree_candidate');
// This explicit local-only family records working-tree digests, never invents
// an immutable candidate commit. Existing committed locks remain untouched.
for(const row of [...lock.sources,...lock.generated])assert.equal(createHash('sha256').update(readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,row.path);
const copies=[
 ['yijie-agent-host','sdks/go/openapi/chat-models/types.gen.go','internal/contracts/chatmodels/types.gen.go'],
 ['yijie-agent-host','sdks/jsonschema/chat-models.schema.json','internal/contracts/chatmodels/schema.json'],
 ['yijie-agent-host',lockPath,'api/chat-models.candidate.json'],
 ['yijie-desktop','sdks/rust/chat-models/types.gen.rs','src-tauri/src/chat/models_generated.rs'],
 ['yijie-desktop','sdks/typescript/src/jsonschema/chat-models.gen.ts','src/domain/chat-models.generated.ts'],
 ['yijie-desktop','sdks/jsonschema/chat-models.schema.json','contracts/chat-models.schema.json'],
 ['yijie-desktop',lockPath,'contracts/chat-models.candidate.json'],
];
for(const [repo,source,dest] of copies){const target=path.join(root,'..',repo,dest),b=readFileSync(path.join(root,source));if(check)assert.deepEqual(readFileSync(target),b,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,b);}}
console.log('Chat model local consumer projections '+(check?'verified':'synchronized')+'; no release/committed pin claim.');
