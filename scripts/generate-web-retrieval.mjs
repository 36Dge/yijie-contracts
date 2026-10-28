// Independent FEAT-162 source-first projection, with existing codegen/dependencies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
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
  '^https?://':e=>`if !(${e}.starts_with("http://")||${e}.starts_with("https://")){return Err("web retrieval URL requires HTTP(S)");}let parsed=url::Url::parse(${e}).map_err(|_|"invalid web retrieval URL")?;if parsed.host_str().is_none(){return Err("web retrieval URL requires host");}`,
},rust:{ToolError:'if self.message!=self.code.safe_message(){return Err("web retrieval error message mismatch");}'}};
let rust='// Generated from web-retrieval canonical source; DO NOT EDIT.\n'+projectTypes(schema.$defs,names,{rules}).rust;
rust+='impl ErrorCode{pub fn safe_message(self)->&\'static str{match self{'+Object.entries(manifest.error_messages).map(([code,message])=>`Self::${pascal(code)}=>${q(message)},`).join('')+'}}}\n';
rust+='impl ErrorOutput{pub fn new(code:ErrorCode)->Self{Self{error:ToolError{code,message:code.safe_message().to_owned()}}}}\n';
rust+='impl SearchArguments{pub fn effective_limit(&self)->i64{self.limit.unwrap_or(DEFAULT_SEARCH_LIMIT as i64)}}\n';
for(const[name,definition]of Object.entries(schema.$defs).filter(([,d])=>d.oneOf)) {
  const variants=definition.oneOf.map(r=>r.$ref.split('/').at(-1));
  rust+=`#[derive(Debug,Clone,PartialEq,Eq,Serialize,Deserialize)]#[serde(untagged)]pub enum ${name}{${variants.map(v=>`${v}(${v}),`).join('')}}\n`;
  rust+=`impl ${name}{pub fn validate(&self)->Result<(),&'static str>{match self{${variants.map(v=>`Self::${v}(value)=>value.validate(),`).join('')}}}}\n`;
}
const stringConstants={SERVICE_ID:manifest.service_id,SCHEMA_JSON:q(schema),TOOLS_JSON:q(tools)};
for(const[index,tool]of manifest.tools.entries()) {
  const prefix=index===0?'SEARCH':'FETCH';
  Object.assign(stringConstants,{[prefix+'_TOOL_NAME']:tool.name,[prefix+'_DESCRIPTION']:tool.description,[prefix+'_INPUT_SCHEMA_JSON']:q(standalone(tool.input)),[prefix+'_OUTPUT_SCHEMA_JSON']:q(standalone(tool.output)),[prefix+'_PATH']:tool.path,[prefix+'_ANNOTATIONS_JSON']:q(tool.annotations)});
}
for(const[name,value]of Object.entries(stringConstants))rust+=`pub const ${name}:&str=${q(value)};\n`;
for(const[name,value]of Object.entries(manifest.limits))rust+=`pub const ${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${value};\n`;
const outputs=new Map([
  ['sdks/rust/web-retrieval/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
  ['sdks/jsonschema/web-retrieval.schema.json',q(schema,null,2)+'\n'],
  ['sdks/jsonschema/web-retrieval.tools.json',q(tools,null,2)+'\n'],
]);
const lockPath='compatibility/web-retrieval/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.match(base,/^[a-f0-9]{40}$/);
execFileSync('git',['cat-file','-e',base+'^{commit}'],{cwd:root});
const sources=[sourcePath,manifestPath,'scripts/web-retrieval-source.mjs','scripts/generate-web-retrieval.mjs','scripts/sync-web-retrieval.mjs','scripts/market-broker-codegen.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,q({schema_version:1,contract_version:manifest.contract_version,feature:'FEAT-162',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Web retrieval ${check?'checked':'generated'}: two tools, canonical schemas and Rust, no remote calls.`);
