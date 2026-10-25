import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [arg,...rest]=process.argv.slice(2),consumer=arg?.replace('--consumer=',''),check=rest.includes('--check');
assert(['desktop','agent-host'].includes(consumer)&&rest.every(x=>x==='--check'));
const read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
for(const family of ['market-selection','market-host','experts']) {
 const f=family+'-v2',lockPath=`compatibility/${f}/source.lock.json`,lock=JSON.parse(read(lockPath));
 const destination=path.join(root,'..','yijie-'+consumer,consumer==='desktop'?'contracts':'api',f+'.candidate.json');
 const commit=check?JSON.parse(readFileSync(destination)).source_commit:process.env.YIJIE_SCHEDULED_CONTRACTS_COMMIT;
 assert.match(commit??'',/^[a-f0-9]{40}$/);assert.deepEqual(read(lockPath),execFileSync('git',['show',commit+':'+lockPath],{cwd:root}));
 for(const item of [...lock.sources,...lock.generated]){const bytes=read(item.path);assert.equal(hash(bytes),item.sha256);assert.deepEqual(bytes,execFileSync('git',['show',commit+':'+item.path],{cwd:root,maxBuffer:16*1024*1024}));}
 const pairs=[];
 if(consumer==='desktop') {
  const module=family==='experts'?'experts/generated_v2.rs':`connectors/${family==='market-host'?'host':'selection'}_v2_generated.rs`;
  pairs.push([`sdks/rust/${f}/types.gen.rs`,'src-tauri/src/chat/'+module]);
  for(const item of lock.generated) {
   if(item.path.startsWith('sdks/typescript/src/'))pairs.push([item.path,item.path.replace('sdks/typescript/src/','src/')]);
   if(item.path.startsWith('sdks/jsonschema/'))pairs.push([item.path,item.path.replace('sdks/jsonschema/','contracts/')]);
  }
 }else if(family!=='market-selection'){
  pairs.push([`sdks/go/${f}/types.gen.go`,`internal/contracts/${family==='market-host'?'markethost':'experts'}/types.gen.go`]);
  pairs.push([`sdks/jsonschema/${f}.schema.json`,`api/${f}.schema.json`]);
 }
 const outputs=pairs.map(([source,dest])=>{let bytes=read(source);if(dest.endsWith('.go')){let s=bytes.toString();for(const [a,b] of [['market-host-v2','markethost'],['market-selection','marketselection'],['market-broker-control','marketbrokercontrol'],['market-connectors','marketconnectors'],['market-provider','marketprovider'],['openapi/chat-models','chatmodels'],['openapi/agent-host','']])s=s.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/'+a,'github.com/36Dge/yijie-agent-host/internal/contracts'+(b?'/'+b:''));bytes=execFileSync('gofmt',[],{input:s});}return {source,dest,bytes};});
 for(const o of outputs){const dest=path.join(root,'..','yijie-'+consumer,o.dest);if(check)assert.deepEqual(readFileSync(dest),o.bytes,dest);else{mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,o.bytes);}}
 const bytes=Buffer.from(JSON.stringify({...lock,source_commit:commit,consumer,consumer_generated:outputs.map(o=>({source:o.source,path:o.dest,sha256:hash(o.bytes)}))},null,2)+'\n');
 if(check)assert.deepEqual(readFileSync(destination),bytes);else writeFileSync(destination,bytes);
}
console.log('FEAT-164 v2 call surfaces '+consumer+' '+(check?'verified':'synchronized')+' from immutable source.');
