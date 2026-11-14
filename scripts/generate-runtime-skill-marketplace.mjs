// Project only canonical schemas produced by the FEAT-174 Runtime candidate.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),fork=path.join(root,'../yijie-codex');
const args=process.argv.slice(2),check=args.includes('--check'),sync=args.includes('--sync');
assert(args.every(x=>['--check','--sync'].includes(x)));
const read=(base,name)=>readFileSync(path.join(base,name));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const current=JSON.parse(read(fork,'.yijie/build/native-skill-marketplace-v1/current.json'));
assert.equal(current.artifact,current.source_sha256+'/aarch64-apple-darwin');
const relative='.yijie/build/native-skill-marketplace-v1/'+current.artifact,artifact=path.join(fork,relative);
const manifestBytes=read(artifact,'runtime-manifest.json'),manifest=JSON.parse(manifestBytes);
const previous=JSON.parse(read(root,'compatibility/runtime-documents/source.lock.json'));
assert.deepEqual(manifest.patches.slice(0,-1),previous.patches);
assert.equal(manifest.patches.at(-1).path,'.yijie/patches/chat-models/0025-native-skill-marketplace.patch');
const inputs=[...manifest.patches.map(p=>p.path),...['build-native-skill-marketplace.sh','prepare-native-skill-marketplace.py','write-native-skill-marketplace-runtime-manifest.py','prepare-answer-completion.py'].map(p=>'scripts/'+p)];
const inputHash=createHash('sha256');for(const p of inputs)inputHash.update(p).update('\0').update(read(fork,p));
assert.equal(inputHash.digest('hex'),current.source_sha256);
for(const p of manifest.patches)assert.equal(sha(read(fork,p.path)),p.sha256);
const binary=read(artifact,'codex');assert.equal(binary.length,manifest.runtime.sizeBytes);assert.equal(sha(binary),manifest.runtime.sha256);
const schemaRoot=path.join(artifact,'generated-json-schema');
const schemas=readdirSync(schemaRoot,{recursive:true}).filter(p=>p.endsWith('.json')).sort(),tree=createHash('sha256');
for(const p of schemas){const n=Buffer.alloc(8);n.writeBigUInt64BE(BigInt(Buffer.byteLength(p)));tree.update(n).update(p).update(Buffer.from(sha(read(schemaRoot,p)),'hex'));}
assert.equal(tree.digest('hex'),manifest.appServer.schemaTreeSha256);assert.equal(schemas.length,manifest.appServer.schemaFileCount);
const names=['PluginStateReadParams','PluginStateReadResponse','PluginRefreshParams','PluginRefreshResponse','PluginInstallParams','PluginInstallResponse','PluginUninstallParams','PluginUninstallResponse','PluginReadParams','PluginReadResponse','MarketplaceAddParams','MarketplaceAddResponse','ConfigReadParams','ConfigReadResponse','ConfigBatchWriteParams','ConfigWriteResponse','SkillsListParams','SkillsListResponse','ListMcpServerStatusParams','ListMcpServerStatusResponse'];
const outputs=new Map(),family='compatibility/runtime-skill-marketplace';
const definitions=new Map();
for(const name of names){const bytes=read(schemaRoot,'v2/'+name+'.json');outputs.set(family+'/'+name+'.json',bytes);if(name.startsWith('PluginState')||name.startsWith('PluginRefresh')||name==='PluginReadResponse'||name.startsWith('ListMcpServerStatus')){const s=JSON.parse(bytes);definitions.set(name,s);for(const[n,d]of Object.entries(s.definitions??{})){if(definitions.has(n))assert.deepEqual(definitions.get(n),d);else definitions.set(n,d);}}}
function type(s){
 if(s.$ref)return s.$ref.split('/').at(-1);
 if(s.anyOf){const real=s.anyOf.filter(x=>x.type!=='null');if(real.length===1)return '*'+type(real[0]);return 'json.RawMessage';}
 if(Array.isArray(s.type)){const t=s.type.filter(x=>x!=='null');if(t.length===1)return '*'+type({...s,type:t[0]});return 'json.RawMessage';}
 return ({string:'string',integer:'int64',number:'float64',boolean:'bool',object:'json.RawMessage'})[s.type]??(s.type==='array'?'[]'+type(s.items):'json.RawMessage');
}
let go='// Generated from canonical native Skill marketplace schemas. DO NOT EDIT.\npackage runtimeskillmarket\nimport "encoding/json"\ntype JSONValue = json.RawMessage\n';
for(const[name,s]of definitions){
 if(name==='JSONValue')continue;
 if(s.type!=='object'||!s.properties){go+=`type ${name} ${type(s)==='json.RawMessage'?'= ':''}${type(s)}\n`;continue;}
 go+=`type ${name} struct {\n`;
 for(const[field,shape]of Object.entries(s.properties)){
  const optional=!(s.required??[]).includes(field);let t=type(shape);if(optional&&!t.startsWith('*')&&!t.startsWith('[]'))t='*'+t;
  const identifier=field.replace(/^_+/,'');
  go+=`${identifier[0].toUpperCase()+identifier.slice(1)} ${t} \`json:"${field}${optional?',omitempty':''}"\`\n`;
 }
 go+='}\n';
}
go+=`const RuntimeManifestSHA256=${JSON.stringify(sha(manifestBytes))}\nconst RuntimeBinarySHA256=${JSON.stringify(manifest.runtime.sha256)}\nconst RuntimeBinarySize int64=${manifest.runtime.sizeBytes}\nconst RuntimeSchemaTreeSHA256=${JSON.stringify(manifest.appServer.schemaTreeSha256)}\nconst RuntimeSchemaFileCount=${manifest.appServer.schemaFileCount}\nconst RuntimePatchManifest=${JSON.stringify(JSON.stringify(manifest.patches))}\n`;
outputs.set('sdks/go/openapi/runtime-skill-marketplace/runtime.gen.go',execFileSync('gofmt',[],{input:go}));
let embed='// Generated native schema resources. DO NOT EDIT.\npackage runtimeskillmarket\nimport _ "embed"\n';
for(const name of names)embed+=`//go:embed ${name}.json\nvar ${name}Schema []byte\n`;
outputs.set('sdks/go/openapi/runtime-skill-marketplace/schema.gen.go',execFileSync('gofmt',[],{input:embed}));
for(const name of names)outputs.set('sdks/go/openapi/runtime-skill-marketplace/'+name+'.json',read(schemaRoot,'v2/'+name+'.json'));
const configSchema=read(artifact,'config.schema.json');const config=JSON.parse(configSchema);for(const k of ['plugin_marketplace_mode','plugin_refresh_mode','plugin_allowed_local_roots'])assert(config.properties[k]);
outputs.set(family+'/config.schema.json',configSchema);
const lock={schema_version:1,feature:'FEAT-174',mode:'local_worktree_candidate',release:false,runtime_source:{base_commit:execFileSync('git',['-C',fork,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(inputs.map(p=>[p,sha(read(fork,p))]))},upstream:manifest.upstream,runtime_artifact:manifest.runtime,runtime_manifest_sha256:sha(manifestBytes),runtime_schema:manifest.appServer,runtime_relative_path:relative,patches:manifest.patches,config_schema_sha256:sha(configSchema),generator_sha256:sha(readFileSync(fileURLToPath(import.meta.url)))};
outputs.set(family+'/source.lock.json',json(lock));
function put(p,b){if(check)assert.deepEqual(readFileSync(p),Buffer.from(b),p);else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,b);}}
for(const[p,b]of outputs)put(path.join(root,p),b);
if(sync||check){
 for(const[p,b]of outputs)if(p.startsWith('sdks/go/openapi/runtime-skill-marketplace/'))put(path.join(root,'../yijie-agent-host/internal/contracts/runtimeskillmarket',path.basename(p)),b);
 put(path.join(root,'../yijie-agent-host/api/runtime-skill-marketplace.candidate.json'),json(lock));
 put(path.join(root,'../yijie-desktop/contracts/runtime-skill-marketplace.candidate.json'),json(lock));
}
console.log('FEAT-174 canonical Runtime projection '+(check?'verified':'generated')+'.');
