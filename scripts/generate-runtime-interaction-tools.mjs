// Canonical Runtime -> reviewed local projection. No Runtime protocol is invented here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fork=path.resolve(root,'../yijie-codex');
const family='compatibility/runtime-interaction-tools';
const check=process.argv.includes('--check'), sync=process.argv.includes('--sync');
assert(process.argv.slice(2).every(a=>['--check','--sync'].includes(a)));
const read=(base,p)=>readFileSync(path.join(base,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const current=JSON.parse(read(fork,'.yijie/build/interaction-tools-v1/current.json'));
assert.match(current.source_sha256,/^[a-f0-9]{64}$/);
assert.equal(current.artifact,current.source_sha256+'/aarch64-apple-darwin');
const inputs=['.yijie/patches/chat-models/0022-user-input-context-tools.patch','scripts/build-interaction-tools.sh','scripts/prepare-interaction-tools.py','scripts/write-interaction-tools-runtime-manifest.py'];
const sourceHash=createHash('sha256');
for(const p of inputs)sourceHash.update(p).update('\0').update(read(fork,p));
assert.equal(sourceHash.digest('hex'),current.source_sha256);
const artifact=path.join(fork,'.yijie/build/interaction-tools-v1',current.artifact);
const manifestBytes=read(artifact,'runtime-manifest.json'), manifest=JSON.parse(manifestBytes);
const previous=JSON.parse(read(root,'compatibility/runtime-native-tools/source.lock.json'));
assert.deepEqual(manifest.patches.slice(0,-1),previous.patches);
assert.equal(manifest.patches.at(-1).path,inputs[0]);
for(const p of manifest.patches)assert.equal(hash(read(fork,p.path)),p.sha256);
assert.equal(hash(read(artifact,'codex')),manifest.runtime.sha256);
assert.equal(read(artifact,'codex').length,manifest.runtime.sizeBytes);
assert.equal(manifest.appServer.experimentalApi,false);
const schemas=path.join(artifact,'generated-json-schema');
const files=readdirSync(schemas,{recursive:true}).filter(p=>p.endsWith('.json')).sort();
const tree=createHash('sha256');
for(const p of files){const n=Buffer.alloc(8);n.writeBigUInt64BE(BigInt(Buffer.byteLength(p)));tree.update(n).update(p).update(Buffer.from(hash(read(schemas,p)),'hex'));}
assert.equal(files.length,manifest.appServer.schemaFileCount);
assert.equal(tree.digest('hex'),manifest.appServer.schemaTreeSha256);
const config=read(artifact,'config.schema.json'), profile=read(root,family+'/profile.json');
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
for(const [format,max]of [['uint',Number.MAX_SAFE_INTEGER],['uint64',Number.MAX_SAFE_INTEGER],['uint32',0xffffffff],['uint16',0xffff]])ajv.addFormat(format,{type:'number',validate:n=>Number.isSafeInteger(n)&&n>=0&&n<=max});
const valid=ajv.compile(JSON.parse(config));assert(valid(JSON.parse(profile).native_config),JSON.stringify(valid.errors));
const nativeNames=['ToolRequestUserInputParams','ToolRequestUserInputResponse'];
const canonical=Object.fromEntries(nativeNames.map(n=>[n,JSON.parse(read(schemas,n+'.json'))]));
function openapi(value){
 if(Array.isArray(value))return value.map(openapi);
 if(!value||typeof value!=='object')return value;
 const out={};for(const[k,v]of Object.entries(value)){
  if(['$schema','definitions','title'].includes(k))continue;
  if(k==='$ref')out[k]=v.replace('#/definitions/','#/components/schemas/');
  else if(k==='type'&&Array.isArray(v)){assert(v.includes('null')&&v.length===2);out.type=v.find(t=>t!=='null');out.nullable=true;}
  else if(k==='format'&&v.startsWith('uint'))out[k]='int64';
  else out[k]=openapi(v);
 }return out;
}
const nativeDefs={};
for(const[n,s]of Object.entries(canonical)){nativeDefs[n]=openapi(s);Object.assign(nativeDefs,openapi(s.definitions));}
const nativeSpec={openapi:'3.0.3',info:{title:'Canonical native user input projection',version:'0.1.0'},paths:{},components:{schemas:nativeDefs}};
const sources=Object.fromEntries([...new Set([...manifest.patches.map(p=>p.path),...inputs])].sort().map(p=>[p,hash(read(fork,p))]));
const lock={schema_version:1,feature:'FEAT-169',mode:'local_worktree_candidate',release:false,
 runtime_source:{base_commit:execFileSync('git',['-C',fork,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources},
 upstream:manifest.upstream,runtime_artifact:manifest.runtime,runtime_manifest_sha256:hash(manifestBytes),runtime_schema:manifest.appServer,
 runtime_relative_path:'.yijie/build/interaction-tools-v1/'+current.artifact,patches:manifest.patches,config_schema_sha256:hash(config),profile_sha256:hash(profile),
 canonical_schemas:Object.fromEntries(nativeNames.map(n=>[n+'.json',hash(read(schemas,n+'.json'))])),
 generator_sha256:hash(readFileSync(fileURLToPath(import.meta.url)))};
const outputs=new Map([[family+'/source.lock.json',json(lock)],[family+'/types.openapi.json',json(nativeSpec)]]);
for(const n of nativeNames)outputs.set(family+'/'+n+'.json',read(schemas,n+'.json'));
// oapi-codegen consumes the mechanically projected canonical types.
const tmp=path.join(root,'.local/interaction-native.openapi.json');mkdirSync(path.dirname(tmp),{recursive:true});writeFileSync(tmp,json(nativeSpec));
const go=execFileSync('go',['tool','oapi-codegen','-generate','types,skip-prune','-package','runtimeinteraction',tmp],{cwd:root});
const constants=execFileSync('gofmt',{input:`// Generated from the canonical candidate. DO NOT EDIT.\npackage runtimeinteraction\nimport _ "embed"\nconst RuntimeManifestSHA256=${JSON.stringify(lock.runtime_manifest_sha256)}\nconst RuntimeBinarySHA256=${JSON.stringify(manifest.runtime.sha256)}\nconst RuntimeBinarySize int64=${manifest.runtime.sizeBytes}\nconst RuntimeSchemaTreeSHA256=${JSON.stringify(manifest.appServer.schemaTreeSha256)}\nconst RuntimeSchemaFileCount=${manifest.appServer.schemaFileCount}\nconst RuntimePatchManifest=${JSON.stringify(JSON.stringify(manifest.patches))}\n//go:embed profile.json\nvar Profile []byte\n`});
for(const dir of ['sdks/go/openapi/runtime-interaction-tools',...((sync||check)?['../yijie-agent-host/internal/contracts/runtimeinteraction']:[])]){
 outputs.set(dir+'/types.gen.go',go);outputs.set(dir+'/runtime.gen.go',constants);outputs.set(dir+'/profile.json',profile);
}
if(sync||check)outputs.set('../yijie-desktop/contracts/runtime-interaction-tools.candidate.json',json(lock));
for(const[p,b]of outputs){const target=path.resolve(root,p);if(check)assert.deepEqual(readFileSync(target),b,p);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,b);}}
console.log('Interaction Runtime projection '+(check?'verified':'generated')+'; local candidate only.');
