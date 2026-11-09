// FEAT-171 focused entry. Preserve the common generator's existing immutable
// native-family pins; use its same staging and atomic publication primitives.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {families} from './generation-plan.mjs';
import {difference, outputFile, publish, snapshot, withWorkspace} from './generation-workspace.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert(process.argv.slice(2).every(arg=>arg==='--check'));
const check=process.argv.includes('--check');
await withWorkspace(root,async(stage,before)=>{
 const selected=families.filter(([name])=>['runtime-documents','document-runtime'].includes(name));
 assert.equal(selected.length,2);
 for(const [,generator] of selected) execFileSync(process.execPath,[`scripts/generate-${generator}.mjs`],{cwd:stage,stdio:'inherit'});
 const after=await snapshot(stage),changed=difference(before,after);
 assert(changed.every(outputFile),'Document generator must only publish generated outputs');
 assert.deepEqual(difference(before,await snapshot(root)),[],'Source changed during generation');
 if(check) assert.deepEqual(changed,[],'Document generation drift');
 else await publish(root,before,after);
 console.log(`${check?'Verified':'Generated'} both document families; ${changed.length} updated files; no other families or fixtures executed.`);
});
