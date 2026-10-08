import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),check=args.includes('--check');
const consumers=args.filter(a=>a.startsWith('--consumer=')).map(a=>a.slice(11));assert.ok(consumers.length===1&&['desktop','agent-host'].includes(consumers[0]));assert.ok(args.every(a=>a==='--check'||a.startsWith('--consumer=')));
const consumer=consumers[0],read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
execFileSync(process.execPath,['scripts/generate-market-host.mjs','--check'],{cwd:root,stdio:'inherit'});
const lockPath='compatibility/market-host/source.lock.json',lock=JSON.parse(read(lockPath));assert.equal(lock.release,false);
for(const r of [...lock.sources,...lock.generated])assert.equal(hash(read(r.path)),r.sha256,r.path);
const pairs=consumer==='desktop'?[
 ['sdks/rust/market-host/types.gen.rs','src-tauri/src/chat/connectors/host_generated.rs'],
 ['sdks/rust/market-broker-control/types.gen.rs','src-tauri/src/chat/connectors/broker_generated.rs'],
 ['sdks/jsonschema/market-host.schema.json','contracts/market-host.schema.json'],
 ['sdks/typescript/src/domain/market-host-native.generated.ts','src/domain/market-host-native.generated.ts'],
 ['sdks/typescript/src/api/generated/market-host-native-validator.gen.js','src/api/generated/market-host-native-validator.gen.js'],
 ['sdks/typescript/src/api/generated/market-host-native-validator.gen.d.ts','src/api/generated/market-host-native-validator.gen.d.ts'],
 ['sdks/jsonschema/market-host-native.schema.json','contracts/market-host-native.schema.json'],
 ['compatibility/market-host/native-ipc.json','contracts/market-host.native-ipc.json'],
]:[
 ['sdks/go/market-host/types.gen.go','internal/contracts/markethost/types.gen.go'],
 ['sdks/jsonschema/market-host.schema.json','api/market-host.schema.json'],
];
const outputs=[];
for(const[source,dest]of pairs){let bytes=read(source);if(dest.endsWith('.go')){let text=bytes.toString();for(const[a,b]of [['market-connectors','marketconnectors'],['market-selection','marketselection'],['market-broker-control','marketbrokercontrol'],['market-provider','marketprovider'],['openapi/chat-models','chatmodels']])text=text.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/'+a,'github.com/36Dge/yijie-agent-host/internal/contracts/'+b);text=text.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/openapi/agent-host','github.com/36Dge/yijie-agent-host/internal/contracts');bytes=execFileSync('gofmt',[],{input:text});}if(dest.endsWith('/broker_generated.rs'))bytes=Buffer.from(bytes.toString().replaceAll('crate::generated::','super::generated::').replaceAll('crate::selection_generated::','super::selection_generated::'));outputs.push({source,dest,bytes});}
outputs.push({dest:(consumer==='desktop'?'contracts':'api')+'/market-host.candidate.json',bytes:Buffer.from(JSON.stringify({...lock,consumer,consumer_generated:outputs.map(v=>({source:v.source,path:v.dest,sha256:hash(v.bytes)}))},null,2)+'\n')});
for(const{dest,bytes}of outputs){const target=path.join(root,'..','yijie-'+consumer,dest);if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Market Host ${consumer} ${check?'checked':'synchronized'}; local candidate.`);
