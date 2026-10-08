import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMarketHostSource} from './market-host-source.mjs';
import {projectTypes} from './market-broker-codegen.mjs';
import {compile} from 'json-schema-to-typescript';
import Ajv from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import equal from 'ajv/dist/runtime/equal.js';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>readFileSync(path.join(root,p),'utf8');
const args=process.argv.slice(2),check=args.includes('--check');assert.ok(args.every(a=>a==='--check'));
const {source,manifest,names,defs,documents,schema}=loadMarketHostSource();
const projectionDefs=structuredClone(defs);
const errorVariants=defs.ErrorCode.anyOf.map(v=>v.$ref?defs[v.$ref.split('/').at(-1)]:v);
assert.ok(errorVariants.every(v=>v.type==='string'&&Array.isArray(v.enum)));
projectionDefs.ErrorCode={type:'string',enum:[...new Set(errorVariants.flatMap(v=>v.enum))]};
const q=JSON.stringify,banner='// Generated from market-host source and referenced authorities; DO NOT EDIT.\n';
const canonical='fn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36&&s!="00000000-0000-0000-0000-000000000000"&&b.iter().enumerate().all(|(i,c)|if [8,13,18,23].contains(&i){*c==b\'-\'}else{c.is_ascii_digit()||(*c>=b\'a\'&&*c<=b\'f\')})}\n';
const patterns={
 [defs.CanonicalId.pattern]:e=>`if !canonical_id(${e}){return Err("invalid market UUID");}`,
 '^[0-9a-f]{64}$':e=>`if ${e}.len()!=64||!${e}.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid market digest");}`,
 '^[a-f0-9]{64}$':e=>`if ${e}.len()!=64||!${e}.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid attachment digest");}`,
 '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$':e=>`if ${e}.is_empty()||!${e}.as_bytes()[0].is_ascii_alphanumeric()||!${e}.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-'){return Err("invalid service ID");}`,
 '\\S':e=>`if ${e}.chars().all(|c|c.is_whitespace()||c=='\\u{feff}'){return Err("blank content");}`,
 [defs.StartTurnV2FileBlock.properties.name.pattern]:e=>`if ${e}.chars().any(|c|c=='/'||c=='\\\\'||c<='\\u{1f}'||c=='\\u{7f}')||${e}.chars().next().is_some_and(|c|c.is_whitespace()||c=='\\u{feff}')||${e}.chars().last().is_some_and(|c|c.is_whitespace()||c=='\\u{feff}'){return Err("invalid attachment name");}`,
 [defs.StartTurnV2ImageBlock.properties.data_url.pattern]:e=>`if !image_data_url(${e}){return Err("invalid image data URL");}`,
};
const rustHelpers=canonical+'fn image_data_url(s:&str)->bool{let Some(s)=s.strip_prefix("data:image/")else{return false;};let Some((media,body))=s.split_once(";base64,")else{return false;};if !["jpeg","png","webp","gif"].contains(&media){return false;}let raw=body.trim_end_matches(\'=\');!raw.is_empty()&&body.len()-raw.len()<=2&&raw.bytes().all(|b|b.is_ascii_alphanumeric()||b==b\'+\'||b==b\'/\')}\n';
const aliases={};
for(const n of ['CanonicalId','SelectionRef','SelectionDisplay','ServiceId','Revision'])aliases[n]={rust:`pub use super::generated::${n};`,go:`type ${n}=market.${n}`,rustValidate:defs[n].type==='object'?e=>`${e}.validate()?;`:undefined};
for(const n of ['ScopeBinding','CallIdentity','ReviewProjection','Decision','NativeId'])aliases[n]={rust:`pub use super::broker_generated::${n};`,go:`type ${n}=broker.${n}`,rustValidate:defs[n].type==='object'?e=>`${e}.validate()?;`:undefined};
aliases.SelectionSnapshot={rust:'pub use super::selection_generated::SelectionSnapshot;',go:'type SelectionSnapshot=selection.SelectionSnapshot',rustValidate:e=>`${e}.validate()?;`};
aliases.SelectionDigest={rust:'pub use super::selection_generated::SelectionDigest;',go:'type SelectionDigest=selection.SelectionDigestValue'};
aliases.ProfileId={rust:'pub use crate::chat::models_generated::ProfileId;',go:'type ProfileId=models.ProfileId',rustValidate:()=>'',goValidate:e=>`switch string(${e}){case ${defs.ProfileId.enum.map(q).join(',')}:default:return errors.New("invalid model profile")};`};
aliases.ModelRevision={rust:'pub type ModelRevision=i64;',go:'type ModelRevision=models.Revision',goValidate:e=>`if ${e}<0||${e}>9007199254740991{return errors.New("invalid model revision")};`};
for(const n of ['ProviderPayload','ProviderStatus'])aliases[n]={rust:`pub use super::provider_generated::${n};`,go:`type ${n}=provider.${n}`,rustValidate:e=>`${e}.validate()?;`};
aliases.ServiceBinding={rust:'pub use super::provider_generated::ProviderBinding as ServiceBinding;',go:'type ServiceBinding=provider.ProviderBinding',rustValidate:e=>`${e}.validate()?;`};
const members=defs.ContentBlock.oneOf.map(v=>v.$ref.split('/').at(-1));
const variants=members.map(n=>({n,v:defs[n].properties.type.enum[0]}));
aliases.ContentBlock={
 rust:`#[derive(Clone,PartialEq,Eq,serde::Serialize,serde::Deserialize)]#[serde(untagged)]pub enum ContentBlock{${variants.map(({n,v})=>v[0].toUpperCase()+v.slice(1)+'(Box<'+n+'>),').join('')}}impl ContentBlock{pub fn validate(&self)->Result<(),&'static str>{match self{${variants.map(({v})=>'Self::'+v[0].toUpperCase()+v.slice(1)+'(x)=>x.validate(),').join('')}}}}impl std::fmt::Debug for ContentBlock{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("ContentBlock([redacted])")}}`,
 go:'type ContentBlock=agenthost.StartTurnV2ContentBlock',
 rustValidate:e=>`${e}.validate()?;`,goValidate:e=>`if err:=validateContentBlock(${e});err!=nil{return err};`,
};
const generatedNames=[...names,...members,'StartTurnV2FileMediaType'];
const acceptedCheckRust='if self.state==SubmissionState::Accepted&&(self.agent_session_id.is_none()||self.native_thread_id.is_none()||self.native_turn_id.is_none()||self.runtime_generation.is_none()){return Err("accepted receipt missing native fact");}';
const acceptedCheckGo='if v.State==SubmissionStateAccepted&&(v.AgentSessionId==nil||v.NativeThreadId==nil||v.NativeTurnId==nil||v.RuntimeGeneration==nil){return errors.New("accepted receipt missing native fact")};';
const rules={patterns,rustFormats:{uuid:e=>`if !canonical_id(${e}){return Err("invalid attachment UUID");}`},goFormats:{uuid:e=>`if err:=market.CanonicalId(${e}).Validate();err!=nil{return err};`},rust:{Submission:'if self.services.len()!=self.snapshot.selection.len()||self.services.iter().zip(&self.snapshot.selection).any(|(s,r)|&s.reference!=r){return Err("service snapshot mismatch");}if !self.snapshot.selection.is_empty()&&self.permission_mode!=PermissionMode::Ask{return Err("permission_mode_unavailable");}if self.agent_session_id.is_none()&&self.intent.expected_revision!=0{return Err("invalid new session revision");}',SubmissionReceipt:acceptedCheckRust},go:{Submission:'if len(v.Services)!=len(v.Snapshot.Selection){return errors.New("service snapshot mismatch")};for i,s:=range v.Services{if s.Reference!=v.Snapshot.Selection[i]{return errors.New("service snapshot mismatch")}};if len(v.Snapshot.Selection)>0&&v.PermissionMode!=PermissionModeAsk{return errors.New("permission_mode_unavailable")};if v.AgentSessionId==nil&&v.Intent.ExpectedRevision!=0{return errors.New("invalid new session revision")};',SubmissionReceipt:acceptedCheckGo}};
const projection=projectTypes(projectionDefs,generatedNames,{aliases,rules,goPackage:'markethost',goImports:'market "github.com/36Dge/yijie-contracts/sdks/go/market-connectors";selection "github.com/36Dge/yijie-contracts/sdks/go/market-selection";broker "github.com/36Dge/yijie-contracts/sdks/go/market-broker-control";models "github.com/36Dge/yijie-contracts/sdks/go/openapi/chat-models";agenthost "github.com/36Dge/yijie-contracts/sdks/go/openapi/agent-host";provider "github.com/36Dge/yijie-contracts/sdks/go/market-provider";'});
let rust=banner+projection.rust+rustHelpers;
let go=banner+projection.go+'func validateContentBlock(v ContentBlock)error{b,err:=v.MarshalJSON();if err!=nil{return errors.New("invalid content block")};var tag struct{Type string `json:"type"`};if json.Unmarshal(b,&tag)!=nil{return errors.New("invalid content block")};switch tag.Type{'+variants.map(({n,v})=>`case ${q(v)}:var value ${n};return json.Unmarshal(b,&value);`).join('')+'default:return errors.New("unsupported content block")}}\n';
for(const[key,value]of Object.entries(manifest.limits)){rust+=`pub const ${key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${value};\n`;go+=`const ${key[0].toUpperCase()+key.slice(1)}=${value}\n`;}
const outputs=new Map([
 ['sdks/rust/market-host/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/go/market-host/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/jsonschema/market-host.schema.json',q(schema,null,2)+'\n'],
]);
// Only the two declared Native UI commands and their response/error closure
// receive browser projections. Private grant/provider methods are not invocable
// through this manifest or generated browser API.
const nativePath='compatibility/market-host/native-ipc.json',native=JSON.parse(read(nativePath));
assert.equal(native.wire_authority,'compatibility/market-host/wire.schema.json');assert.equal(native.contextBinding,'chat_bind_context_v1');assert.deepEqual(native.commands.map(c=>c.command),['chat_market_observe_v1','chat_market_approval_decide_v1']);
const nativeRoots=[...new Set(native.commands.flatMap(c=>[c.request,c.response]).concat(native.error))],closure=new Set(nativeRoots);
function visit(v){if(!v||typeof v!=='object')return;if(v.$ref){const n=v.$ref.split('/').at(-1);if(!closure.has(n)){closure.add(n);visit(defs[n]);}}for(const[k,x]of Object.entries(v))if(k!=='$ref')if(Array.isArray(x))x.forEach(visit);else visit(x);}
for(const n of nativeRoots)visit(defs[n]);
const nativeSchema={$schema:schema.$schema,$id:schema.$id+'/native',$defs:Object.fromEntries([...closure].map(n=>[n,defs[n]]))};
const ajv=new Ajv({strict:true,allErrors:true,inlineRefs:false,code:{source:true,esm:true,optimize:true}});ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);ajv.addSchema(nativeSchema);const exports=Object.fromEntries(nativeRoots.map(n=>['validate'+n,nativeSchema.$id+'#/$defs/'+n]));for(const r of Object.values(exports))ajv.getSchema(r);
const runtimeRequire=createRequire(import.meta.resolve('ajv/dist/runtime/equal.js'));const notices=['ajv','fast-deep-equal'].map(n=>readFileSync(path.join(path.dirname(runtimeRequire.resolve(n+'/package.json')),'LICENSE'),'utf8')).join('\n\n');
const validators=banner+'/* Bundled helper license notices:\n'+notices+'\n*/\n'+standaloneCode(ajv,exports).replaceAll('require("ajv/dist/runtime/ucs2length").default','('+ucs2length.default.toString()+')').replaceAll('require("ajv/dist/runtime/equal").default','('+equal.default.toString()+')');assert.ok(!validators.includes('require('));
const ts=await compile({...nativeSchema,anyOf:nativeRoots.map(n=>({$ref:'#/$defs/'+n}))},'NativeMarketTypes',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true,ignoreMinAndMaxItems:true});
outputs.set('sdks/typescript/src/domain/market-host-native.generated.ts',ts+'\nexport const NATIVE_MARKET_COMMANDS='+q(native.commands)+' as const;\n');
outputs.set('sdks/typescript/src/api/generated/market-host-native-validator.gen.js',validators);
outputs.set('sdks/typescript/src/api/generated/market-host-native-validator.gen.d.ts',banner+'import type * as T from "../../domain/market-host-native.generated.js";\nexport interface Validator<T>{(value:unknown):value is T;errors?:unknown;}\n'+nativeRoots.map(n=>`export declare const validate${n}:Validator<T.${n}>;`).join('\n')+'\n');
outputs.set('sdks/jsonschema/market-host-native.schema.json',q(nativeSchema,null,2)+'\n');
const lockPath='compatibility/market-host/source.lock.json',base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[...documents.keys(),nativePath,'scripts/market-host-source.mjs','scripts/generate-market-host.mjs','scripts/market-broker-codegen.mjs','scripts/sync-market-host.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,q({schema_version:1,contract_version:'0.1.0',feature:'FEAT-157',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Market Host ${check?'checked':'generated'}: ${names.length} definitions; existing v2 content and private Native authority.`);
