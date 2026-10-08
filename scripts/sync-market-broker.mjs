// Explicit, digest-checked local candidate sync. No immutable release claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check'),consumers=args.filter(a=>a.startsWith('--consumer=')).map(a=>a.slice(11));
assert.ok(args.every(a=>a==='--check'||a.startsWith('--consumer=')));assert.ok(consumers.length===1&&['connectors','agent-host'].includes(consumers[0]));
execFileSync(process.execPath,['scripts/generate-market-broker.mjs','--check'],{cwd:root,stdio:'inherit'});
const consumer=consumers[0],hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(path.join(root,p)),lockPath='compatibility/market-broker-control/source.lock.json',lock=JSON.parse(read(lockPath));
assert.equal(lock.mode,'local_worktree_candidate');assert.equal(lock.release,false);
for(const r of [...lock.sources,...lock.generated])assert.equal(hash(read(r.path)),r.sha256,r.path);
const pairs=consumer==='connectors'?[
 ['sdks/rust/market-broker-control/types.gen.rs','worker/src/broker_generated.rs'],
 ['sdks/rust/market-selection/portable.gen.rs','worker/src/selection_generated.rs'],
 ['sdks/rust/market-connectors/types.gen.rs','worker/src/generated.rs'],
]:[
 ['sdks/go/market-broker-control/types.gen.go','internal/contracts/marketbrokercontrol/types.gen.go'],
 ['sdks/go/market-selection/snapshot.gen.go','internal/contracts/marketselection/snapshot.gen.go'],
 ['sdks/go/market-selection/digest.gen.go','internal/contracts/marketselection/digest.gen.go'],
 ['sdks/go/market-connectors/types.gen.go','internal/contracts/marketconnectors/types.gen.go'],
];
pairs.push(['sdks/jsonschema/market-broker-control.schema.json','api/market-broker-control.schema.json']);
const outputs=[];
for(const[source,dest]of pairs){let bytes=read(source);if(dest.endsWith('.go'))bytes=Buffer.from(bytes.toString().replaceAll('github.com/36Dge/yijie-contracts/sdks/go/market-connectors','github.com/36Dge/yijie-agent-host/internal/contracts/marketconnectors').replaceAll('github.com/36Dge/yijie-contracts/sdks/go/market-selection','github.com/36Dge/yijie-agent-host/internal/contracts/marketselection'));outputs.push({source,dest,bytes});}
const record={...lock,consumer,projection:'Go imports are mechanically rewritten to the consumer-local generated authority; Rust bytes unchanged',consumer_generated:outputs.map(v=>({source:v.source,path:v.dest,sha256:hash(v.bytes)}))};
outputs.push({dest:'api/market-broker-control.candidate.json',bytes:Buffer.from(JSON.stringify(record,null,2)+'\n')});
for(const{dest,bytes}of outputs){const target=path.join(root,'..','yijie-'+consumer,dest);if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Market Broker ${consumer} ${check?'checked':'synchronized'}; private local candidate only.`);
