// Source-local projection helpers for the private Broker family. The supported
// subset deliberately mirrors the existing market generator, without changing
// its pinned source or importing a generator for its side effects.
import assert from 'node:assert/strict';

const q=JSON.stringify;
export const pascal=s=>s.split(/[^a-zA-Z0-9]+/).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const snake=s=>s.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
const rustField=s=>s==='type'?'r#type':snake(s);

export function projectTypes(defs,names,{rustImports='',goImports='',goPackage='marketbroker',aliases={},rules={}}={}){
 const resolved=s=>s.$ref?defs[s.$ref.split('/').at(-1)]:s;
 const type=(s,lang)=>{
  if(s.$ref)return s.$ref.split('/').at(-1);
  if(s.anyOf){assert.equal(s.anyOf.length,2);assert.equal(s.anyOf[1].type,'null');return lang==='rust'?`Option<${type(s.anyOf[0],lang)}>`:`*${type(s.anyOf[0],lang)}`;}
  if(s.type==='array')return lang==='rust'?`Vec<${type(s.items,lang)}>`:`[]${type(s.items,lang)}`;
  const t=({string:{rust:'String',go:'string'},integer:{rust:'i64',go:'int64'},boolean:{rust:'bool',go:'bool'}})[s.type]?.[lang];
  assert.ok(t,'Unsupported source schema '+q(s));return t;
 };
 const patterns=new Map();
 function collect(v){if(!v||typeof v!=='object')return;if(v.pattern&&!patterns.has(v.pattern))patterns.set(v.pattern,'wirePattern'+patterns.size);for(const c of Object.values(v))collect(c);}
 for(const n of names)collect(defs[n]);
 let rust='use serde::{Serialize,Deserialize};\n'+rustImports+'\n';
 rust+="fn optional_non_null<'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<'de>,T:Deserialize<'de>{T::deserialize(d).map(Some)}\n";
 rust+="fn required_nullable<'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<'de>,T:Deserialize<'de>{Option::<T>::deserialize(d)}\n";
 let go=`package ${goPackage}\nimport("bytes";"encoding/json";"errors";"io";"regexp";"unicode/utf8";${goImports})\n`;
 for(const[p,n]of patterns)go+=`var ${n}=regexp.MustCompile(${q(p)})\n`;
 function rCheck(s,e){
  if(s.$ref){const n=s.$ref.split('/').at(-1);if(aliases[n]?.rustValidate)return aliases[n].rustValidate(e);if(resolved(s).type==='object')return `${e}.validate()?;`;if(resolved(s).enum)return '';return rCheck(resolved(s),e);}
  if(s.anyOf)return `${e}.as_ref().map(|value|->Result<(),&'static str>{${rCheck(s.anyOf[0],'value')}Ok(())}).transpose()?;`;
  if(s.enum)return `if ![${s.enum.map(q).join(',')}].contains(&${e}.as_str()){return Err("invalid broker enum");}`;
  let out='';
  if(s.type==='array'){
   if(s.minItems)out+=`if ${s.minItems===1?e+'.is_empty()':e+'.len()<'+s.minItems}{return Err("invalid broker collection");}`;
   if(s.maxItems!==undefined)out+=`if ${e}.len()>${s.maxItems}{return Err("invalid broker collection");}`;
   const child=rCheck(s.items,'item');if(child)out+=`for item in ${e}.iter(){${child}}`;
   if(s.uniqueItems)out+=`for(i,item)in ${e}.iter().enumerate(){if ${e}[..i].contains(item){return Err("duplicate broker collection item");}}`;
  }else if(s.type==='string'){
   if(s.minLength)out+=`if ${e}.chars().count()<${s.minLength}{return Err("invalid broker text");}`;
   if(s.maxLength!==undefined)out+=`if ${e}.chars().count()>${s.maxLength}{return Err("invalid broker text");}`;
   if(s.const!==undefined)out+=`if ${e}!=${q(s.const)}{return Err("invalid broker constant");}`;
   if(s.pattern){
    const patternRule=rules.patterns?.[s.pattern];assert.ok(patternRule,'Unregistered Rust pattern '+s.pattern);out+=patternRule(e);
   }
   if(s.not?.const)out+=`if ${e}==${q(s.not.const)}{return Err("invalid broker identity");}`;
   if(s.not?.enum)out+=`if [${s.not.enum.map(q).join(',')}].contains(&${e}.as_str()){return Err("invalid excluded value");}`;
   if(s.format&&!s.pattern&&rules.rustFormats?.[s.format])out+=rules.rustFormats[s.format](e);
  }else if(s.type==='integer'||s.type==='boolean'){
   if(s.minimum!==undefined)out+=`if *${e}<${s.minimum}{return Err("invalid broker number");}`;
   if(s.maximum!==undefined)out+=`if *${e}>${s.maximum}{return Err("invalid broker number");}`;
   if(s.const!==undefined)out+=`if ${typeof s.const==='boolean'?(s.const?'!':'')+'*'+e:'*'+e+'!='+q(s.const)}{return Err("invalid broker constant");}`;
  }else assert.fail('Unsupported Rust validation schema '+q(s));
  return out;
 }
 function gCheck(s,e){
  if(s.$ref){const n=s.$ref.split('/').at(-1);if(aliases[n]?.goValidate)return aliases[n].goValidate(e);return `if err:=${e}.Validate();err!=nil{return err};`;}
  if(s.anyOf)return `if ${e}!=nil{${gCheck(s.anyOf[0],'(*'+e+')')}};`;
  if(s.enum)return `switch string(${e}){case ${s.enum.map(q).join(',')}:default:return errors.New("invalid broker enum")};`;
  let out='';
  if(s.type==='array'){
   out+=`if ${e}==nil{return errors.New("null broker collection")};`;
   if(s.minItems)out+=`if len(${e})<${s.minItems}{return errors.New("invalid broker collection")};`;
   if(s.maxItems!==undefined)out+=`if len(${e})>${s.maxItems}{return errors.New("invalid broker collection")};`;
   const child=gCheck(s.items,'item');if(child)out+=`for _,item:=range ${e}{${child}};`;
   if(s.uniqueItems)out+=`for i,item:=range ${e}{for _,prior:=range ${e}[:i]{if item==prior{return errors.New("duplicate broker collection item")}}};`;
  }else if(s.type==='string'){
   if(s.minLength)out+=`if utf8.RuneCountInString(string(${e}))<${s.minLength}{return errors.New("invalid broker text")};`;
   if(s.maxLength!==undefined)out+=`if utf8.RuneCountInString(string(${e}))>${s.maxLength}{return errors.New("invalid broker text")};`;
   if(s.pattern)out+=`if !${patterns.get(s.pattern)}.MatchString(string(${e})){return errors.New("invalid broker pattern")};`;
   if(s.not?.const)out+=`if string(${e})==${q(s.not.const)}{return errors.New("invalid broker identity")};`;
   if(s.not?.enum)out+=`switch string(${e}){case ${s.not.enum.map(q).join(',')}:return errors.New("invalid excluded value")};`;
   if(s.format&&!s.pattern&&rules.goFormats?.[s.format])out+=rules.goFormats[s.format](e);
   if(s.const!==undefined)out+=`if string(${e})!=${q(s.const)}{return errors.New("invalid broker constant")};`;
  }else if(s.type==='integer'||s.type==='boolean'){
   if(s.minimum!==undefined)out+=`if ${e}<${s.minimum}{return errors.New("invalid broker number")};`;
   if(s.maximum!==undefined)out+=`if ${e}>${s.maximum}{return errors.New("invalid broker number")};`;
   if(s.const!==undefined)out+=`if ${e}!=${q(s.const)}{return errors.New("invalid broker constant")};`;
  }else assert.fail('Unsupported Go validation schema '+q(s));
  return out;
 }
 for(const n of names){
  const s=defs[n];assert.ok(s);
  if(aliases[n]){rust+=aliases[n].rust+'\n';go+=aliases[n].go+'\n';continue;}
  if(s.$ref){const target=s.$ref.split('/').at(-1);rust+=`pub type ${n}=${target};\n`;go+=`type ${n}=${target}\n`;continue;}
  if(s.enum){
   rust+=`#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]pub enum ${n}{${s.enum.map(v=>`#[serde(rename=${q(v)})]${pascal(v)},`).join('')}}\n`;
   go+=`type ${n} string\nconst(${s.enum.map(v=>`${n}${pascal(v)} ${n}=${q(v)}`).join('\n')})\nfunc(v ${n})Validate()error{switch v{case ${s.enum.map(v=>n+pascal(v)).join(',')}:return nil;default:return errors.New("invalid broker enum")}}\nfunc(v *${n})UnmarshalJSON(b []byte)error{var s string;if err:=json.Unmarshal(b,&s);err!=nil{return errors.New("invalid broker enum")};x:=${n}(s);if err:=x.Validate();err!=nil{return err};*v=x;return nil}\n`;
  }else if(s.type==='object'){
   const fields=Object.entries(s.properties),required=new Set(s.required??[]);
   const fs=fields.map(([f,v])=>`${f.includes('_')?'#[serde(rename='+q(f)+')]':''}${required.has(f)?(v.anyOf?'#[serde(deserialize_with="required_nullable")]':''):'#[serde(default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null")]'}pub ${rustField(f)}:${required.has(f)?type(v,'rust'):`Option<${type(v,'rust')}>`},`).join('\n');
   rust+=`#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(rename_all="camelCase",try_from="${n}Wire")]pub struct ${n}{${fs}}\n#[derive(Deserialize)]#[serde(rename_all="camelCase"${s.additionalProperties===false?',deny_unknown_fields':''})]struct ${n}Wire{${fs}}\nimpl TryFrom<${n}Wire> for ${n}{type Error=&'static str;fn try_from(${fields.length?'w':'_w'}:${n}Wire)->Result<Self,Self::Error>{let v=Self{${fields.map(([f])=>`${rustField(f)}:w.${rustField(f)}`).join(',')}};v.validate()?;Ok(v)}}\nimpl ${n}{pub fn validate(&self)->Result<(),&'static str>{`;
   for(const[f,v]of fields){const e=`value_${snake(f)}`,checks=rCheck(v,e);if(checks)rust+=required.has(f)?`{let ${e}=&self.${rustField(f)};${checks}}`:`self.${rustField(f)}.as_ref().map(|${e}|->Result<(),&'static str>{${checks}Ok(())}).transpose()?;`;}
   rust+=(rules.rust?.[n]??'')+'Ok(())}}\n';
   rust+=`impl std::fmt::Debug for ${n}{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("${n}([redacted])")}}\n`;
   go+=`type ${n} struct{${fields.map(([f,v])=>`${pascal(f)} ${required.has(f)?'':'*'}${type(v,'go')} \`json:"${f}${required.has(f)?'':',omitempty'}"\``).join('\n')}}\nfunc(v ${n})Validate()error{`;
   for(const[f,v]of fields){const e='v.'+pascal(f);go+=required.has(f)?gCheck(v,e):`if ${e}!=nil{${gCheck(v,'(*'+e+')')}};`;}
   go+=(rules.go?.[n]??'')+'return nil}\n';
   go+=`func(v *${n})UnmarshalJSON(b []byte)error{type wire ${n};var raw map[string]json.RawMessage;if err:=json.Unmarshal(b,&raw);err!=nil||raw==nil{return errors.New("invalid broker object")};`;
   for(const[f,v]of fields){if(required.has(f))go+=`if _,ok:=raw[${q(f)}];!ok{return errors.New("missing broker field")};`;if(!v.anyOf)go+=`if x,ok:=raw[${q(f)}];ok&&bytes.Equal(bytes.TrimSpace(x),[]byte("null")){return errors.New("null broker field")};`;}
   go+=`var w wire;d:=json.NewDecoder(bytes.NewReader(b));${s.additionalProperties===false?'d.DisallowUnknownFields();':''}if err:=d.Decode(&w);err!=nil{return errors.New("invalid broker object")};if err:=d.Decode(new(any));err!=io.EOF{return errors.New("invalid broker object")};x:=${n}(w);if err:=x.Validate();err!=nil{return err};*v=x;return nil}\n`;
  }else{
   rust+=`pub type ${n}=${type(s,'rust')};\n`;
   go+=`type ${n} ${type(s,'go')}\nfunc(v ${n})Validate()error{${gCheck(s,'v')}${rules.go?.[n]??''}return nil}\n`;
  }
 }
 // Only import helpers used by this actual projection, keeping Go vet strict.
 for(const [name,ref]of [['bytes','bytes.'],['encoding/json','json.'],['errors','errors.'],['io','io.'],['regexp','regexp.'],['unicode/utf8','utf8.']])if(!go.includes(ref))go=go.replace(q(name)+';','');
 if(!rust.includes('deserialize_with="optional_non_null"'))rust=rust.replace(/fn optional_non_null[^\n]+\n/,'');
 if(!rust.includes('deserialize_with="required_nullable"'))rust=rust.replace(/fn required_nullable[^\n]+\n/,'');
 return {rust,go};
}
