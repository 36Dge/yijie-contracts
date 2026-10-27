// Explicit FEAT-162 sync for the only typed consumer: the Connectors worker.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './web-retrieval-source.mjs';
const args=process.argv.slice(2),check=args.includes('--check');
assert.equal(args.filter(a=>a==='--consumer=connectors').length,1);
assert.ok(args.every(a=>a==='--consumer=connectors'||a==='--check'));
execFileSync(process.execPath,['scripts/generate-web-retrieval.mjs','--check'],{cwd:root,stdio:'inherit'});
const read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
const lock=JSON.parse(read('compatibility/web-retrieval/source.lock.json'));
assert.equal(lock.mode,'local_worktree_candidate');assert.equal(lock.release,false);
for(const row of [...lock.sources,...lock.generated])assert.equal(hash(read(row.path)),row.sha256,row.path);
const pairs=[['sdks/rust/web-retrieval/types.gen.rs','worker/src/web_retrieval_generated.rs'],['sdks/jsonschema/web-retrieval.schema.json','api/web-retrieval.schema.json'],['sdks/jsonschema/web-retrieval.tools.json','api/web-retrieval.tools.json']];
const outputs=pairs.map(([source,dest])=>({source,dest,bytes:read(source)}));
outputs.push({dest:'api/web-retrieval.candidate.json',bytes:Buffer.from(JSON.stringify({...lock,consumer:'connectors',consumer_generated:outputs.map(v=>({source:v.source,path:v.dest,sha256:hash(v.bytes)}))},null,2)+'\n')});
for(const{dest,bytes}of outputs){const target=path.join(root,'..','yijie-connectors',dest);if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Web retrieval Connectors ${check?'checked':'synchronized'}; local candidate only.`);
