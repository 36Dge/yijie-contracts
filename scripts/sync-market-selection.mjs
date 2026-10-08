// Explicit local candidate sync; old source families/pins are unchanged.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
assert.ok(args.every(a=>a==='--check'||a==='--consumer=desktop'));
assert.equal(args.filter(a=>a==='--consumer=desktop').length,1);
execFileSync(process.execPath,['scripts/generate-market-selection.mjs','--check'],{cwd:root,stdio:'inherit'});
for(const generator of ['scripts/generate-market-connectors.mjs','scripts/generate-chat-models.mjs'])execFileSync(process.execPath,[generator,'--check'],{cwd:root,stdio:'inherit'});
const lockPath='compatibility/market-selection/source.lock.json',lock=JSON.parse(readFileSync(path.join(root,lockPath)));
assert.equal(lock.mode,'local_worktree_candidate');assert.equal(lock.release,false);
for(const row of [...lock.sources,...lock.generated])assert.equal(createHash('sha256').update(readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,row.path);
const pairs=[['sdks/rust/market-selection/types.gen.rs','src-tauri/src/chat/connectors/selection_generated.rs'],['sdks/typescript/src/domain/market-selection.generated.ts','src/domain/market-selection.generated.ts'],['sdks/typescript/src/api/generated/market-selection-validator.gen.js','src/api/generated/market-selection-validator.gen.js'],['sdks/typescript/src/api/generated/market-selection-validator.gen.d.ts','src/api/generated/market-selection-validator.gen.d.ts'],['sdks/jsonschema/market-selection.schema.json','contracts/market-selection.schema.json'],[lockPath,'contracts/market-selection.candidate.json']];
for(const[source,dest]of pairs){const target=path.join(root,'..','yijie-desktop',dest),bytes=readFileSync(path.join(root,source));if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Market selection Desktop ${check?'checked':'synchronized'}; no immutable/release provenance claim.`);
