// Independent source-first FEAT-157 candidate; existing family generators stay unchanged.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compile } from 'json-schema-to-typescript';
import Ajv from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import equal from 'ajv/dist/runtime/equal.js';
import {loadMarketSelectionSource} from './market-selection-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.argv.slice(2).every(x=>x==='--check'));
const check=process.argv.includes('--check');
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
const {manifest, names, documents, defs, schema}=loadMarketSelectionSource();
const q=JSON.stringify, snake=s=>s.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
const field=s=>s==='type'?'r#type':snake(s);
const pascal=s=>s.split(/[_-]/).map(x=>x[0].toUpperCase()+x.slice(1)).join('');
const resolved=s=>s.$ref?defs[s.$ref.split('/').at(-1)]:s;
const banner='// Generated from market-selection source; DO NOT EDIT.\n';
// Reuse the actual generated consumer types for pre-existing concepts.
const borrowed=new Set(['SelectionRef','ProfileId']);
let rust=banner+'use serde::{Serialize,Deserialize};\nuse sha2::{Digest,Sha256};\npub use super::generated::SelectionRef;\npub use crate::chat::models_generated::ProfileId;\n';
rust+='fn optional_non_null<\'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<\'de>,T:Deserialize<\'de>{T::deserialize(d).map(Some)}\n';
rust+='fn required_nullable<\'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<\'de>,T:Deserialize<\'de>{Option::<T>::deserialize(d)}\n';
rust+='fn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36&&s!="00000000-0000-0000-0000-000000000000"&&b.iter().enumerate().all(|(i,c)|if [8,13,18,23].contains(&i){*c==b\'-\'}else{c.is_ascii_digit()||(*c>=b\'a\'&&*c<=b\'f\')})}\n';
function type(s){
 if(s.$ref)return s.$ref.split('/').at(-1);
 if(s.anyOf){assert.equal(s.anyOf.length,2);assert.equal(s.anyOf[1].type,'null');return `Option<${type(s.anyOf[0])}>`;}
 if(s.type==='array')return `Vec<${type(s.items)}>`;
 return ({string:'String',integer:'i64',boolean:'bool'})[s.type??typeof s.const]??(()=>{throw Error(q(s));})();
}
function validation(s,exp){
 if(s.$ref){const n=s.$ref.split('/').at(-1);if(n==='Selection')return `validate_selection(${exp})?;`;if(n==='ProfileId')return '';if(resolved(s).type==='object'||resolved(s).oneOf)return `${exp}.validate()?;`;return validation(resolved(s),exp);}
 if(s.anyOf)return `${exp}.as_ref().map(|value|->Result<(),&'static str>{${validation(s.anyOf[0],'value')}Ok(())}).transpose()?;`;
 let out='';
 if(s.type==='array'){
  if(s.minItems!==undefined)out+=`if ${s.minItems===1?`${exp}.is_empty()`:`${exp}.len()<${s.minItems}`}{return Err("invalid selection array");}`;
  if(s.maxItems!==undefined)out+=`if ${exp}.len()>${s.maxItems}{return Err("invalid selection array");}`;
  out+=`for value in ${exp}.iter(){${validation(s.items,'value')}}`;
 }else if(s.type==='string'||typeof s.const==='string'){
  if(s.minLength>0)out+=`if ${exp}.chars().count()<${s.minLength}{return Err("invalid selection text");}`;
  if(s.maxLength!==undefined)out+=`if ${exp}.chars().count()>${s.maxLength}{return Err("invalid selection text");}`;
  if(s.format==='uuid')out+=`if !canonical_id(${exp}){return Err("invalid selection UUID");}`;
  if(s.const!==undefined)out+=`if ${exp}!=${q(s.const)}{return Err("invalid selection constant");}`;
  if(s.pattern==='\\S')out+=`if ${exp}.trim().is_empty(){return Err("blank selection input");}`;
  else if(s.pattern==='^[0-9a-f]{64}$')out+=`if ${exp}.len()!=64||!${exp}.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid selection digest");}`;
  else if(s.pattern)assert.equal(s.format,'uuid');
 }else if(s.type==='integer'){
  if(s.minimum!==undefined)out+=`if *${exp}<${s.minimum}{return Err("invalid selection integer");}`;
  if(s.maximum!==undefined)out+=`if *${exp}>${s.maximum}{return Err("invalid selection integer");}`;
  if(s.const!==undefined)out+=`if *${exp}!=${s.const}{return Err("invalid selection constant");}`;
 }
 return out;
}
for(const name of names){
 if(borrowed.has(name))continue;const s=defs[name];
 if(s.enum){rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]pub enum ${name}{${s.enum.map(v=>`#[serde(rename=${q(v)})]${pascal(v)},`).join('')}}\n`;continue;}
 if(s.oneOf){
  // Variant identity comes from the source discriminator, while the payload
  // retains its source definition name. Avoid repeating the Input suffix.
  const variant=v=>pascal(resolved(v).properties.type.const);
  rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(untagged)]pub enum ${name}{${s.oneOf.map(v=>`${variant(v)}(${type(v)}),`).join('')}}\nimpl ${name}{pub fn validate(&self)->Result<(),&'static str>{match self{${s.oneOf.map(v=>`Self::${variant(v)}(v)=>v.validate(),`).join('')}}}}\n`;
 }else if(s.type==='object'){
  const fields=Object.entries(s.properties),fieldsCode=fields.map(([f,v])=>`${!s.required.includes(f)?'#[serde(default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null")]':v.anyOf?'#[serde(deserialize_with="required_nullable")]':''}pub ${field(f)}:${s.required.includes(f)?type(v):`Option<${type(v)}>`},`).join('\n');
  rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(rename_all="camelCase",try_from="${name}Wire")]pub struct ${name}{${fieldsCode}}\n#[derive(Deserialize)]#[serde(rename_all="camelCase"${s.additionalProperties===false?',deny_unknown_fields':''})]struct ${name}Wire{${fieldsCode}}\nimpl TryFrom<${name}Wire> for ${name}{type Error=&'static str;fn try_from(w:${name}Wire)->Result<Self,Self::Error>{let v=Self{${fields.map(([f])=>`${field(f)}:w.${field(f)}`).join(',')}};v.validate()?;Ok(v)}}\nimpl ${name}{pub fn validate(&self)->Result<(),&'static str>{`;
  for(const[f,v]of fields){const e=`value_${snake(f)}`,rules=validation(v,e);if(rules)rust+=s.required.includes(f)?`{let ${e}=&self.${field(f)};${rules}}`:`self.${field(f)}.as_ref().map(|${e}|->Result<(),&'static str>{${rules}Ok(())}).transpose()?;`;}
  if(name==='SubmitPayload')rust+='if self.session_id.is_some()&&self.project_id.is_some(){return Err("existing session cannot change project");}if self.content_blocks.iter().filter(|b|!matches!(b,ContentBlock::Text(_))).count()>10{return Err("too many attachment references");}';
  if(name==='SelectionSnapshot')rust+='if self.selection.windows(2).any(|w|w[0].installation_id>=w[1].installation_id){return Err("selection snapshot is not canonical");}if selection_digest(&self.turn_operation_id,&self.selection)?!=self.selection_digest{return Err("selection snapshot digest mismatch");}';
  rust+='Ok(())}}\n';
 }else{rust+=`pub type ${name}=${type(s)};\n`;continue;}
 rust+=`impl std::fmt::Debug for ${name}{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("${name}([redacted])")}}\n`;
}
const policy=manifest.selection_digest;assert.equal(policy.version,1);assert.equal(policy.algorithm,'sha256');assert.equal(policy.uniqueKey,'installationId');
assert.equal(policy.sort,'installationId ASCII ascending');assert.equal(policy.trailingLf,true);
assert.equal(policy.safeIntegerMaximum,9007199254740991);
assert.deepEqual(policy.lines,['domain','canonical actual turnOperationId','decimal count','each sorted installationId + ASCII SPACE + decimal revision + ASCII SPACE + decimal generation']);
rust+=`pub fn validate_selection(refs:&[SelectionRef])->Result<(),&'static str>{if refs.len()>${policy.maxItems}{return Err("too many connector references");}for(i,r)in refs.iter().enumerate(){r.validate()?;if refs[..i].iter().any(|p|p.installation_id==r.installation_id){return Err("duplicate connector installation");}}Ok(())}\n`;
rust+=`pub fn canonical_selection_bytes(turn_operation_id:&str,refs:&[SelectionRef])->Result<Vec<u8>,&'static str>{if !canonical_id(turn_operation_id){return Err("invalid turn operation UUID");}validate_selection(refs)?;let mut sorted=refs.iter().collect::<Vec<_>>();sorted.sort_by(|a,b|a.installation_id.cmp(&b.installation_id));let mut text=format!("${policy.domain}\\n{}\\n{}\\n",turn_operation_id,sorted.len());for r in sorted{text.push_str(&format!("{} {} {}\\n",r.installation_id,r.revision,r.generation));}Ok(text.into_bytes())}\n`;
rust+='pub fn selection_digest(turn_operation_id:&str,refs:&[SelectionRef])->Result<String,&\'static str>{Ok(format!("{:x}",Sha256::digest(canonical_selection_bytes(turn_operation_id,refs)?)))}\n';
rust+='pub fn freeze_selection(turn_operation_id:String,mut selection:Vec<SelectionRef>)->Result<SelectionSnapshot,&\'static str>{let digest=selection_digest(&turn_operation_id,&selection)?;selection.sort_by(|a,b|a.installation_id.cmp(&b.installation_id));Ok(SelectionSnapshot{schema_version:1,turn_operation_id,selection,selection_digest:digest})}\n';

// Browser structural validators use the existing pinned AJV standalone pipeline.
const ajv=new Ajv({strict:true,allErrors:true,inlineRefs:false,code:{source:true,esm:true,optimize:true}});
ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);ajv.addSchema(schema);
const exports=Object.fromEntries(names.map(n=>['validate'+n,schema.$id+'#/$defs/'+n]));for(const ref of Object.values(exports))ajv.getSchema(ref);
const runtimeRequire=createRequire(import.meta.resolve('ajv/dist/runtime/equal.js'));
const notices=['ajv','fast-deep-equal'].map(n=>readFileSync(path.join(path.dirname(runtimeRequire.resolve(n+'/package.json')),'LICENSE'),'utf8')).join('\n\n');
const validators=banner+'/* Bundled helper license notices:\n'+notices+'\n*/\n'+standaloneCode(ajv,exports).replaceAll('require("ajv/dist/runtime/ucs2length").default','('+ucs2length.default.toString()+')').replaceAll('require("ajv/dist/runtime/equal").default','('+equal.default.toString()+')');assert.ok(!validators.includes('require('));
// Conditional and size rules stay in generated validators; type projection has
// source $defs names (not borrowed documentation titles) and ordinary arrays.
function tsProjection(v){if(Array.isArray(v))return v.map(tsProjection);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='title'&&k!=='allOf').map(([k,x])=>[k,tsProjection(x)]));}
const ts=await compile({...tsProjection(schema),anyOf:names.map(n=>({$ref:'#/$defs/'+n}))},'MarketSelectionTypes',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true,ignoreMinAndMaxItems:true});
const outputs=new Map([
 ['sdks/rust/market-selection/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/typescript/src/domain/market-selection.generated.ts',ts],
 ['sdks/typescript/src/api/generated/market-selection-validator.gen.js',validators],
 ['sdks/jsonschema/market-selection.schema.json',q(schema,null,2)+'\n'],
]);
const go=banner+`package marketselection
import("crypto/sha256";"errors";"fmt";"sort";"strings";market "github.com/36Dge/yijie-contracts/sdks/go/market-connectors")
// SelectionRef remains the existing generated authority, not a shadow DTO.
type SelectionRef=market.SelectionRef
func CanonicalSelectionBytes(turnOperationID string,refs []SelectionRef)([]byte,error){
 if err:=market.CanonicalId(turnOperationID).Validate();err!=nil{return nil,err}
 if len(refs)>${policy.maxItems}{return nil,errors.New("too many connector references")}
 sorted:=append([]SelectionRef(nil),refs...);sort.Slice(sorted,func(i,j int)bool{return sorted[i].InstallationId<sorted[j].InstallationId})
 var text strings.Builder;fmt.Fprintf(&text,"${policy.domain}\\n%s\\n%d\\n",turnOperationID,len(sorted))
 for i,r:=range sorted{if err:=r.Validate();err!=nil{return nil,err};if i>0&&sorted[i-1].InstallationId==r.InstallationId{return nil,errors.New("duplicate connector installation")};fmt.Fprintf(&text,"%s %d %d\\n",r.InstallationId,r.Revision,r.Generation)}
 return []byte(text.String()),nil
}
func SelectionDigest(turnOperationID string,refs []SelectionRef)(string,error){b,err:=CanonicalSelectionBytes(turnOperationID,refs);if err!=nil{return "",err};return fmt.Sprintf("%x",sha256.Sum256(b)),nil}
`;
outputs.set('sdks/go/market-selection/digest.gen.go',execFileSync('gofmt',[],{input:go}));
let dts=banner+'import type * as T from "../../domain/market-selection.generated.js";\nexport interface Validator<T>{(value:unknown):value is T;errors?:unknown;}\n';for(const n of names)dts+=`export declare const validate${n}:Validator<T.${n}>;\n`;outputs.set('sdks/typescript/src/api/generated/market-selection-validator.gen.d.ts',dts);
const vectors=[{name:'empty',turnOperationId:'00000000-0000-4000-8000-000000000157',selection:[]},{name:'two_unsorted',turnOperationId:'00000000-0000-4000-8000-000000000158',selection:[{installationId:'00000000-0000-4000-8000-000000000160',revision:9007199254740991,generation:3},{installationId:'00000000-0000-4000-8000-000000000159',revision:1,generation:2}]}].map(v=>{const canonicalText=policy.domain+'\n'+v.turnOperationId+'\n'+v.selection.length+'\n'+[...v.selection].sort((a,b)=>a.installationId<b.installationId?-1:1).map(r=>`${r.installationId} ${r.revision} ${r.generation}\n`).join('');return {...v,canonicalText,selectionDigest:createHash('sha256').update(canonicalText).digest('hex')};});
outputs.set('fixtures/market-selection/digest-vectors.json',q(vectors,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex'),lockPath='compatibility/market-selection/source.lock.json';
const base=existsSync(path.join(root,lockPath))?read(lockPath).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sources=[...documents.keys(),'scripts/market-selection-source.mjs','scripts/generate-market-selection.mjs','scripts/sync-market-selection.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,q({schema_version:1,contract_version:manifest.contract_version,feature:'FEAT-157',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const target=path.join(root,p);if(check)assert.deepEqual(readFileSync(target),Buffer.from(b),p);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,b);}}
console.log(`Market selection ${check?'checked':'generated'}; ${names.length} source definitions, one disabled Native submit candidate; no Host route or execution authority.`);
