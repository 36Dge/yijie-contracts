import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,openSync,closeSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [arg,...rest]=process.argv.slice(2),consumer=arg?.replace('--consumer=',''),check=rest.includes('--check');
// Explicit unpublished market call-surface development path. The default still proves
// every byte against an immutable commit; no worktree is labelled source_commit.
const localMarket=rest.includes('--local-market-candidate');
assert(['desktop','agent-host'].includes(consumer)&&rest.every(x=>x==='--check'||x==='--local-market-candidate'));
const read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
function formatGo(source) {
 const directory=mkdtempSync(path.join(tmpdir(),'yijie-call-surface-format-'));
 let input;
 try {
  const file=path.join(directory,'input.go');
  writeFileSync(file,source);
  input=openSync(file,'r');
  // A regular-file stdin has a finite EOF; retain the same canonical formatter.
  return execFileSync('gofmt',[],{stdio:[input,'pipe','pipe']});
 } finally {
  if(input!==undefined)closeSync(input);
  rmSync(directory,{recursive:true});
 }
}
if(localMarket)execFileSync(process.execPath,['scripts/generate-market-selection-v2.mjs','--check'],{cwd:root,stdio:'inherit'});
if(localMarket)execFileSync(process.execPath,['scripts/generate-market-host-v2.mjs','--check'],{cwd:root,stdio:'inherit'});
if(localMarket)execFileSync(process.execPath,['scripts/generate-experts-v2.mjs','--check'],{cwd:root,stdio:'inherit'});
for(const family of ['market-selection','market-host','experts']) {
 const f=family+'-v2',lockPath=`compatibility/${f}/source.lock.json`,lock=JSON.parse(read(lockPath));
 const destination=path.join(root,'..','yijie-'+consumer,consumer==='desktop'?'contracts':'api',f+'.candidate.json');
 const commit=localMarket?undefined:check?JSON.parse(readFileSync(destination)).source_commit:process.env.YIJIE_SCHEDULED_CONTRACTS_COMMIT;
 if(localMarket){assert.equal(lock.mode,'local_worktree_candidate');assert.equal(lock.release,false);}
 else{assert.match(commit??'',/^[a-f0-9]{40}$/);assert.deepEqual(read(lockPath),execFileSync('git',['show',commit+':'+lockPath],{cwd:root}));}
 for(const item of [...lock.sources,...lock.generated]){const bytes=read(item.path);assert.equal(hash(bytes),item.sha256);if(!localMarket)assert.deepEqual(bytes,execFileSync('git',['show',commit+':'+item.path],{cwd:root,maxBuffer:16*1024*1024}));}
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
 const outputs=pairs.map(([source,dest])=>{let bytes=read(source);if(dest.endsWith('.go')){let s=bytes.toString();for(const [a,b] of [['market-host-v2','markethost'],['market-selection','marketselection'],['market-broker-control','marketbrokercontrol'],['market-connectors','marketconnectors'],['market-provider','marketprovider'],['openapi/chat-models','chatmodels'],['openapi/agent-host','']])s=s.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/'+a,'github.com/36Dge/yijie-agent-host/internal/contracts'+(b?'/'+b:''));bytes=formatGo(s);}return {source,dest,bytes};});
 for(const o of outputs){const dest=path.join(root,'..','yijie-'+consumer,o.dest);if(check)assert.deepEqual(readFileSync(dest),o.bytes,dest);else{mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,o.bytes);}}
 const provenance=localMarket?{local_candidate:'market-p1',worktree_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}:{source_commit:commit};
 const bytes=Buffer.from(JSON.stringify({...lock,...provenance,consumer,consumer_generated:outputs.map(o=>({source:o.source,path:o.dest,sha256:hash(o.bytes)}))},null,2)+'\n');
 if(check)assert.deepEqual(readFileSync(destination),bytes);else writeFileSync(destination,bytes);
}
console.log('FEAT-164 v2 call surfaces '+consumer+' '+(check?'verified':'synchronized')+(localMarket?' from explicit unpublished market candidate.':' from immutable source.'));
