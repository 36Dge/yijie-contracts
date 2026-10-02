import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check=process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(x=>x==='--check'));
const sourcePath='jsonschema/chat/model-selection-v1.schema.json';
const source=JSON.parse(readFileSync(path.join(root,sourcePath)));
const defs=new Map(Object.entries(source.$defs));
const pascal=s=>s.split(/[_-]/).map(x=>x[0].toUpperCase()+x.slice(1)).join('');
function type(s,name,lang) {
  if(s.$ref) return s.$ref.split('/').at(-1);
  if(s.enum||s.type==='object'){defs.set(name,s);return name;}
  if(s.type==='array'){let t=type(s.items,name+'Item',lang);return lang==='go'?`[]${t}`:lang==='rust'?`Vec<${t}>`:`Array<${t}>`;}
  if(lang==='ts'&&s.const!==undefined)return JSON.stringify(s.const);
  const t=s.type??typeof s.const;
  return ({string:{go:'string',rust:'String',ts:'string'},integer:{go:'int64',rust:'i64',ts:'number'},number:{go:'int64',rust:'i64',ts:'number'},boolean:{go:'bool',rust:'bool',ts:'boolean'}})[t]?.[lang]??(()=>{throw Error(name)})();
}
let go='// Code generated from model-selection-v1.schema.json; DO NOT EDIT.\npackage chatmodels\n';
let rust='// Generated from model-selection-v1.schema.json; DO NOT EDIT.\nuse serde::{Serialize,Deserialize};\n';
let ts='// Generated from model-selection-v1.schema.json; DO NOT EDIT.\n';
for(const [name,s] of defs) {
  if(s.enum){
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
 ['sdks/go/openapi/chat-models/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/rust/chat-models/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/typescript/src/jsonschema/chat-models.gen.ts',ts],
 ['sdks/jsonschema/chat-models.schema.json',JSON.stringify(source,null,2)+'\n'],
]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[sourcePath,'scripts/generate-chat-models.mjs','openapi/chat-models/chat-models.yaml'];
const lockPath='compatibility/chat-models/source.lock.json';
const base=check?JSON.parse(readFileSync(path.join(root,lockPath))).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
out.set(lockPath,JSON.stringify({schema_version:1,contract_version:'0.1.0',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:[...out].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const [p,b]of out){let f=path.join(root,p);if(check)assert.deepEqual(readFileSync(f),Buffer.from(b),p);else{mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,b);}}
console.log('Chat models source generation '+(check?'verified':'complete')+'; unreleased local candidate.');
