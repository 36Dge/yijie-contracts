import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const brokerSourcePath='compatibility/market-broker-control/wire.schema.json';
export const brokerManifestPath='compatibility/market-broker-control/control.json';
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
const keys=(v,want)=>assert.deepEqual(Object.keys(v).sort(),[...want].sort());
export function validateBrokerManifest(m,names){
 keys(m,['schema_version','contract_id','contract_version','wire_authority','transport','owner','commands','limits','semantics','args_digest','gateway_errors','generic_profile']);
 assert.equal(m.schema_version,1);assert.equal(m.contract_id,'market-broker-control/1');assert.equal(m.contract_version,'0.4.0');assert.equal(m.wire_authority,brokerSourcePath);assert.equal(m.transport,'owner_owned_stdio_jsonl');
 assert.deepEqual(m.commands.map(c=>c.method),['initialize','prepare','bind_turn','revoke','status','pending_call','decide_call','shutdown']);
 for(const c of m.commands){keys(c,['method','request','response','mutation']);assert.ok(names.includes(c.request)&&names.includes(c.response));assert.equal(c.mutation,!['status','pending_call'].includes(c.method));}
 assert.deepEqual(m.limits,{maxFrameBytes:65536,maxLeaseTtlMs:300000,maxUnboundWaitMs:5000,maxApprovalTtlMs:60000,maxRetainedLeases:64,maxPendingCalls:128,maxMutationReceipts:1024,maxArgumentsBytes:32768,maxArgumentsDepth:16});
 keys(m.semantics,['scope','clock','deduplication','capacity','dataCapability','pendingCall','shutdown','unknownOutcome','qualification','gatewayOutcome']);
 for(const v of [m.owner,...Object.values(m.semantics)])assert.ok(typeof v==='string'&&v.length>0&&v.length<=2048);
 keys(m.generic_profile,['profile','maxToolsPerService','maxToolsPerSelection','maxSchemaBytes','maxSchemasBytes','maxReviewArgumentsBytes','maxResultBytes','maxDepth','permissionMode','unknownRisk','destructiveWithoutImpactPolicy','schemaReferences','businessRetry']);
 assert.equal(m.generic_profile.profile,'generic-mcp-v1');assert.equal(m.generic_profile.permissionMode,'ask');assert.equal(m.generic_profile.unknownRisk,'write');assert.equal(m.generic_profile.destructiveWithoutImpactPolicy,'deny');assert.equal(m.generic_profile.schemaReferences,'local_only_no_network_or_files');assert.equal(m.generic_profile.businessRetry,'never');
 for(const[k,v]of Object.entries(m.generic_profile))if(k.startsWith('max'))assert.ok(Number.isSafeInteger(v)&&v>0);
 keys(m.args_digest,['version','domain','algorithm','encoding','ordering','numbers','freeze']);assert.equal(m.args_digest.version,'worker-json-v1');assert.equal(m.args_digest.domain,'yijie.market-arguments/worker-json-v1\n');assert.equal(m.args_digest.algorithm,'sha256');
 for(const v of Object.values(m.args_digest))assert.ok(typeof v==='string'&&v.length>0&&v.length<=2048);
 keys(m.gateway_errors,['ownerRejected','admissionStopped','executionUnverified']);
 for(const[name,v]of Object.entries(m.gateway_errors)){
  keys(v,['outcome','code','message','when']);
  assert.equal(v.outcome,name==='executionUnverified'?'unknown':'not_sent');
  assert.equal(v.code,name==='executionUnverified'?'temporarily_unavailable':'approval_invalid');
  for(const text of [v.message,v.when])assert.ok(typeof text==='string'&&text.length>0&&text.length<=1024);
 }
}
export function loadBrokerSource(){
 const source=read(brokerSourcePath),manifest=read(brokerManifestPath),names=Object.keys(source.$defs);
 keys(source,['$schema','$id','$defs']);assert.equal(source.$schema,'https://json-schema.org/draft/2020-12/schema');assert.equal(source.$id,'https://schemas.yijie.ai/market-broker-control/v1');assert.equal(names.length,55);validateBrokerManifest(manifest,names);
 for(const v of Object.values(manifest.gateway_errors))assert.ok(source.$defs.ErrorCode.enum.includes(v.code),'Gateway projections only reuse existing Broker error codes');
 const allowed=new Set([brokerSourcePath,'compatibility/market-selection/wire.schema.json','openapi/market-connectors/market-connectors.yaml']);
 const documents=new Map([[brokerSourcePath,source],[brokerManifestPath,manifest]]),defs={},pointers=new Map(names.map(n=>[n,[brokerSourcePath,'/$defs/'+n]])),refs=new Map(names.map(n=>[brokerSourcePath+'#/$defs/'+n,n]));
 function targetFor(p,r){const[relative,fragment]=r.split('#');assert.ok(fragment?.startsWith('/'));const target=relative?path.posix.normalize(path.posix.join(path.posix.dirname(p),relative)):p;assert.ok(allowed.has(target),'Only explicit local authorities are accepted');if(!documents.has(target))documents.set(target,read(target));const v=fragment.split('/').slice(1).reduce((o,k)=>o[k.replaceAll('~1','/').replaceAll('~0','~')],documents.get(target));assert.ok(v&&typeof v==='object');return v.$ref?targetFor(target,v.$ref):[target,fragment];}
 for(const[n,s]of Object.entries(source.$defs))if(s.$ref&&!s.$ref.startsWith('#')){const[p,f]=targetFor(brokerSourcePath,s.$ref);refs.set(p+'#'+f,n);pointers.set(n,[p,f]);}
 function resolve(p,f){if(!documents.has(p))documents.set(p,read(p));const s=f.split('/').slice(1).reduce((o,k)=>o[k.replaceAll('~1','/').replaceAll('~0','~')],documents.get(p));assert.ok(s&&typeof s==='object',p+'#'+f);if(s.$ref){const[next,fragment]=targetFor(p,s.$ref);return resolve(next,fragment);}return[s,p];}
 function bundle(s,p){if(Array.isArray(s))return s.map(v=>bundle(v,p));if(!s||typeof s!=='object')return s;if(s.$ref){const[t,f]=targetFor(p,s.$ref),key=t+'#'+f;if(!refs.has(key)){let n=f.split('/').at(-1);while(pointers.has(n))n='Referenced'+n;refs.set(key,n);pointers.set(n,[t,f]);}return{$ref:'#/$defs/'+refs.get(key)};}return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,bundle(v,p)]));}
 for(const[n,[p,f]]of pointers){const[s,origin]=resolve(p,f);defs[n]=bundle(s,origin);}
 return{source,manifest,names,defs,documents,schema:{$schema:source.$schema,$id:source.$id,$defs:defs}};
}
