import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check=process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(x=>x==='--check'));
const sourcePath='jsonschema/chat/model-selection-v2.schema.json';
const source=JSON.parse(readFileSync(path.join(root,sourcePath)));
assert.equal(source['x-family-version'],'0.2.0');
assert.deepEqual(source['x-model-profiles'].map(p=>p.profile_id),source.$defs.ActiveProfileId.enum);
assert.equal(source.$defs.Catalog.properties.default_profile.const,source['x-model-profiles'][0].profile_id);
const defs=new Map(Object.entries(source.$defs));
const pascal=s=>s.split(/[_-]/).map(x=>x[0].toUpperCase()+x.slice(1)).join('');
function type(s,name,lang) {
  if(s.$ref) return s.$ref.split('/').at(-1);
  if((s.enum&&s.type==='string')||s.type==='object'){defs.set(name,s);return name;}
  if(s.type==='array'){let t=type(s.items,name+'Item',lang);return lang==='go'?`[]${t}`:lang==='rust'?`Vec<${t}>`:`Array<${t}>`;}
  if(lang==='ts'&&s.const!==undefined)return JSON.stringify(s.const);
  const t=s.type??typeof s.const;
  return ({string:{go:'string',rust:'String',ts:'string'},integer:{go:'int64',rust:'i64',ts:'number'},number:{go:'int64',rust:'i64',ts:'number'},boolean:{go:'bool',rust:'bool',ts:'boolean'}})[t]?.[lang]??(()=>{throw Error(name)})();
}
let go='// Code generated from model-selection-v2.schema.json; DO NOT EDIT.\npackage chatmodelsv2\n';
let rust='// Generated from model-selection-v2.schema.json; DO NOT EDIT.\nuse serde::{Serialize,Deserialize};\n';
let ts='// Generated from model-selection-v2.schema.json; DO NOT EDIT.\n';
for(const [name,s] of defs) {
  if(s.enum && s.type==='string'){
    assert.equal(new Set(s.enum).size,s.enum.length,`Duplicate enum value in ${name}`);
    assert.equal(new Set(s.enum.map(pascal)).size,s.enum.length,`Generated enum name collision in ${name}`);
    go+=`type ${name} string\nconst(\n${s.enum.map(v=>`${name}${pascal(v)} ${name}=${JSON.stringify(v)}`).join('\n')}\n)\n`;
    rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]pub enum ${name}{${s.enum.map(v=>`#[serde(rename=${JSON.stringify(v)})]${pascal(v)},`).join('')}}\n`;
    ts+=`export type ${name}=${s.enum.map(JSON.stringify).join('|')};\n`;
  } else if(s.type==='object') {
    go+=`type ${name} struct{\n`;rust+=`#[derive(Debug,Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(deny_unknown_fields)]pub struct ${name}{\n`;ts+=`export interface ${name}{\n`;
    for(const [f,v] of Object.entries(s.properties)){
      const required=s.required.includes(f), g=type(v,name+pascal(f),'go'),r=type(v,name+pascal(f),'rust'),t=type(v,name+pascal(f),'ts');
      go+=`${pascal(f)} ${required?g:'*'+g} \`json:"${f}${required?'':',omitempty'}"\`\n`;
      rust+=`${required?'':'#[serde(default,skip_serializing_if="Option::is_none")]'}pub ${f}:${required?r:`Option<${r}>`},\n`;
      ts+=`${f}${required?'':'?'}:${t};\n`;
    }
    go+='}\n';rust+='}\n';ts+='}\n';
  } else {go+=`type ${name}=${type(s,name,'go')}\n`;rust+=`pub type ${name}=${type(s,name,'rust')};\n`;ts+=`export type ${name}=${type(s,name,'ts')};\n`;}
}
// Identity metadata is generated from the same authoritative profile table.
go+='func Definitions() []ModelDefinition {return []ModelDefinition{\n';
for(const p of source['x-model-profiles'])go+=`{ProfileId:${JSON.stringify(p.profile_id)},Label:${JSON.stringify(p.label)},Provider:${JSON.stringify(p.provider)},Model:${JSON.stringify(p.model)},Effort:${JSON.stringify(p.effort)},ContextWindow:${p.context_window}},\n`;
go+='}}\n';
ts+='export const modelDefinitions: ReadonlyArray<ModelDefinition> = '+JSON.stringify(source['x-model-profiles'])+';\n';
const out=new Map([
 ['sdks/go/openapi/chat-models-v2/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/rust/chat-models-v2/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/typescript/src/jsonschema/chat-models-v2.gen.ts',ts],
 ['sdks/jsonschema/chat-models-v2.schema.json',JSON.stringify(source,null,2)+'\n'],
]);
// Canonical URLs are identifiers, not network fetch locations. Resolve the
// existing payload authorities locally and record every dependency in the lock.
const apiSource='openapi/chat-models-v2/chat-models-v2.yaml';
const canonicalIds=new Map();
for(const name of readdirSync(path.join(root,'jsonschema'),{recursive:true})){
  if(!name.endsWith('.json'))continue;
  const file=path.posix.join('jsonschema',name);
  const schema=JSON.parse(readFileSync(path.join(root,file)));
  if(schema.$id)canonicalIds.set(schema.$id,file);
}
const apiSources=new Set();
const documents=new Map();
const projectedComponents=new Map();
function document(file){
  assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'),'local source path required');
  if(!documents.has(file))documents.set(file,YAML.parse(readFileSync(path.join(root,file),'utf8')));
  apiSources.add(file);return documents.get(file);
}
function expand(value,file,stack=new Set()){
  if(Array.isArray(value))return value.map(v=>expand(v,file,stack));
  if(!value||typeof value!=='object')return value;
  if(value.$ref){
    const [location,pointer='']=value.$ref.split('#');
    const target=!location?file:location.startsWith('https://')?canonicalIds.get(location):path.posix.normalize(path.posix.join(path.posix.dirname(file),location));
    assert.ok(target,'Unregistered canonical reference: '+location);
    const identity=target+'#'+pointer;
    assert.ok(!stack.has(identity),'Recursive API projection needs an explicit named definition: '+identity);
    let resolved=document(target);
    if(pointer)for(const token of pointer.slice(1).split('/'))resolved=resolved[token.replaceAll('~1','/').replaceAll('~0','~')];
    assert.ok(resolved,'Missing reference '+identity);
    const next=new Set(stack);next.add(identity);
    const {$ref,...siblings}=value;
    return {...expand(resolved,target,next),...expand(siblings,file,stack)};
  }
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='$id'&&key!=='$schema').map(([key,v])=>{
    if(key==='discriminator'&&v.mapping){
      const mapping=Object.fromEntries(Object.entries(v.mapping).map(([tag,reference])=>{
        const name='F164_'+createHash('sha256').update(file+'#'+reference).digest('hex').slice(0,16);
        if(!projectedComponents.has(name))projectedComponents.set(name,expand({$ref:reference},file,stack));
        return [tag,'#/components/schemas/'+name];
      }));
      return [key,{...v,mapping}];
    }
    return [key,expand(v,file,stack)];
  }));
}
const apiProjection=expand(document(apiSource),apiSource);
apiProjection.components={...apiProjection.components,schemas:{...apiProjection.components?.schemas,...Object.fromEntries(projectedComponents)}};
out.set('sdks/openapi/chat-models-v2.bundle.json',JSON.stringify(apiProjection,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[...new Set([sourcePath,'scripts/generate-chat-models-v2.mjs',...apiSources])].sort();
const lockPath='compatibility/chat-models-v2/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(readFileSync(path.join(root,lockPath))).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
out.set(lockPath,JSON.stringify({schema_version:1,contract_version:'0.2.0',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:[...out].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const [p,b]of out){let f=path.join(root,p);if(check)assert.deepEqual(readFileSync(f),Buffer.from(b),p);else{mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,b);}}
console.log('Chat models v2 source generation '+(check?'verified':'complete')+'; unreleased local candidate.');
