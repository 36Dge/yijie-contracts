import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const sourcePath='compatibility/experts/wire.schema.json';
export const manifestPaths=['compatibility/experts/native-ipc.json','compatibility/experts/transport.json'];
const allowed=new Set([sourcePath,...manifestPaths,
  'jsonschema/skills/skill-bundle-manifest-v2.schema.json','jsonschema/skills/skill-bundle-manifest-v3.schema.json',
  'compatibility/market-host/wire.schema.json','compatibility/market-provider/wire.schema.json',
  'compatibility/market-broker-control/wire.schema.json','compatibility/market-selection/wire.schema.json',
  'openapi/market-connectors/market-connectors.yaml','jsonschema/chat/model-selection-v1.schema.json',
  'jsonschema/chat/message.schema.json','openapi/runtime-permissions-v2/runtime-permissions-v2.yaml',
  'openapi/agent-host/agent-host.yaml']);

// Bundle actual referenced authorities, never duplicate a hand-written DTO.
export function loadExpertsSource(){
  const documents=new Map();
  const read=p=>{assert.ok(allowed.has(p),'Unregistered expert reference '+p);if(!documents.has(p))documents.set(p,YAML.parse(readFileSync(path.join(root,p),'utf8')));return documents.get(p);};
  const source=read(sourcePath),native=read(manifestPaths[0]),transport=read(manifestPaths[1]);
  assert.equal(source.$id,'https://schemas.yijie.ai/experts/v1');
  for(const manifest of [native,transport]){assert.equal(manifest.wire_authority,sourcePath);assert.equal(manifest.contract_version,'0.1.0');}
  const names=Object.keys(source.$defs),defs={},pointers=new Map(names.map(n=>[n,[sourcePath,'/$defs/'+n]])),refs=new Map(names.map(n=>[sourcePath+'#/$defs/'+n,n]));
  function value(p,f){const v=f.split('/').slice(1).reduce((o,k)=>o[k.replaceAll('~1','/').replaceAll('~0','~')],read(p));assert.ok(v&&typeof v==='object',p+'#'+f);return v;}
  function target(p,r){const[relative,f]=r.split('#');assert.ok(f?.startsWith('/'));const t=relative?path.posix.normalize(path.posix.join(path.posix.dirname(p),relative)):p;const v=value(t,f);return v.$ref?target(t,v.$ref):[t,f];}
  for(const[n,s]of Object.entries(source.$defs))if(s.$ref&&!s.$ref.startsWith('#')){const[p,f]=target(sourcePath,s.$ref);refs.set(p+'#'+f,n);pointers.set(n,[p,f]);}
  function bundle(s,p){if(Array.isArray(s))return s.map(v=>bundle(v,p));if(!s||typeof s!=='object')return s;if(s.$ref){const[t,f]=target(p,s.$ref),key=t+'#'+f;if(!refs.has(key)){let n=f.split('/').at(-1);while(pointers.has(n))n='Referenced'+n;refs.set(key,n);pointers.set(n,[t,f]);}return{$ref:'#/$defs/'+refs.get(key)};}return Object.fromEntries(Object.entries(s).filter(([k])=>!k.startsWith('x-')&&k!=='discriminator').map(([k,v])=>[k,bundle(v,p)]));}
  for(const[n,[p,f]]of pointers)defs[n]=bundle(value(p,f),p);
  for(const manifest of [native,transport])for(const c of manifest.commands){assert.ok(names.includes(c.request));assert.ok(names.includes(c.response));}
  return {source,native,transport,names,defs,documents,schema:{$schema:source.$schema,$id:source.$id,$defs:defs}};
}

export function definitionClosure(defs,roots){
  const found=new Set(roots);
  function visit(v){if(!v||typeof v!=='object')return;if(v.$ref){const name=v.$ref.split('/').at(-1);if(!found.has(name)){found.add(name);visit(defs[name]);}}for(const[k,x]of Object.entries(v))if(k!=='$ref')if(Array.isArray(x))x.forEach(visit);else visit(x);}
  for(const name of roots)visit(defs[name]);
  return Object.fromEntries([...found].map(name=>[name,defs[name]]));
}

export function canonicalExpertSnapshotText(snapshot,policy){
  const fields=[policy.domain,snapshot.turnOperationId,String(snapshot.bindingRevision),snapshot.expert===null?'none':'expert'];
  if(snapshot.expert!==null)for(const key of ['expertId','version','archiveSha256','roleSha256','knowledgeManifestSha256'])fields.push(snapshot.expert[key]);
  return fields.join('\n')+'\n';
}

export function canonicalKnowledgeManifestBytes(resources,policy){
  const ordered=[...resources].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  assert.equal(new Set(ordered.map(r=>r.id)).size,ordered.length);
  const chunks=[Buffer.from(policy.domain+'\n'+ordered.length+'\n','utf8')];
  for(const resource of ordered){
    for(const key of policy.fields){const value=key==='bytes'?String(resource[key]):resource[key];assert.equal(typeof value,'string');const bytes=Buffer.from(value,'utf8');chunks.push(Buffer.from(bytes.length+':','ascii'),bytes);}
    chunks.push(Buffer.from('\n','ascii'));
  }
  return Buffer.concat(chunks);
}
