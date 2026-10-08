import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),check=args.includes('--check');
const consumers=args.filter(a=>a.startsWith('--consumer=')).map(a=>a.slice(11));assert.ok(consumers.length===1&&['desktop','agent-host','connectors'].includes(consumers[0]));assert.ok(args.every(a=>a==='--check'||a.startsWith('--consumer=')));
const consumer=consumers[0],read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
execFileSync(process.execPath,['scripts/generate-market-provider.mjs','--check'],{cwd:root,stdio:'inherit'});
const lockPath='compatibility/market-provider/source.lock.json',lock=JSON.parse(read(lockPath));assert.equal(lock.release,false);for(const r of [...lock.sources,...lock.generated])assert.equal(hash(read(r.path)),r.sha256,r.path);
const pairs=consumer==='desktop'?[
 ['sdks/rust/market-provider/types.gen.rs','src-tauri/src/chat/connectors/provider_generated.rs'],
 ['sdks/jsonschema/market-provider.schema.json','contracts/market-provider.schema.json'],
]:consumer==='connectors'?[
 ['sdks/rust/market-provider/types.gen.rs','worker/src/provider_generated.rs'],
 ['sdks/jsonschema/market-provider.schema.json','api/market-provider.schema.json'],
]:[
 ['sdks/go/market-provider/types.gen.go','internal/contracts/marketprovider/types.gen.go'],
 ['sdks/jsonschema/market-provider.schema.json','api/market-provider.schema.json'],
];
const outputs=[];
for(const[source,dest]of pairs){let bytes=read(source),text=bytes.toString();if(dest.endsWith('.go'))text=text.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/market-connectors','github.com/36Dge/yijie-agent-host/internal/contracts/marketconnectors').replaceAll('github.com/36Dge/yijie-contracts/sdks/go/market-broker-control','github.com/36Dge/yijie-agent-host/internal/contracts/marketbrokercontrol');if(consumer==='desktop'&&dest.endsWith('.rs'))text=text.replaceAll('crate::generated::','super::generated::').replaceAll('crate::broker_generated::','super::broker_generated::');bytes=Buffer.from(text);outputs.push({source,dest,bytes});}
outputs.push({dest:(consumer==='desktop'?'contracts':'api')+'/market-provider.candidate.json',bytes:Buffer.from(JSON.stringify({...lock,consumer,consumer_generated:outputs.map(v=>({source:v.source,path:v.dest,sha256:hash(v.bytes)}))},null,2)+'\n')});
for(const{dest,bytes}of outputs){const target=path.join(root,'..','yijie-'+consumer,dest);if(check)assert.deepEqual(readFileSync(target),bytes,target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log(`Market provider ${consumer} ${check?'checked':'synchronized'}; local candidate.`);
