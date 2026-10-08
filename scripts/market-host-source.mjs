import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const hostSourcePath='compatibility/market-host/wire.schema.json';
export const hostManifestPath='compatibility/market-host/transport.json';
const read=p=>YAML.parse(readFileSync(path.join(root,p),'utf8'));
export function loadMarketHostSource(){return loadMarketFamily('host');}
export function loadMarketProviderSource(){return loadMarketFamily('provider');}
// The result shape is a mechanical projection of the owned profile policy;
// input identity constraints retain their original source, never a second DTO.
export function dailyOutputSchema(family){
 const p=family.manifest.tool_profile,args=family.defs[p.inputDefinition];
 return {type:'object',additionalProperties:false,required:[p.resultRowsField],properties:{[p.resultRowsField]:{type:'array',maxItems:p.maxRows,items:{type:'object',additionalProperties:false,required:[...p.resultIdentityFields,...p.resultRequiredNumericFields],properties:Object.fromEntries([...p.resultIdentityFields.map(name=>[name,args.properties[name]]),...p.resultNumericFields.map(name=>[name,{type:'number'}])])}}}};
}
function loadMarketFamily(kind){
 const sourcePath=kind==='host'?hostSourcePath:'compatibility/market-provider/wire.schema.json',manifestPath=kind==='host'?hostManifestPath:'compatibility/market-provider/transport.json';
 const source=read(sourcePath),manifest=read(manifestPath),names=Object.keys(source.$defs);
 assert.equal(source.$id,'https://schemas.yijie.ai/market-'+kind+'/v1');assert.equal(manifest.wire_authority,sourcePath);if(kind==='host')assert.equal(manifest.control_transport,'native_owned_stdio_jsonl');else assert.equal(manifest.transport,'existing_host_owned_broker_stdio_jsonl');assert.equal(manifest.contract_version,kind==='host'?'0.1.0':'0.2.0');
 const allowed=new Set([hostSourcePath,'compatibility/market-provider/wire.schema.json','compatibility/market-broker-control/wire.schema.json','compatibility/market-selection/wire.schema.json','openapi/market-connectors/market-connectors.yaml','jsonschema/chat/model-selection-v1.schema.json','jsonschema/chat/message.schema.json','openapi/runtime-permissions-v2/runtime-permissions-v2.yaml','openapi/agent-host/agent-host.yaml']);
 const documents=new Map([[sourcePath,source],[manifestPath,manifest]]),defs={},pointers=new Map(names.map(n=>[n,[sourcePath,'/$defs/'+n]])),refs=new Map(names.map(n=>[sourcePath+'#/$defs/'+n,n]));
 function value(p,f){if(!documents.has(p))documents.set(p,read(p));const s=f.split('/').slice(1).reduce((o,k)=>o[k.replaceAll('~1','/').replaceAll('~0','~')],documents.get(p));assert.ok(s&&typeof s==='object',p+'#'+f);return s;}
 function target(p,r){const[relative,f]=r.split('#');assert.ok(f?.startsWith('/'));const t=relative?path.posix.normalize(path.posix.join(path.posix.dirname(p),relative)):p;assert.ok(allowed.has(t),'Unregistered reference '+t);const v=value(t,f);return v.$ref?target(t,v.$ref):[t,f];}
 for(const[n,s]of Object.entries(source.$defs))if(s.$ref&&!s.$ref.startsWith('#')){const[p,f]=target(sourcePath,s.$ref);refs.set(p+'#'+f,n);pointers.set(n,[p,f]);}
 function bundle(s,p){if(Array.isArray(s))return s.map(v=>bundle(v,p));if(!s||typeof s!=='object')return s;if(s.$ref){const[t,f]=target(p,s.$ref),key=t+'#'+f;if(!refs.has(key)){let n=f.split('/').at(-1);while(pointers.has(n))n='Referenced'+n;refs.set(key,n);pointers.set(n,[t,f]);}return{$ref:'#/$defs/'+refs.get(key)};}return Object.fromEntries(Object.entries(s).filter(([k])=>!k.startsWith('x-')&&k!=='discriminator').map(([k,v])=>[k,bundle(v,p)]));}
 for(const[n,[p,f]]of pointers)defs[n]=bundle(value(p,f),p);
 for(const c of manifest.commands)assert.ok(names.includes(c.request)&&names.includes(c.response));
 if(kind==='provider'){
  const p=manifest.tool_profile;
  assert.deepEqual(Object.keys(p).sort(),['profile','serviceId','gatewayToolName','upstreamToolName','inputDefinition','upstreamInputSchemaSha256','schemaDigestEncoding','risk','permissionMode','maxRows','maxCallsPerApproval','resultIdentityFields','resultNumericFields','resultRowsField','resultRequiredNumericFields','resultPolicy','approvalPolicy'].sort());
  assert.equal(p.profile,'tushare-daily-v1');assert.equal(p.serviceId,'tushareMcp');assert.equal(p.gatewayToolName,'tushare_daily');assert.equal(p.upstreamToolName,'daily');assert.equal(p.inputDefinition,'TushareDailyArguments');
  assert.equal(p.upstreamInputSchemaSha256,'ec10409543d1ae690de2b5da5893a0e69387cdd5a398f976fb04d187fc632ae1');
  assert.equal(p.risk,'read');assert.equal(p.permissionMode,'ask');assert.equal(p.maxRows,1);assert.equal(p.maxCallsPerApproval,1);
  assert.deepEqual(p.resultIdentityFields,['ts_code','trade_date']);assert.deepEqual(p.resultNumericFields,['open','high','low','close','pre_close','change','pct_chg','vol','amount']);
  assert.equal(p.resultRowsField,'rows');assert.deepEqual(p.resultRequiredNumericFields,['close']);assert.ok(p.resultRequiredNumericFields.every(name=>p.resultNumericFields.includes(name)));
  const args=source.$defs[p.inputDefinition];assert.equal(args.type,'object');assert.equal(args.additionalProperties,false);assert.deepEqual(args.required,['ts_code','trade_date']);assert.deepEqual(Object.keys(args.properties),args.required);
 }
 return {source,manifest,names,defs,documents,schema:{$schema:source.$schema,$id:source.$id,$defs:defs}};
}
