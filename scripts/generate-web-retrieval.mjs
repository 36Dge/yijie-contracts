// Independent FEAT-162 source-first projection, with existing codegen/dependencies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {compile} from 'json-schema-to-typescript';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import equal from 'ajv/dist/runtime/equal.js';
import {fullFormats} from 'ajv-formats/dist/formats.js';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {projectTypes,pascal} from './market-broker-codegen.mjs';
import {loadWebRetrievalSource,root,sourcePath,manifestPath} from './web-retrieval-source.mjs';

const args=process.argv.slice(2);
assert.ok(args.length===0 || (args.length===1 && args[0]==='--check'));
const check=args.includes('--check');
const {schema,manifest,standalone,tools}=loadWebRetrievalSource();
const q=JSON.stringify, read=p=>readFileSync(path.join(root,p)), hash=b=>createHash('sha256').update(b).digest('hex');
const names=Object.keys(schema.$defs).filter(name=>!schema.$defs[name].oneOf);
const rules={patterns:{
  '\\S':e=>`if ${e}.trim().is_empty(){return Err("web retrieval text is blank");}`,
  '^[0-9]{4}(-[0-9]{2}){0,2}$':e=>`date_value(${e}).ok_or("invalid calendar date")?;`,
  '^[^\\s()]+$':e=>`if ${e}.chars().any(|c|c.is_whitespace()||c=='('||c==')'){return Err("invalid site");}`,
  '^https?://':e=>`if !(${e}.starts_with("http://")||${e}.starts_with("https://")){return Err("web retrieval URL requires HTTP(S)");}let parsed=url::Url::parse(${e}).map_err(|_|"invalid web retrieval URL")?;if parsed.host_str().is_none(){return Err("web retrieval URL requires host");}`,
},rust:{ContentResult:'let available=!self.text.trim().is_empty();if (self.content_status==ContentStatus::Available&&!available)||(self.content_status==ContentStatus::Unavailable&&available){return Err("content status disagrees with body");}',ProResult:'let available=self.chunks.iter().any(|c|!c.text.trim().is_empty());if (self.content_status==ContentStatus::Available&&!available)||(self.content_status==ContentStatus::Unavailable&&available){return Err("content status disagrees with chunks");}',ContentSuccess:'if (self.dropped_results>0||self.results.iter().any(|r|r.content_status==ContentStatus::Truncated))&&!self.truncated{return Err("missing top-level truncation");}',ProSuccess:'if (self.dropped_results>0||self.results.iter().any(|r|r.content_status==ContentStatus::Truncated))&&!self.truncated{return Err("missing top-level truncation");}',TimeWindow:'let start=self.start.as_deref().and_then(date_value);let end=self.end.as_deref().and_then(date_value);if start.zip(end).is_some_and(|(s,e)|s>e){return Err("date range reversed");}',ToolError:'if self.message!=self.code.safe_message(){return Err("web retrieval error message mismatch");}'}};
let rust='// Generated from web-retrieval canonical source; DO NOT EDIT.\n'+projectTypes(schema.$defs,names,{rules,aliases:{DateBound:{rust:'pub type DateBound=String;',go:'type DateBound=string',rustValidate:e=>`date_value(${e}).ok_or("invalid calendar date")?;`,goValidate:()=>''},ChunkScore:{rust:'pub type ChunkScore=serde_json::Number;',go:'type ChunkScore=float64',rustValidate:e=>`if !${e}.as_f64().is_some_and(f64::is_finite){return Err("nonfinite score");}`,goValidate:()=>''}}}).rust;
rust+='impl ErrorCode{pub fn safe_message(self)->&\'static str{match self{'+Object.entries(manifest.error_messages).map(([code,message])=>`Self::${pascal(code)}=>${q(message)},`).join('')+'}}}\n';
rust+='impl ErrorOutput{pub fn new(code:ErrorCode)->Self{Self{error:ToolError{code,message:code.safe_message().to_owned()}}}}\n';
rust+=`fn date_value(s:&str)->Option<(u32,u32,u32)>{let p=s.split('-').collect::<Vec<_>>();if !(1..=3).contains(&p.len())||p[0].len()!=4||p.iter().skip(1).any(|v|v.len()!=2)||p.iter().any(|v|!v.bytes().all(|b|b.is_ascii_digit())){return None;}let y=p[0].parse::<u32>().ok()?;let m=p.get(1).unwrap_or(&"01").parse::<u32>().ok()?;let d=p.get(2).unwrap_or(&"01").parse::<u32>().ok()?;let leap=y%4==0&&(y%100!=0||y%400==0);let days=match m{1|3|5|7|8|10|12=>31,4|6|9|11=>30,2=>if leap{29}else{28},_=>return None};if y==0||d==0||d>days{return None}Some((y,m,d))}\n`;
rust+='impl ProArguments{pub fn effective_limit(&self)->i64{self.limit.unwrap_or(DEFAULT_SEARCH_LIMIT as i64)}}\n';
rust+='impl SearchArguments{pub fn effective_limit(&self)->i64{self.limit.unwrap_or(DEFAULT_SEARCH_LIMIT as i64)}}\n';
for(const[name,definition]of Object.entries(schema.$defs).filter(([,d])=>d.oneOf)) {
  const variants=definition.oneOf.map(r=>r.$ref.split('/').at(-1));
  rust+=`#[derive(Debug,Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(untagged)]pub enum ${name}{${variants.map(v=>`${v}(${v}),`).join('')}}\n`;
  rust+=`impl ${name}{pub fn validate(&self)->Result<(),&'static str>{match self{${variants.map(v=>`Self::${v}(value)=>value.validate(),`).join('')}}}}\n`;
}
const stringConstants={CONTENT_BUDGET_EXPIRED_MESSAGE:manifest.semantics.contentBudgetExpiredMessage,SERVICE_ID:manifest.service_id,SCHEMA_JSON:q(schema),TOOLS_JSON:q(tools),LEGACY_TOOLS_JSON:q(loadWebRetrievalSource({legacy:true}).tools)};
for(const[index,tool]of manifest.tools.entries()) {
  const prefix=tool.name==='kimi_web_search'?'SEARCH':tool.name==='kimi_web_search_pro'?'PRO':'FETCH';
  Object.assign(stringConstants,{[prefix+'_TOOL_NAME']:tool.name,[prefix+'_DESCRIPTION']:tool.description,[prefix+'_INPUT_SCHEMA_JSON']:q(standalone(tool.input)),[prefix+'_OUTPUT_SCHEMA_JSON']:q(standalone(tool.output)),[prefix+'_PATH']:tool.path,[prefix+'_ANNOTATIONS_JSON']:q(tool.annotations)});
}
for(const[name,value]of Object.entries(stringConstants))rust+=`pub const ${name}:&str=${q(value)};\n`;
for(const[name,value]of Object.entries(manifest.limits))rust+=`pub const ${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${value};\n`;
const outputs=new Map([
  ['sdks/rust/web-retrieval/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
  ['sdks/jsonschema/web-retrieval.schema.json',q(schema,null,2)+'\n'],
  ['sdks/jsonschema/web-retrieval.tools.json',q(tools,null,2)+'\n'],
]);
const browserNames=['SearchOutput','ProOutput','FetchOutput'];
const browserSchema={$schema:schema.$schema,$id:schema.$id+'/display',$defs:Object.fromEntries(Object.entries(schema.$defs).filter(([n])=>!['SearchArguments','ProArguments','FetchArguments','TimeWindow','DateBound'].includes(n)))};
const ajv=new Ajv({strict:true,allErrors:true,inlineRefs:false,code:{source:true,esm:true,optimize:true}});addFormats(ajv);ajv.addSchema(browserSchema);
const browserExports=Object.fromEntries(browserNames.map(n=>['validate'+n,browserSchema.$id+'#/$defs/'+n]));for(const ref of Object.values(browserExports))ajv.getSchema(ref);
let validator=standaloneCode(ajv,browserExports).replaceAll('require("ajv/dist/runtime/ucs2length").default','('+ucs2length.default.toString()+')').replaceAll('require("ajv/dist/runtime/equal").default','('+equal.default.toString()+')');
// Inline the locked ajv-formats URI helper verbatim, including its two regexes.
const formatSource=readFileSync(fileURLToPath(import.meta.resolve('ajv-formats/dist/formats.js')),'utf8');
const uriConstants=formatSource.match(/^const (?:URI|NOT_URI_FRAGMENT) = .+;$/gm);assert.equal(uriConstants.length,2);
validator=validator.replaceAll('require("ajv-formats/dist/formats").fullFormats.uri',()=> '(()=>{'+uriConstants.join('\n')+'return '+fullFormats.uri.toString()+';})()');
const runtimeRequire=createRequire(import.meta.resolve('ajv/dist/runtime/equal.js'));
const notices=['ajv','ajv-formats','fast-deep-equal'].map(n=>readFileSync(path.join(path.dirname(n==='fast-deep-equal'?runtimeRequire.resolve(n+'/package.json'):fileURLToPath(import.meta.resolve(n+'/package.json'))),'LICENSE'),'utf8')).join('\n');
validator='/* Bundled helper licenses:\n'+notices+'\n*/\n'+validator;
if(validator.includes('require('))throw new Error('Unexpected browser validator dependency: '+JSON.stringify(validator.match(/require\([^)]*\)[^;]*/g)));
// TypeScript describes the object shape. The generated runtime validator above
// enforces cross-field provenance; conditional schemas are not TS union branches.
const tsSchema=structuredClone(browserSchema);
for(const name of ['ContentResult','ProResult','ContentSuccess','ProSuccess'])delete tsSchema.$defs[name].allOf;
const ts=await compile({...tsSchema,anyOf:browserNames.map(n=>({$ref:'#/$defs/'+n}))},'WebRetrievalOutput',{bannerComment:'// Generated from web-retrieval; DO NOT EDIT.',additionalProperties:false,unknownAny:true,ignoreMinAndMaxItems:true});
outputs.set('sdks/typescript/src/domain/web-retrieval.generated.ts',ts);
outputs.set('sdks/typescript/src/api/generated/web-retrieval-validator.gen.js','// Generated from web-retrieval; DO NOT EDIT.\n'+validator);
outputs.set('sdks/typescript/src/api/generated/web-retrieval-validator.gen.d.ts','// Generated from web-retrieval; DO NOT EDIT.\nimport type * as T from "../../domain/web-retrieval.generated.js";\nexport interface Validator<T>{(value:unknown):value is T;errors?:unknown;}\n'+browserNames.map(n=>`export declare const validate${n}:Validator<T.${n}>;`).join('\n')+'\n');
const lockPath='compatibility/web-retrieval/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.match(base,/^[a-f0-9]{40}$/);
execFileSync('git',['cat-file','-e',base+'^{commit}'],{cwd:root});
const sources=[sourcePath,manifestPath,'scripts/web-retrieval-source.mjs','scripts/generate-web-retrieval.mjs','scripts/sync-web-retrieval.mjs','scripts/market-broker-codegen.mjs','pnpm-lock.yaml','compatibility/web-retrieval/legacy/0.2.0/wire.schema.json','compatibility/web-retrieval/legacy/0.2.0/tools.json'];
outputs.set(lockPath,q({schema_version:1,contract_version:manifest.contract_version,feature:'FEAT-162',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Web retrieval ${check?'checked':'generated'}: three tools plus frozen legacy descriptors, canonical schemas and Rust, no remote calls.`);
