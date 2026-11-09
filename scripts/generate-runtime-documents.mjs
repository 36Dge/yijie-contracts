// FEAT-170 native source and canonical model schema own the tool protocol.
// This projection only selects a reviewed per-model capability and exact artifact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fork=path.resolve(root,'../yijie-codex');
const family='compatibility/runtime-documents';
const check=process.argv.includes('--check'),sync=process.argv.includes('--sync');
assert(process.argv.slice(2).every(v=>['--check','--sync'].includes(v)));
const read=(base,name)=>readFileSync(path.join(base,name));
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const current=JSON.parse(read(fork,'.yijie/build/document-runtime-v1/current.json'));
assert.equal(current.schema_version,1);
assert.match(current.source_sha256,/^[a-f0-9]{64}$/);
assert.equal(current.artifact,current.source_sha256+'/aarch64-apple-darwin');
const artifact=path.join(fork,'.yijie/build/document-runtime-v1',current.artifact);
const manifestBytes=read(artifact,'runtime-manifest.json'),manifest=JSON.parse(manifestBytes);
const previous=JSON.parse(read(root,'compatibility/runtime-tool-search/source.lock.json'));
assert.deepEqual(manifest.patches.slice(0,-1),previous.patches);
assert.equal(manifest.patches.at(-1).path,'.yijie/patches/chat-models/0024-cooperative-exec-shutdown.patch');
const inputs=[...manifest.patches.map(v=>v.path),...['build-document-runtime.sh','prepare-document-runtime.py','write-document-runtime-manifest.py','prepare-answer-completion.py'].map(v=>'scripts/'+v)];
const inputHash=createHash('sha256');
for(const name of inputs)inputHash.update(name).update('\0').update(read(fork,name));
assert.equal(inputHash.digest('hex'),current.source_sha256,'Runtime source changed');
for(const p of manifest.patches)assert.equal(sha(read(fork,p.path)),p.sha256);
const binary=read(artifact,'codex');assert.equal(binary.length,manifest.runtime.sizeBytes);assert.equal(sha(binary),manifest.runtime.sha256);
assert.equal(manifest.appServer.experimentalApi,false);
assert.equal(manifest.appServer.transport,'stdio');
assert.equal(manifest.appServer.schemaTreeSha256,previous.runtime_schema.schemaTreeSha256,'Unexpected app-server wire change');
const schemaDir=path.join(artifact,'generated-json-schema');
const schemas=readdirSync(schemaDir,{recursive:true}).filter(p=>p.endsWith('.json')).sort();
const tree=createHash('sha256');for(const p of schemas){const size=Buffer.alloc(8);size.writeBigUInt64BE(BigInt(Buffer.byteLength(p)));tree.update(size).update(p).update(Buffer.from(sha(read(schemaDir,p)),'hex'));}
assert.equal(schemas.length,manifest.appServer.schemaFileCount);assert.equal(tree.digest('hex'),manifest.appServer.schemaTreeSha256);
const profileBytes=read(root,family+'/profile.json'),profile=JSON.parse(profileBytes);
assert.equal(profile.feature,'FEAT-171');assert.equal(profile.release,false);
assert.deepEqual(profile.native_config,{exec_shutdown_policy:'cooperative_only',features:{unified_exec:true}});
const modelBytes=read(artifact,'config.schema.json'),modelSchema=JSON.parse(modelBytes);
const defs=modelSchema.definitions??modelSchema.$defs;
assert(modelSchema.properties.exec_shutdown_policy);
const ajv=new (modelSchema.$schema.includes('2020-12')?Ajv2020:Ajv)({strict:false,allErrors:true});addFormats(ajv);
for(const [name,max] of [['uint',Number.MAX_SAFE_INTEGER],['uint64',Number.MAX_SAFE_INTEGER],['uint32',0xffffffff],['uint16',0xffff],['int64',Number.MAX_SAFE_INTEGER]])ajv.addFormat(name,{type:'number',validate:n=>Number.isSafeInteger(n)&&n<=max&&(name==='int64'||n>=0)});
const valid=ajv.compile(modelSchema);assert(valid(profile.native_config),JSON.stringify(valid.errors));
const lock={schema_version:1,feature:'FEAT-171',mode:'local_worktree_candidate',release:false,
 runtime_source:{base_commit:execFileSync('git',['-C',fork,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(inputs.map(p=>[p,sha(read(fork,p))]))},
 upstream:manifest.upstream,runtime_artifact:manifest.runtime,runtime_manifest_sha256:sha(manifestBytes),runtime_schema:manifest.appServer,
 runtime_relative_path:'.yijie/build/document-runtime-v1/'+current.artifact,patches:manifest.patches,
 config_schema_sha256:sha(modelBytes),profile_sha256:sha(profileBytes),base_profile_sha256:sha(read(root,'compatibility/runtime-tool-search/profile.json')),
 generator_sha256:sha(readFileSync(fileURLToPath(import.meta.url)))};
const go=execFileSync('gofmt',{input:`// Generated canonical FEAT-171 projection. DO NOT EDIT.
package runtimedocuments
import _ "embed"
const RuntimeManifestSHA256=${JSON.stringify(lock.runtime_manifest_sha256)}
const RuntimeBinarySHA256=${JSON.stringify(manifest.runtime.sha256)}
const RuntimeBinarySize int64=${manifest.runtime.sizeBytes}
const RuntimeSchemaTreeSHA256=${JSON.stringify(manifest.appServer.schemaTreeSha256)}
const RuntimeSchemaFileCount=${manifest.appServer.schemaFileCount}
const RuntimePatchManifest=${JSON.stringify(JSON.stringify(manifest.patches))}
//go:embed profile.json
var Profile []byte
//go:embed config.schema.json
var ConfigSchema []byte
`});
const outputs=new Map([[family+'/source.lock.json',json(lock)]]);
for(const dir of ['sdks/go/openapi/runtime-documents',...((sync||check)?['../yijie-agent-host/internal/contracts/runtimedocuments']:[])]){
 outputs.set(dir+'/runtime.gen.go',go);outputs.set(dir+'/profile.json',profileBytes);outputs.set(dir+'/config.schema.json',modelBytes);
}
if(sync||check)outputs.set('../yijie-desktop/contracts/runtime-documents.candidate.json',json(lock));
for(const [name,bytes]of outputs){const target=path.resolve(root,name);if(check)assert.deepEqual(readFileSync(target),bytes,name);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log('FEAT-171 cooperative Runtime projection '+(check?'verified':'generated')+'; local candidate only.');
