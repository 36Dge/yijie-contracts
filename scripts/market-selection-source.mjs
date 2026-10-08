// Shared local source loader for generation and lint. No HTTP discovery.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const marketSelectionSourcePath='compatibility/market-selection/wire.schema.json';
export const marketSelectionManifestPath='compatibility/market-selection/native-ipc.json';
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
function keys(value,expected){assert.deepEqual(Object.keys(value).sort(),[...expected].sort());}
function boundedText(v){assert.equal(typeof v,'string');assert.ok(v.length>0&&v.length<=2048);}
export function validateMarketSelectionManifest(m,names){
 keys(m,['schema_version','contract_id','contract_version','title','description','wire_authority','transport','native_ipc','selection_digest','semantics']);
 assert.equal(m.schema_version,1);assert.equal(m.contract_id,'market-selection/1');assert.equal(m.contract_version,'0.1.0');
 assert.equal(m.wire_authority,marketSelectionSourcePath);assert.equal(m.transport,'native_ipc');boundedText(m.title);boundedText(m.description);
 keys(m.native_ipc,['version','contextBinding','commands']);assert.equal(m.native_ipc.version,1);assert.equal(m.native_ipc.contextBinding,'chat_bind_context_v1');
 assert.deepEqual(m.native_ipc.commands,[{command:'chat_market_submit_v1',request:'SubmitRequest',response:'SubmitResponse',requiredPermission:'chat permissions; connector.use only for nonempty selection'}]);
 for(const c of m.native_ipc.commands){assert.ok(names.includes(c.request));assert.ok(names.includes(c.response));}
 keys(m.selection_digest,['version','domain','algorithm','encoding','lines','trailingLf','maxItems','uniqueKey','sort','safeIntegerMaximum']);
 assert.equal(m.selection_digest.version,1);assert.equal(m.selection_digest.domain,'yijie.market-selection/v1');assert.equal(m.selection_digest.algorithm,'sha256');
 assert.equal(m.selection_digest.encoding,'ASCII; actual LF line endings; lowercase hexadecimal digest');
 assert.deepEqual(m.selection_digest.lines,['domain','canonical actual turnOperationId','decimal count','each sorted installationId + ASCII SPACE + decimal revision + ASCII SPACE + decimal generation']);
 assert.equal(m.selection_digest.trailingLf,true);assert.equal(m.selection_digest.maxItems,51);assert.equal(m.selection_digest.uniqueKey,'installationId');assert.equal(m.selection_digest.sort,'installationId ASCII ascending');assert.equal(m.selection_digest.safeIntegerMaximum,9007199254740991);
 keys(m.semantics,['scope','acceptedReplay','emptySelection','unqualifiedNonempty','unknownOutcome','rollback','authority','unqualifiedProvider','legacyCollision']);
 assert.equal(m.semantics.scope,'ordinary_chat_only');for(const v of Object.values(m.semantics))boundedText(v);
}
export function loadMarketSelectionSource(){
 const sourcePath=marketSelectionSourcePath,source=read(sourcePath),manifest=read(marketSelectionManifestPath),own=source.$defs,names=Object.keys(own);
 keys(source,['$schema','$id','$defs']);assert.equal(source.$schema,'https://json-schema.org/draft/2020-12/schema');assert.equal(source.$id,'https://schemas.yijie.ai/chat/market-selection/v1');assert.equal(names.length,18);
 validateMarketSelectionManifest(manifest,names);
 const allowed=new Set([sourcePath,'openapi/market-connectors/market-connectors.yaml','jsonschema/chat/model-selection-v1.schema.json','jsonschema/chat/message.schema.json']);
 const refs=new Map(names.map(n=>[sourcePath+'#/$defs/'+n,n]));
 const documents=new Map([[sourcePath,source],[marketSelectionManifestPath,manifest]]),defs={};
 const pointers=new Map(names.map(n=>[n,[sourcePath,'/$defs/'+n]]));
 function targetFor(p,r){const[relative,fragment]=r.split('#');assert.ok(fragment?.startsWith('/'));const target=relative?path.posix.normalize(path.posix.join(path.posix.dirname(p),relative)):p;assert.ok(allowed.has(target),'Only declared local authorities may be referenced');return[target,fragment];}
 for(const[name,s]of Object.entries(own))if(s.$ref&&!s.$ref.startsWith('#')){const[p,fragment]=targetFor(sourcePath,s.$ref);refs.set(p+'#'+fragment,name);pointers.set(name,[p,fragment]);}
 function resolvePointer(p,pointer){if(!documents.has(p))documents.set(p,read(p));const v=pointer.split('/').slice(1).reduce((o,k)=>o[k.replaceAll('~1','/').replaceAll('~0','~')],documents.get(p));assert.ok(v&&typeof v==='object');return v;}
 function bundle(s,p){
  if(Array.isArray(s))return s.map(v=>bundle(v,p));if(!s||typeof s!=='object')return s;
  if(s.$ref){const[target,fragment]=targetFor(p,s.$ref),key=target+'#'+fragment;if(!refs.has(key)){let name=fragment.split('/').at(-1);while(pointers.has(name))name='Referenced'+name;refs.set(key,name);pointers.set(name,[target,fragment]);}return{$ref:'#/$defs/'+refs.get(key)};}
  return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,bundle(v,p)]));
 }
 for(const[name,[p,pointer]]of pointers)defs[name]=bundle(resolvePointer(p,pointer),p);
 return {sourcePath,source,manifest,own,names,documents,defs,schema:{$schema:source.$schema,$id:source.$id,$defs:defs}};
}
