import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import openapiTS, {astToString} from 'openapi-typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
assert.ok(args.length===0 || (args.length===1 && args[0]==='--check'));
const check=args.includes('--check');
const read=p=>readFileSync(path.join(root,p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const source='openapi/native-turn-timing/native-turn-timing.yaml';
const spec=JSON.parse(read(source));
const defs=new Map(Object.entries(spec.components.schemas));
const pascal=s=>s.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join('');
function rustType(s,name) {
  if(s.$ref)return s.$ref.split('/').at(-1);
  if(s.enum && s.type==='string' || s.type==='object'){defs.set(name,s);return name;}
  if(s.type==='integer')return 'i64';
  if(s.type==='string')return 'String';
  throw Error('Unsupported timing schema '+name);
}
let rust=`// Generated from native-turn-timing source; DO NOT EDIT.
use serde::{Deserialize,Serialize};
fn optional_non_null<'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<'de>,T:Deserialize<'de>{T::deserialize(d).map(Some)}
fn canonical(s:&str)->bool{uuid::Uuid::parse_str(s).is_ok_and(|v| !v.is_nil() && v.to_string()==s)}
`;
for(const [name,s] of defs){
  if(s.enum && s.type==='string'){
    rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]\npub enum ${name}{${s.enum.map(v=>`#[serde(rename="${v}")] ${pascal(v)},`).join('')}}\n`;
  }else if(s.type==='string'){rust+=`pub type ${name}=String;\n`;}
  else if(s.type==='object'){
    const entries=Object.entries(s.properties);
    const fields=entries.map(([f,v])=>{const t=rustType(v,name+pascal(f));return (s.required.includes(f)?`pub ${f}:${t},`:`#[serde(default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null")] pub ${f}:Option<${t}>,`);}).join('\n');
    rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)] #[serde(try_from="${name}Wire")] pub struct ${name}{${fields}}\n#[derive(Deserialize)] #[serde(deny_unknown_fields)] struct ${name}Wire{${fields}}\nimpl TryFrom<${name}Wire> for ${name}{type Error=&'static str;fn try_from(w:${name}Wire)->Result<Self,Self::Error>{let v=Self{${entries.map(([f])=>`${f}:w.${f}`).join(',')}};v.validate()?;Ok(v)}}\nimpl ${name}{pub fn validate(&self)->Result<(),&'static str>{\n`;
    for(const [f,v] of entries){
      const resolved=v.$ref?spec.components.schemas[v.$ref.split('/').at(-1)]:v;
      if(v.$ref?.endsWith('/CanonicalID'))rust+=`if !canonical(&self.${f}){return Err("invalid timing identity");}\n`;
      if(resolved.type==='object')rust+=`self.${f}.validate()?;\n`;
      if(v.type==='integer'){
        const conditions=[];
        if(v.minimum!==undefined && v.maximum!==undefined)conditions.push(`!(${v.minimum}..=${v.maximum}).contains(&n)`);
        else {
          if(v.minimum!==undefined)conditions.push(`n < ${v.minimum}`);
          if(v.maximum!==undefined)conditions.push(`n > ${v.maximum}`);
        }
        if(v.enum)conditions.push(`!${JSON.stringify(v.enum)}.contains(&n)`);
        if(conditions.length)rust+=s.required.includes(f)?`{let n=self.${f};if ${conditions.join('||')}{return Err("invalid timing number");}}\n`:`if self.${f}.is_some_and(|n| ${conditions.join('||')}){return Err("invalid timing number");}\n`;
      }
      if(v.minLength)rust+=`if self.${f}.chars().count()<${v.minLength}{return Err("invalid timing text");}\n`;
      if(v.maxLength)rust+=`if self.${f}.chars().count()>${v.maxLength}{return Err("invalid timing text");}\n`;
    }
    if(s['x-state-rules']){
      const {field,rules}=s['x-state-rules'];
      const t=s.properties[field].$ref.split('/').at(-1);
      for(const [state,r]of Object.entries(rules)){
        const invalid=[...(r.required??[]).map(f=>`self.${f}.is_none()`),...(r.forbidden??[]).map(f=>`self.${f}.is_some()`)].join('||');
        rust+=`if self.${field}==${t}::${pascal(state)} && (${invalid}){return Err("invalid timing state");}\n`;
      }
    }
    rust+=`Ok(())}}\nimpl std::fmt::Debug for ${name}{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("${name}([redacted])")}}\n`;
  }else throw Error('Unsupported timing definition '+name);
}
function project(v){
  if(Array.isArray(v))return v.map(project);
  if(!v||typeof v!=='object')return v;
  const out={};
  for(const [k,x]of Object.entries(v))if(k!=='x-state-rules')out[k]=k==='$ref'?x.replace('#/components/schemas/','#/$defs/'):project(x);
  if(v['x-state-rules']){const {field,rules}=v['x-state-rules'];out.allOf=Object.entries(rules).map(([state,r])=>({if:{properties:{[field]:{const:state}},required:[field]},then:{...(r.required?{required:r.required}:{}),properties:Object.fromEntries([...(r.required??[]).map(f=>[f,{}]),...(r.forbidden??[]).map(f=>[f,false])])}}));}
  return out;
}
const schema={$schema:'https://json-schema.org/draft/2020-12/schema',$id:'https://schemas.yijie.ai/native-turn-timing/v1',$defs:project(spec.components.schemas)};
const outputs=new Map([
 ['sdks/go/openapi/native-turn-timing/types.gen.go',execFileSync('go',['tool','oapi-codegen','-generate','types,skip-prune','-package','nativetiming',source],{cwd:root})],
 ['sdks/typescript/src/openapi/native-turn-timing.gen.ts',astToString(await openapiTS(spec))],
 ['sdks/rust/native-turn-timing/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/jsonschema/native-turn-timing.schema.json',JSON.stringify(schema,null,2)+'\n'],
]);
const runtime={};
for(const name of ['ThreadReadResponse','TurnStartedNotification','TurnCompletedNotification']){
 const file=`.yijie/schemas/input-only-app-server/generated-json-schema/v2/${name}.json`;
 const bytes=readFileSync(path.join(root,'../yijie-codex',file));
 const turn=JSON.parse(bytes).definitions.Turn;
 for(const field of ['startedAt','completedAt','durationMs']){assert.deepEqual(turn.properties[field].type,['integer','null']);assert.equal(turn.properties[field].format,'int64');}
 runtime[file]=sha(bytes);
}
const lockPath='compatibility/native-turn-timing/source.lock.json';
const base=check?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
execFileSync('git',['cat-file','-e',`${base}^{commit}`],{cwd:root});
const sources=[source,'scripts/generate-native-turn-timing.mjs','scripts/sync-native-turn-timing.mjs', 'scripts/scheduled-consumer-source.mjs','go.mod','go.sum','package.json','pnpm-lock.yaml'];
const lock={schema_version:1,contract_version:spec.info.version,mode:'local_candidate',release:false,repository:'https://github.com/36Dge/yijie-contracts.git',base_commit:base,
 sources:sources.map(path=>({path,sha256:sha(read(path))})),generated:[...outputs].map(([path,bytes])=>({path,sha256:sha(bytes)})),
 runtime:{upstream_commit:'5d1fbf26c43abc65a203928b2e31561cb039e06d',experimental_api:false,canonical_files:runtime},
 generators:{go:'oapi-codegen/v2@v2.7.2',typescript:'openapi-typescript@7.13.0',rust_jsonschema:'closed source-local native timing v1'}};
outputs.set(lockPath,JSON.stringify(lock,null,2)+'\n');
for(const [file,bytes]of outputs){const target=path.join(root,file);if(check)assert.deepEqual(readFileSync(target),Buffer.from(bytes),`Timing generation drift: ${file}`);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log('Native timing '+(check?'verified':'generated')+'; local candidate only.');
