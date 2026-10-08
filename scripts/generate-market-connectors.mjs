// Independent FEAT-157 canonical generator. Does not call legacy generators.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createRequire} from 'node:module';
import Ajv from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import equal from 'ajv/dist/runtime/equal.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--check'), 'Only --check supported');
const check = args.includes('--check');
const sourcePath = 'openapi/market-connectors/market-connectors.yaml';
const spec = JSON.parse(readFileSync(path.join(root, sourcePath)));
assert.equal(spec.info.version, '0.2.0');
assert.deepEqual(spec.paths, {});
const defs = spec.components.schemas;
const entries = Object.entries(defs);
const pascal = s => s.split(/[_.-]/).map(w => w[0].toUpperCase() + w.slice(1)).join('');
const snake = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const q = JSON.stringify;
const resolve = s => s.$ref ? defs[s.$ref.split('/').at(-1)] : s;
function type(s, language) {
  if (s.$ref) return s.$ref.split('/').at(-1);
  if (s.type === 'array') return language === 'rust' ? `Vec<${type(s.items, language)}>` : language === 'go' ? `[]${type(s.items, language)}` : `Array<${type(s.items, language)}>`;
  if (language === 'ts' && s.const !== undefined) return q(s.const);
  return ({ string: { rust:'String',go:'string',ts:'string' }, integer:{rust:'i64',go:'int64',ts:'number'}, boolean:{rust:'bool',go:'bool',ts:'boolean'} })[s.type]?.[language] ?? (() => { throw Error('Unsupported source type: '+q(s)); })();
}
function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,k === '$ref' ? v.replace('#/components/schemas/','#/$defs/') : project(v)]));
}
const schema = { $schema:'https://json-schema.org/draft/2020-12/schema', $id:'https://schemas.yijie.ai/market-connectors/native-ipc/v1', title:'Market connectors native IPC v1', $defs:project(defs) };
const banner = '// Generated from market-connectors source; DO NOT EDIT.\n';
const permissions = defs.Permission.enum;
let ts = banner + `export const CONNECTOR_CAPABILITIES = ${q(permissions)} as const;\n`;
let rust = banner + `use serde::{Serialize, Deserialize};\nfn optional_non_null<'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<'de>,T:Deserialize<'de>{T::deserialize(d).map(Some)}\nfn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36 && s!="00000000-0000-0000-0000-000000000000" && b.iter().enumerate().all(|(i,c)| if [8,13,18,23].contains(&i){*c==b'-'}else{c.is_ascii_digit()||(*c>=b'a'&&*c<=b'f')})}\nfn catalog_identifier(s:&str)->bool{let b=s.as_bytes();!b.is_empty() && b[0].is_ascii_alphanumeric() && b.iter().all(|c| c.is_ascii_alphanumeric() || *c==b'_' || *c==b'-')}\npub const CONNECTOR_CAPABILITIES: [&str; 4] = [${permissions.map(q).join(',')}];\n`;
let go = banner + 'package marketconnectors\nimport("bytes";"encoding/json";"errors";"io";"regexp";"unicode/utf8")\n';
go += `var ConnectorCapabilities = []Permission{${permissions.map(v => 'Permission'+pascal(v)).join(',')}}\n`;
let patternIndex=0;
const patterns=new Map();
for (const [,s] of entries) if(s.pattern && !patterns.has(s.pattern))patterns.set(s.pattern, `pattern${patternIndex++}`);
for(const [p,n] of patterns) go+=`var ${n}=regexp.MustCompile(${q(p)})\n`;
function rustCheck(schema,expression,optional=false){
 const s=resolve(schema);let result='';
 if(s.type==='object')return `${expression}.validate()?;\n`;
 if(s.type==='array') {
  if(s.minItems!==undefined)result+=`if ${expression}.len()<${s.minItems}{return Err("invalid connector array length");}\n`;
  if(s.maxItems!==undefined)result+=`if ${expression}.len()>${s.maxItems}{return Err("invalid connector array length");}\n`;
  if(s.uniqueItems)result+=`for (i,v) in ${expression}.iter().enumerate(){if ${expression}[..i].contains(v){return Err("duplicate connector value");}}\n`;
  const child=rustCheck(s.items,'item');if(child)result+=`for item in ${expression}.iter(){${child}}\n`;
  return result;
 }
 if(s.enum)return '';
 if(s.type==='string') {
  if(s.minLength>0)result+=`if ${expression}.chars().count()<${s.minLength}{return Err("invalid connector text length");}\n`;
  if(s.maxLength!==undefined)result+=`if ${expression}.chars().count()>${s.maxLength}{return Err("invalid connector text length");}\n`;
  if(s.const!==undefined)result+=`if ${expression}!=${q(s.const)}{return Err("invalid connector constant");}\n`;
  if(s.format==='uuid')result+=`if !canonical_id(${expression}){return Err("invalid connector UUID");}\n`;
  if(s.pattern && s.format!=='uuid') {assert.equal(s.pattern,'^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$');result+=`if !catalog_identifier(${expression}){return Err("invalid connector identifier");}\n`;}
 } else if(s.type==='integer'||s.type==='boolean') {
  if(s.minimum!==undefined)result+=`if *${expression}<${s.minimum}{return Err("invalid connector number");}\n`;
  if(s.maximum!==undefined)result+=`if *${expression}>${s.maximum}{return Err("invalid connector number");}\n`;
  if(s.const!==undefined)result+=`if ${typeof s.const==='boolean'?(s.const?'!':'')+'*'+expression:'*'+expression+'!='+q(s.const)}{return Err("invalid connector constant");}\n`;
 }
 return result;
}
function goCheck(s,expression){
 if(s.$ref)return `if err:=${expression}.Validate();err!=nil{return err};\n`;
 let out='';
 if(s.type==='array') {
  out+=`if ${expression}==nil{return errors.New("null connector array")};\n`;
  if(s.minItems!==undefined)out+=`if len(${expression})<${s.minItems}{return errors.New("invalid connector array length")};\n`;
  if(s.maxItems!==undefined)out+=`if len(${expression})>${s.maxItems}{return errors.New("invalid connector array length")};\n`;
  if(s.uniqueItems)out+=`for i,uniqueItem:=range ${expression}{for _,prior:=range ${expression}[:i]{if uniqueItem==prior{return errors.New("duplicate connector value")}}};\n`;
  out+=`for _,item:=range ${expression}{${goCheck(s.items,'item')}};\n`;
 }else if(s.type==='string'){
  if(s.minLength>0)out+=`if utf8.RuneCountInString(string(${expression}))<${s.minLength}{return errors.New("invalid connector text length")};\n`;
  if(s.maxLength!==undefined)out+=`if utf8.RuneCountInString(string(${expression}))>${s.maxLength}{return errors.New("invalid connector text length")};\n`;
  if(s.const!==undefined)out+=`if string(${expression})!=${q(s.const)}{return errors.New("invalid connector constant")};\n`;
  if(s.pattern)out+=`if !${patterns.get(s.pattern)}.MatchString(string(${expression})){return errors.New("invalid connector identifier")};\n`;
  if(s.not?.const)out+=`if string(${expression})==${q(s.not.const)}{return errors.New("invalid connector UUID")};\n`;
 }else if(s.type==='integer'||s.type==='boolean'){
  if(s.minimum!==undefined)out+=`if ${expression}<${s.minimum}{return errors.New("invalid connector number")};\n`;
  if(s.maximum!==undefined)out+=`if ${expression}>${s.maximum}{return errors.New("invalid connector number")};\n`;
  if(s.const!==undefined)out+=`if ${expression}!=${q(s.const)}{return errors.New("invalid connector constant")};\n`;
 }
 return out;
}
for(const [name,s] of entries){
 if(s.enum){
  ts+=`export type ${name} = ${s.enum.map(q).join(' | ')};\n`;
  rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)] pub enum ${name}{${s.enum.map(v=>`#[serde(rename=${q(v)})] ${pascal(name==='Permission'?v.replace(/^connector\./,''):v)},`).join('')}}\n`;
  go+=`type ${name} string\nconst(\n${s.enum.map(v=>`${name}${pascal(v)} ${name}=${q(v)}`).join('\n')}\n)\nfunc(v ${name})Validate()error{switch v{case ${s.enum.map(v=>`${name}${pascal(v)}`).join(',')}:return nil;default:return errors.New("invalid connector enum")}}\nfunc(v *${name})UnmarshalJSON(b []byte)error{var s string;if err:=json.Unmarshal(b,&s);err!=nil{return errors.New("invalid connector enum")};x:=${name}(s);if err:=x.Validate();err!=nil{return err};*v=x;return nil}\n`;
 }else if(s.type==='object'){
  const fields=Object.entries(s.properties);
  ts+=fields.length===0&&s.additionalProperties===false?`export type ${name}=Record<string,never>;\n`:`export interface ${name}{\n${fields.map(([f,v])=>`${f}${s.required.includes(f)?'':'?'}:${type(v,'ts')};`).join('\n')}\n}\n`;
  const rustFields=fields.map(([f,v])=>{const required=s.required.includes(f);return `${required?'':'#[serde(default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null")]'}pub ${snake(f)}:${required?type(v,'rust'):`Option<${type(v,'rust')}>`},`;}).join('\n');
  rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(rename_all="camelCase",try_from="${name}Wire")]pub struct ${name}{${rustFields}}\n#[derive(Deserialize)]#[serde(rename_all="camelCase"${s.additionalProperties===false?',deny_unknown_fields':''})]struct ${name}Wire{${rustFields}}\nimpl TryFrom<${name}Wire> for ${name}{type Error=&'static str;fn try_from(${fields.length?'w':'_w'}:${name}Wire)->Result<Self,Self::Error>{let v=Self{${fields.map(([f])=>`${snake(f)}:w.${snake(f)}`).join(',')}};v.validate()?;Ok(v)}}\nimpl ${name}{pub fn validate(&self)->Result<(),&'static str>{\n`;
  for(const [f,v]of fields){const expr=`value_${snake(f)}`;const checks=rustCheck(v,expr);if(checks)rust+=s.required.includes(f)?`{let ${expr}=&self.${snake(f)};${checks}}\n`:`self.${snake(f)}.as_ref().map(|${expr}| -> Result<(), &'static str> {${checks}Ok(())}).transpose()?;\n`;}
  rust+=`Ok(())}}\nimpl std::fmt::Debug for ${name}{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("${name}([redacted])")}}\n`;
  go+=`type ${name} struct{\n${fields.map(([f,v])=>`${pascal(f)} ${s.required.includes(f)?'':'*'}${type(v,'go')} \`json:"${f}${s.required.includes(f)?'':',omitempty'}"\``).join('\n')}\n}\nfunc(v ${name})Validate()error{\n`;
  for(const[f,v]of fields){const exp=`v.${pascal(f)}`;go+=s.required.includes(f)?goCheck(v,exp):`if ${exp}!=nil{${goCheck(v,`(*${exp})`)}};\n`;}
  go+=`return nil}\nfunc(v *${name})UnmarshalJSON(b []byte)error{type wire ${name};var raw map[string]json.RawMessage;if err:=json.Unmarshal(b,&raw);err!=nil||raw==nil{return errors.New("invalid connector object")};\n`;
  for(const[f]of fields){if(s.required.includes(f))go+=`if _,ok:=raw[${q(f)}];!ok{return errors.New("missing connector field")};\n`;go+=`if value,ok:=raw[${q(f)}];ok&&bytes.Equal(bytes.TrimSpace(value),[]byte("null")){return errors.New("null connector field")};\n`;}
  go+=`var w wire;d:=json.NewDecoder(bytes.NewReader(b));${s.additionalProperties===false?'d.DisallowUnknownFields();':''}if err:=d.Decode(&w);err!=nil{return errors.New("invalid connector object")};if err:=d.Decode(new(any));err!=io.EOF{return errors.New("invalid connector object")};x:=${name}(w);if err:=x.Validate();err!=nil{return err};*v=x;return nil}\n`;
 }else{
  ts+=`export type ${name} = ${type(s,'ts')};\n`;
  rust+=`pub type ${name}=${type(s,'rust')};\n`;
  go+=`type ${name} ${type(s,'go')}\nfunc(v ${name})Validate()error{${goCheck(s,'v')}return nil}\n`;
 }
}
ts+=`export const MARKET_CONNECTOR_IPC = ${q(spec['x-native-ipc'].commands)} as const;\n`;
ts+='export interface IpcRequestMap{\n'+spec['x-native-ipc'].commands.map(c=>`${q(c.command)}:${c.request};`).join('\n')+'\n}\n';
ts+='export interface IpcResponseMap{\n'+spec['x-native-ipc'].commands.map(c=>`${q(c.command)}:${c.response};`).join('\n')+'\n}\n';
const ajv=new Ajv({allErrors:true,strict:true,inlineRefs:false,code:{source:true,esm:true,lines:true,optimize:true}});
ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addSchema(schema);
const exportNames=Object.fromEntries(entries.map(([name])=>[`validate${name}`,`${schema.$id}#/$defs/${name}`]));
for(const ref of Object.values(exportNames))ajv.getSchema(ref);
// Bundle the exact pinned Ajv helper functions mechanically; no handwritten decoder.
const runtimeRequire=createRequire(import.meta.resolve('ajv/dist/runtime/equal.js'));
const notices=[readFileSync(path.join(path.dirname(runtimeRequire.resolve('ajv/package.json')),'LICENSE'),'utf8'),readFileSync(path.join(path.dirname(runtimeRequire.resolve('fast-deep-equal/package.json')),'LICENSE'),'utf8')].map(x=>x.toString()).join('\n\n');
const validators=banner+'/* Bundled helper license notices:\n'+notices+'\n*/\n'+standaloneCode(ajv,exportNames)
 .replaceAll('require("ajv/dist/runtime/ucs2length").default', '('+ucs2length.default.toString()+')')
 .replaceAll('require("ajv/dist/runtime/equal").default', '('+equal.default.toString()+')');
assert.ok(!validators.includes('require('),'Standalone validators must have no runtime require/dependency');
let dts=banner+'import type * as T from "../../domain/market-connectors.generated.js";\nexport interface ValidationIssue{instancePath:string;schemaPath:string;keyword:string;params:Record<string,unknown>;message?:string;}\nexport interface SchemaValidator<T>{(data:unknown):data is T;errors?:ValidationIssue[]|null;}\n';
for(const [name]of entries)dts+=`export declare const validate${name}:SchemaValidator<T.${name}>;\n`;
const outputs=new Map([
 ['sdks/go/market-connectors/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/rust/market-connectors/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/typescript/src/domain/market-connectors.generated.ts',ts],
 ['sdks/typescript/src/api/generated/market-connectors-validator.gen.js',validators],
 ['sdks/typescript/src/api/generated/market-connectors-validator.gen.d.ts',dts],
 ['sdks/jsonschema/market-connectors.schema.json',JSON.stringify(schema,null,2)+'\n'],
]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const lockPath='compatibility/market-connectors/source.lock.json';
const lockFile=path.join(root,lockPath);
const base=existsSync(lockFile)?JSON.parse(readFileSync(lockFile)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.match(base,/^[0-9a-f]{40}$/);execFileSync('git',['cat-file','-e',`${base}^{commit}`],{cwd:root});
const sources=[sourcePath,'scripts/generate-market-connectors.mjs','scripts/sync-market-connectors.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,JSON.stringify({schema_version:1,contract_version:spec.info.version,feature:'FEAT-157',mode:'local_worktree_candidate',release:false,repository:'https://github.com/36Dge/yijie-contracts.git',base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)})),generators:{types:'market-connectors source-local schema subset v1',validators:'Ajv 8.20.0 standalone ESM; no runtime dependency'}},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Market connectors ${check?'generation verified':'generated'}: ${entries.length} definitions, ${spec['x-native-ipc'].commands.length} IPC commands; local candidate only.`);
