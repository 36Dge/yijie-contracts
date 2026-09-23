import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectScheduledSource,loadScheduledSources} from './scheduled-schema-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath='jsonschema/scheduled-tasks/draft-execution-v1.schema.json';
const source=JSON.parse(readFileSync(path.join(root,sourcePath)));const docs=loadScheduledSources(['draft']);docs.set(source.$id,source);
const resolved=projectScheduledSource(source.$id,docs);
const model=JSON.parse(readFileSync(path.join(root,'jsonschema/scheduled-tasks/plan-draft-v1.schema.json')));
// Bundle model schema with all canonical fragment references in place.
const modelBundle=structuredClone(model);delete modelBundle.$id;
function localize(x){if(Array.isArray(x))return x.map(localize);if(!x||typeof x!=='object')return x;return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='$ref'?v.replace(model.$id,''):localize(v)]));}
const definitions=new Map(Object.entries(resolved.$defs));const pascal=s=>s.split(/[_-]/).map(x=>x[0].toUpperCase()+x.slice(1)).join('');
function type(s,name,lang){
 if(s.$ref)return s.$ref.split('/').at(-1);
 if(s.enum||s.type==='object'||s.oneOf){definitions.set(name,s);return name;}
 if(s.type==='array'){const t=type(s.items,name+'Item',lang);return lang==='rust'?`Vec<${t}>`:lang==='go'?`[]${t}`:`Array<${t}>`;}
 let t=s.type??(typeof s.const==='number'?'integer':typeof s.const==='string'?'string':typeof s.const==='boolean'?'boolean':undefined);
 if(lang==='ts'&&s.const!==undefined)return JSON.stringify(s.const);
 return ({string:{rust:'String',go:'string',ts:'string'},integer:{rust:'i64',go:'int64',ts:'number'},boolean:{rust:'bool',go:'bool',ts:'boolean'}})[t]?.[lang]??(()=>{throw Error('Unsupported '+name)})();
}
let rust='// Generated from draft-execution source. DO NOT EDIT.\nuse serde::{Serialize,Deserialize};\nfn optional_non_null<\'de,D,T>(d:D)->Result<Option<T>,D::Error>where D:serde::Deserializer<\'de>,T:Deserialize<\'de>{T::deserialize(d).map(Some)}\n';let ts='// Generated from draft-execution source. DO NOT EDIT.\n';let go='// Code generated from draft-execution source. DO NOT EDIT.\npackage scheduledraft\nimport "encoding/json"\n';
for(const [name,s]of definitions){
 if(s.enum){rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]\npub enum ${name}{${s.enum.map(v=>`#[serde(rename=${JSON.stringify(v)})]${pascal(v)},`).join('')}}\n`;ts+=`export type ${name}=${s.enum.map(JSON.stringify).join('|')};\n`;go+=`type ${name} string\n`;continue;}
 if(s.oneOf){rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(untagged)]pub enum ${name}{${s.oneOf.map((v,i)=>`Variant${i}(Box<${type(v,name+i,'rust')}>),`).join('')}}\n`;ts+=`export type ${name}=${s.oneOf.map((v,i)=>type(v,name+i,'ts')).join('|')};\n`;go+=`type ${name}=json.RawMessage\n`;}
 else if(s.type==='object'){
 rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(deny_unknown_fields)]pub struct ${name}{\n`;ts+=`export interface ${name}{\n`;go+=`type ${name} struct {\n`;
 for(const [field,value]of Object.entries(s.properties)){const required=s.required?.includes(field);const rt=type(value,name+pascal(field),'rust'),gt=type(value,name+pascal(field),'go');rust+=`#[serde(rename=${JSON.stringify(field)}${required?'':',default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null"'})]pub ${field}:${required?rt:`Option<${rt}>`},\n`;ts+=`${field}${required?'':'?'}:${type(value,name+pascal(field),'ts')};\n`;go+=`${pascal(field)} ${required?gt:'*'+gt} \`json:"${field}${required?'':',omitempty'}"\`\n`;}
 rust+='}\n';ts+='}\n';go+='}\n';
 }else{rust+=`pub type ${name}=${type(s,name,'rust')};\n`;ts+=`export type ${name}=${type(s,name,'ts')};\n`;go+=`type ${name}=${type(s,name,'go')}\n`;continue;}
 rust+=`impl std::fmt::Debug for ${name}{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("${name}([redacted])")}}\n`;
}
function format(command,args,input){const r=spawnSync(command,args,{input,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout;}
const outputs={'sdks/rust/scheduled-draft/types.gen.rs':format('rustfmt',['--edition','2021'],rust),'sdks/typescript/src/jsonschema/scheduled-draft.gen.ts':ts,'sdks/go/openapi/scheduled-draft/types.gen.go':format('gofmt',[],go),'sdks/jsonschema/scheduled-draft.schema.json':JSON.stringify(resolved,null,2)+'\n','sdks/jsonschema/scheduled-draft-output.schema.json':JSON.stringify(localize(modelBundle),null,2)+'\n'};
const hash=b=>createHash('sha256').update(b).digest('hex');const sourceFiles=[sourcePath,'jsonschema/scheduled-tasks/plan-draft-v1.schema.json','openapi/scheduled-plan-draft/scheduled-plan-draft.yaml','scripts/generate-scheduled-draft.mjs','scripts/sync-scheduled-draft.mjs', 'scripts/scheduled-consumer-source.mjs','scripts/scheduled-schema-source.mjs'];
outputs['compatibility/scheduled-draft/source.lock.json']=JSON.stringify({schema_version:1,contract_version:'0.1.0',mode:'local_candidate',release:false,base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources:sourceFiles.map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:Object.entries(outputs).map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n';
for(const [p,b]of Object.entries(outputs)){const target=path.join(root,p);if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==b)throw Error('Generation drift '+p);}else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,b);}}
console.log('Scheduled draft same-source generation '+(process.argv.includes('--check')?'verified':'generated'));
