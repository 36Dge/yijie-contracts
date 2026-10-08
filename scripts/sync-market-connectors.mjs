// Explicit FEAT-157 local development sync; never changes another family's pin.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const check=args.includes('--check');
const repos=args.filter(a=>a.startsWith('--consumer=')).map(a=>a.slice('--consumer='.length));
assert.ok(args.every(a=>a==='--check'||a.startsWith('--consumer=')));
assert.ok(repos.length===1 && ['desktop','connectors','agent-host'].includes(repos[0]),'Choose exactly one --consumer=desktop|connectors|agent-host');
execFileSync(process.execPath,['scripts/generate-market-connectors.mjs','--check'],{cwd:root,stdio:'inherit'});
const lockPath='compatibility/market-connectors/source.lock.json';
const lock=JSON.parse(readFileSync(path.join(root,lockPath)));
assert.equal(lock.mode,'local_worktree_candidate');assert.equal(lock.release,false);assert.ok(!Object.hasOwn(lock,'source_commit'));
for(const row of [...lock.sources,...lock.generated]){
 assert.ok(!path.isAbsolute(row.path)&&!row.path.split('/').some(p=>!p||p==='.'||p==='..'));
 assert.equal(createHash('sha256').update(readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,row.path);
}
const maps={
 desktop:[['sdks/rust/market-connectors/types.gen.rs','src-tauri/src/chat/connectors/generated.rs'],['sdks/typescript/src/domain/market-connectors.generated.ts','src/domain/market-connectors.generated.ts'],['sdks/typescript/src/api/generated/market-connectors-validator.gen.js','src/api/generated/market-connectors-validator.gen.js'],['sdks/typescript/src/api/generated/market-connectors-validator.gen.d.ts','src/api/generated/market-connectors-validator.gen.d.ts'],['sdks/jsonschema/market-connectors.schema.json','contracts/market-connectors.schema.json'],[lockPath,'contracts/market-connectors.candidate.json']],
 connectors:[['sdks/rust/market-connectors/types.gen.rs','worker/src/generated.rs'],['sdks/go/market-connectors/types.gen.go','internal/contracts/marketconnectors/types.gen.go'],['sdks/jsonschema/market-connectors.schema.json','api/market-connectors.schema.json'],[lockPath,'api/market-connectors.candidate.json']],
 'agent-host':[['sdks/go/market-connectors/types.gen.go','internal/contracts/marketconnectors/types.gen.go'],['sdks/jsonschema/market-connectors.schema.json','api/market-connectors.schema.json'],[lockPath,'api/market-connectors.candidate.json']],
};
for(const[source,dest]of maps[repos[0]]){const target=path.join(root,'..','yijie-'+repos[0],dest),bytes=readFileSync(path.join(root,source));if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Market connectors ${repos[0]} ${check?'checked':'synchronized'}; development hashes only, no immutable/release provenance claim.`);
