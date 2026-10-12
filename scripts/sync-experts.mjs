import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),check=args.includes('--check');
const consumers=args.filter(a=>a.startsWith('--consumer=')).map(a=>a.slice(11));
assert.ok(consumers.length===1&&['desktop','agent-host','skills'].includes(consumers[0]));
assert.ok(args.every(a=>a==='--check'||a.startsWith('--consumer=')));
const consumer=consumers[0],read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
execFileSync(process.execPath,['scripts/generate-experts.mjs','--check'],{cwd:root,stdio:'inherit'});
const lock=JSON.parse(read('compatibility/experts/source.lock.json'));assert.equal(lock.release,false);
for(const r of [...lock.sources,...lock.generated])assert.equal(hash(read(r.path)),r.sha256,r.path);
const pairs=consumer==='desktop'?[
 ['sdks/rust/experts/types.gen.rs','src-tauri/src/chat/experts/generated.rs'],
 ['sdks/jsonschema/experts.schema.json','contracts/experts.schema.json'],
 ['sdks/jsonschema/experts-native.schema.json','contracts/experts-native.schema.json'],
 ['sdks/typescript/src/domain/experts.generated.ts','src/domain/experts.generated.ts'],
 ['sdks/typescript/src/api/generated/experts-validator.gen.js','src/api/generated/experts-validator.gen.js'],
 ['sdks/typescript/src/api/generated/experts-validator.gen.d.ts','src/api/generated/experts-validator.gen.d.ts'],
 ['compatibility/experts/native-ipc.json','contracts/experts.native-ipc.json'],
]:consumer==='agent-host'?[
 ['sdks/go/experts/types.gen.go','internal/contracts/experts/types.gen.go'],
 ['sdks/go/experts/bundle_schemas.gen.go','internal/contracts/experts/bundle_schemas.gen.go'],
 ['sdks/jsonschema/experts.schema.json','api/experts.schema.json'],
 ['jsonschema/skills/skill-bundle-manifest-v3.schema.json','api/jsonschema/skill-bundle-manifest-v3.schema.json'],
 ['jsonschema/skills/skill-bundle-manifest-v2.schema.json','api/jsonschema/skill-bundle-manifest-v2.schema.json'],
 ['compatibility/experts/transport.json','api/experts.transport.json'],
]:[
 ['jsonschema/skills/skill-bundle-manifest-v3.schema.json','contracts/skill-bundle-manifest-v3.schema.json'],
 ['jsonschema/skills/skill-bundle-manifest-v2.schema.json','contracts/skill-bundle-manifest-v2.schema.json'],
 ['sdks/javascript/experts/canonical.gen.mjs','contracts/experts-canonical.gen.mjs'],
];
const outputs=pairs.map(([source,dest])=>{let bytes=read(source);if(dest.endsWith('.go')){let text=bytes.toString();for(const[a,b]of [['market-broker-control','marketbrokercontrol'],['market-selection','marketselection'],['market-host','markethost']])text=text.replaceAll('github.com/36Dge/yijie-contracts/sdks/go/'+a,'github.com/36Dge/yijie-agent-host/internal/contracts/'+b);bytes=execFileSync('gofmt',[],{input:text});}return{source,dest,bytes};});
outputs.push({dest:(consumer==='agent-host'?'api':'contracts')+'/experts.candidate.json',bytes:Buffer.from(JSON.stringify({...lock,consumer,consumer_generated:outputs.map(v=>({source:v.source,path:v.dest,sha256:hash(v.bytes)}))},null,2)+'\n')});
for(const{dest,bytes}of outputs){const f=path.join(root,'..','yijie-'+consumer,dest);if(check)assert.deepEqual(readFileSync(f),bytes,f);else{mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,bytes);}}
console.log(`Experts ${consumer} ${check?'checked':'synchronized'}; local candidate, not release provenance.`);
