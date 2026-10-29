// Explicit source-first development projection. Does not mint immutable pins.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
const consumer=args.find(v=>v.startsWith('--consumer='))?.slice(11);
assert(['desktop','agent-host'].includes(consumer));
assert(args.every(v=>v==='--local-candidate'||v==='--check'||v==='--consumer='+consumer));
assert(args.includes('--local-candidate'),'Explicit local candidate acknowledgement is required');
const read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
for(const family of ['market-broker','market-host-v2','web-retrieval'])execFileSync(process.execPath,['scripts/generate-'+family+'.mjs','--check'],{cwd:root,stdio:'inherit'});
const locks=['market-broker-control','market-host-v2','web-retrieval'].map(family=>{
 const lock=JSON.parse(read('compatibility/'+family+'/source.lock.json'));
 assert.equal(lock.release,false);
 for(const r of [...lock.sources,...lock.generated])assert.equal(hash(read(r.path)),r.sha256,r.path);
 return {family,lock};
});
const pairs=consumer==='agent-host'?[
 ['sdks/go/market-host-v2/types.gen.go','internal/contracts/markethost/types.gen.go'],
 ['sdks/jsonschema/market-host-v2.schema.json','api/market-host-v2.schema.json'],
]:[
 ['sdks/rust/market-host-v2/types.gen.rs','src-tauri/src/chat/connectors/host_v2_generated.rs'],
 ['sdks/rust/market-broker-control/types.gen.rs','src-tauri/src/chat/connectors/broker_generated.rs'],
 ['sdks/jsonschema/market-host-v2.schema.json','contracts/market-host-v2.schema.json'],
 ['sdks/jsonschema/market-host-v2-native.schema.json','contracts/market-host-v2-native.schema.json'],
 ['sdks/typescript/src/domain/market-host-v2-native.generated.ts','src/domain/market-host-v2-native.generated.ts'],
 ['sdks/typescript/src/api/generated/market-host-v2-native-validator.gen.js','src/api/generated/market-host-v2-native-validator.gen.js'],
 ['sdks/typescript/src/api/generated/market-host-v2-native-validator.gen.d.ts','src/api/generated/market-host-v2-native-validator.gen.d.ts'],
 ['sdks/typescript/src/domain/web-retrieval.generated.ts','src/domain/web-retrieval.generated.ts'],
 ['sdks/typescript/src/api/generated/web-retrieval-validator.gen.js','src/api/generated/web-retrieval-validator.gen.js'],
 ['sdks/typescript/src/api/generated/web-retrieval-validator.gen.d.ts','src/api/generated/web-retrieval-validator.gen.d.ts'],
];
const outputs=pairs.map(([source,dest])=>{
 let bytes=read(source);
 if(dest.endsWith('.go')){
  let s=bytes.toString();
  for(const[a,b]of [['market-host-v2','markethost'],['market-selection','marketselection'],['market-broker-control','marketbrokercontrol'],['market-connectors','marketconnectors'],['market-provider','marketprovider'],['openapi/chat-models','chatmodels'],['openapi/agent-host','']])s=s.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/'+a,'github.com/36Dge/yijie-agent-host/internal/contracts'+(b?'/'+b:''));
  bytes=execFileSync('gofmt',[],{input:s});
 }
 if(dest.endsWith('/broker_generated.rs'))bytes=Buffer.from(bytes.toString().replaceAll('crate::generated::','super::generated::').replaceAll('crate::selection_generated::','super::selection_generated::'));
 return {source,dest,bytes};
});
const receipt={feature:'FEAT-162',mode:'local_worktree_candidate',release:false,source_commit:null,base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),consumer,activation_qualified:false,synchronizer_sha256:hash(read('scripts/sync-feat162-local.mjs')),authorities:locks,consumer_generated:outputs.map(o=>({source:o.source,path:o.dest,sha256:hash(o.bytes)}))};
outputs.push({dest:(consumer==='desktop'?'contracts':'api')+'/feat162.local-candidate.json',bytes:Buffer.from(JSON.stringify(receipt,null,2)+'\n')});
// Existing immutable candidate receipts are deliberately untouched. Normal
// activation checks will reject changed source until separately pinned/approved.
for(const{dest,bytes}of outputs){const target=path.join(root,'..','yijie-'+consumer,dest);if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`FEAT-162 ${consumer} local candidate ${check?'checked':'synchronized'}; not activation qualified.`);
