// Independent FEAT-158 source-first family; never runs legacy fixture generation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'json-schema-to-typescript';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import equal from 'ajv/dist/runtime/equal.js';
import {projectTypes} from './market-broker-codegen.mjs';
import {loadExpertsSource,definitionClosure,canonicalExpertSnapshotText,canonicalKnowledgeManifestBytes} from './experts-v2-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);assert.ok(args.every(a=>a==='--check'));const check=args.includes('--check');
const read=p=>readFileSync(path.join(root,p));const hash=b=>createHash('sha256').update(b).digest('hex');
const {native,transport,names,defs,documents,schema}=loadExpertsSource();
const q=JSON.stringify,banner='// Generated from FEAT-158 experts source and referenced authorities; DO NOT EDIT.\n';
const projectionDefs=structuredClone(defs);
// The source's negative-lookahead path pattern has no RE2 equivalent. Project
// the same checks as native helper code, keeping the source/AJV pattern intact.
delete projectionDefs.ResourcePath.pattern;
const aliases={};
aliases.CanonicalId={rust:'pub type CanonicalId=String;',go:'type CanonicalId=host.CanonicalId',rustValidate:e=>`if !canonical_id(${e}){return Err("invalid expert identity");}`};
const alias=(name,rust,go)=>aliases[name]={rust:`pub use ${rust} as ${name};`,go:`type ${name}=${go}`,rustValidate:e=>`${e}.validate()?;`};
alias('ScopeBinding','crate::chat::connectors::broker_generated::ScopeBinding','broker.ScopeBinding');
alias('ModelIntent','crate::chat::connectors::selection_generated::ModelIntent','host.ModelIntent');
alias('PermissionMode','crate::chat::connectors::host_generated::PermissionMode','host.PermissionMode');aliases.PermissionMode.rustValidate=()=>'';
alias('MarketSnapshot','crate::chat::connectors::selection_generated::SelectionSnapshot','selection.SelectionSnapshot');
alias('MarketSubmitPayload','crate::chat::connectors::selection_generated::SubmitPayload','host.Submission'); // Go UI closure is not generated.
alias('MarketSubmission','crate::chat::connectors::host_generated::Submission','host.Submission');
alias('MarketReceipt','crate::chat::connectors::host_generated::SubmissionReceipt','host.SubmissionReceipt');
alias('MarketGrant','crate::chat::connectors::host_generated::GrantRegistration','host.GrantRegistration');
alias('MarketSubmitTrigger','crate::chat::connectors::host_generated::SubmitPayload','host.SubmitPayload');
alias('NativeReceipt','crate::chat::connectors::selection_generated::SubmissionReceipt','host.SubmissionReceipt'); // Go UI closure is not generated.
aliases.ResourcePath={rust:'pub type ResourcePath=String;',go:'type ResourcePath string\nfunc(v ResourcePath)Validate()error{if !resourcePath(string(v)){return errors.New("invalid expert resource path")};return nil}',rustValidate:e=>`if !resource_path(${e}){return Err("invalid expert resource path");}`};
const patterns={
 [defs.CanonicalId.pattern]:e=>`if !canonical_id(${e}){return Err("invalid expert identity");}`,
 [defs.ExpertId.pattern]:e=>`if !slug(${e},false){return Err("invalid expert id");}`,
 [defs.Version.pattern]:e=>`if !semantic_version(${e}){return Err("invalid expert version");}`,
 [defs.Digest.pattern]:e=>`if ${e}.len()!=64||!${e}.bytes().all(|c|c.is_ascii_digit()||(b'a'..=b'f').contains(&c)){return Err("invalid expert digest");}`,
 '^[a-z][A-Za-z0-9]*$':e=>`if ${e}.is_empty()||!${e}.as_bytes()[0].is_ascii_lowercase()||!${e}.bytes().all(|c|c.is_ascii_alphanumeric()){return Err("invalid icon key");}`,
 '^[a-z0-9]+(?:[.-][a-z0-9]+)*$':e=>`if !slug(${e},true){return Err("invalid resource identity");}`,
};
const rules={patterns,rust:{
 TurnExpertSnapshot:'if snapshot_digest(&self.turn_operation_id,self.binding_revision,self.expert.as_ref())?!=self.snapshot_digest{return Err("expert snapshot digest mismatch");}',
 PrivateSubmission:'if self.submission.snapshot.turn_operation_id!=self.expert_snapshot.turn_operation_id{return Err("expert turn identity mismatch");}',
 PrivateReceipt:'if self.receipt.turn_operation_id!=self.expert_snapshot.turn_operation_id{return Err("expert receipt identity mismatch");}',
 ApplyPayload:'if self.expected_binding_revision.checked_add(1)!=Some(self.binding_revision){return Err("invalid expert binding revision");}',
 ApplyReceipt:'let expected=if self.state==OperationState::Succeeded{self.expected_binding_revision.checked_add(1)}else{Some(self.expected_binding_revision)};if expected!=Some(self.binding_revision){return Err("invalid effective binding revision");}',
 BindingOperation:'let expected=if self.state==OperationState::Succeeded{self.expected_binding_revision.checked_add(1)}else{Some(self.expected_binding_revision)};if expected!=Some(self.binding_revision){return Err("invalid effective binding revision");}',
 BindingView:'if !self.managed&&(self.binding_revision!=0||self.expert.is_some()||self.state!=BindingState::None||self.operation_id.is_some()){return Err("invalid unmanaged binding");}if self.state==BindingState::None&&self.expert.is_some(){return Err("ordinary binding has expert");}if self.state==BindingState::Ready&&self.expert.is_none(){return Err("ready binding missing expert");}',
 Error:'if self.retryable&&self.code!=ErrorCode::TemporarilyUnavailable{return Err("expert error is not retryable");}',
 },go:{
 TurnExpertSnapshot:'d,e:=SnapshotDigest(v.TurnOperationId,v.BindingRevision,v.Expert);if e!=nil{return e};if d!=string(v.SnapshotDigest){return errors.New("expert snapshot digest mismatch")};',
 PrivateSubmission:'if v.Submission.Snapshot.TurnOperationId!=v.ExpertSnapshot.TurnOperationId{return errors.New("expert turn identity mismatch")};',
 PrivateReceipt:'if v.Receipt.TurnOperationId!=v.ExpertSnapshot.TurnOperationId{return errors.New("expert receipt identity mismatch")};',
 ApplyPayload:'if v.BindingRevision!=v.ExpectedBindingRevision+1{return errors.New("invalid expert binding revision")};',
 ApplyReceipt:'expected:=v.ExpectedBindingRevision;if v.State==OperationStateSucceeded{expected++};if v.BindingRevision!=expected{return errors.New("invalid effective binding revision")};',
 Error:'if v.Retryable&&v.Code!=ErrorCodeTemporarilyUnavailable{return errors.New("expert error is not retryable")};',
 }};
const privateRoots=transport.commands.flatMap(c=>[c.request,c.response]).concat(['Error','ExpertMetadata']);
const privateNames=Object.keys(definitionClosure(defs,privateRoots)).filter(n=>names.includes(n));
const goProjection=projectTypes(projectionDefs,privateNames,{aliases,rules,goPackage:'experts',goImports:'broker "github.com/36Dge/yijie-contracts/sdks/go/market-broker-control";selection "github.com/36Dge/yijie-contracts/sdks/go/market-selection";host "github.com/36Dge/yijie-contracts/sdks/go/market-host-v2";"crypto/sha256";"fmt";"sort";"strings";'});
const rustProjection=projectTypes(projectionDefs,names,{aliases,rules});
const p=transport.snapshot_digest,k=transport.knowledge_digest;
assert.deepEqual(p.lines,['domain','canonical actual turnOperationId','decimal bindingRevision','none OR expert','when expert: expertId','when expert: version','when expert: archiveSha256','when expert: roleSha256','when expert: knowledgeManifestSha256']);
assert.equal(p.trailingLf,true);assert.equal(p.algorithm,'sha256');
assert.deepEqual(k.fields,['id','title','path','sha256','bytes','content_version','content_status']);assert.equal(k.sort,'id ASCII ascending');assert.equal(k.uniqueKey,'id');assert.equal(k.trailingLf,true);
const rustHelpers=`
fn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36&&s!="00000000-0000-0000-0000-000000000000"&&b.iter().enumerate().all(|(i,c)|if [8,13,18,23].contains(&i){*c==b'-'}else{c.is_ascii_digit()||(b'a'..=b'f').contains(c)})}
fn slug(s:&str,dot:bool)->bool{!s.is_empty()&&s.split(|c|c=='-'||(dot&&c=='.')).all(|v|!v.is_empty()&&v.bytes().all(|c|c.is_ascii_digit()||c.is_ascii_lowercase()))}
fn semantic_version(s:&str)->bool{let mut plus=s.split('+');let first=plus.next().unwrap_or("");let suffix=|v:&str|!v.is_empty()&&v.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'.'||c==b'-');if plus.next().is_some_and(|v|!suffix(v))||plus.next().is_some(){return false;}let(core,pre)=first.split_once('-').map_or((first,None),|(c,p)|(c,Some(p)));let parts:Vec<_>=core.split('.').collect();parts.len()==3&&parts.iter().all(|v|!v.is_empty()&&(v.len()==1||!v.starts_with('0'))&&v.bytes().all(|c|c.is_ascii_digit()))&&pre.is_none_or(suffix)}
fn resource_path(s:&str)->bool{!s.is_empty()&&s.chars().count()<=512&&!s.starts_with('/')&&!s.contains('\\\\')&&!s.chars().any(|c|c<='\\u{1f}'||c=='\\u{7f}')&&!s.split('/').any(|p|p=="..")}
pub fn canonical_snapshot_bytes(turn:&str,revision:i64,expert:Option<&ExpertRef>)->Result<Vec<u8>,&'static str>{if !canonical_id(turn)||!(0..=9007199254740991).contains(&revision){return Err("invalid snapshot identity");}let mut text=format!("${p.domain}\\n{}\\n{}\\n",turn,revision);if let Some(e)=expert{e.validate()?;text.push_str(&format!("expert\\n{}\\n{}\\n{}\\n{}\\n{}\\n",e.expert_id,e.version,e.archive_sha256,e.role_sha256,e.knowledge_manifest_sha256));}else{text.push_str("none\\n");}Ok(text.into_bytes())}
pub fn snapshot_digest(turn:&str,revision:i64,expert:Option<&ExpertRef>)->Result<String,&'static str>{use sha2::{Digest,Sha256};Ok(format!("{:x}",Sha256::digest(canonical_snapshot_bytes(turn,revision,expert)?)))}
pub fn freeze_snapshot(turn_operation_id:String,binding_revision:i64,expert:Option<ExpertRef>)->Result<TurnExpertSnapshot,&'static str>{let snapshot_digest=snapshot_digest(&turn_operation_id,binding_revision,expert.as_ref())?;Ok(TurnExpertSnapshot{format_version:1,turn_operation_id,binding_revision,expert,snapshot_digest})}
pub fn canonical_knowledge_manifest_bytes(resources:&[KnowledgeResource])->Result<Vec<u8>,&'static str>{if resources.is_empty()||resources.len()>32{return Err("invalid knowledge count");}let mut refs=resources.iter().collect::<Vec<_>>();refs.sort_by(|a,b|a.id.cmp(&b.id));let mut out=format!("${k.domain}\\n{}\\n",refs.len()).into_bytes();for(i,r)in refs.iter().enumerate(){r.validate()?;if i>0&&refs[i-1].id==r.id{return Err("duplicate knowledge id");}for v in [&r.id,&r.title,&r.path,&r.sha256,&r.bytes.to_string(),&r.content_version,&r.content_status]{out.extend_from_slice(format!("{}:",v.len()).as_bytes());out.extend_from_slice(v.as_bytes());}out.push(b'\\n');}Ok(out)}
pub fn knowledge_manifest_digest(resources:&[KnowledgeResource])->Result<String,&'static str>{use sha2::{Digest,Sha256};Ok(format!("{:x}",Sha256::digest(canonical_knowledge_manifest_bytes(resources)?)))}
`;
const goHelpers=`
func resourcePath(s string)bool{return s!=""&&utf8.RuneCountInString(s)<=512&&!strings.HasPrefix(s,"/")&&!strings.Contains(s,"\\\\")&&!strings.Contains("/"+s+"/","/../")&&strings.IndexFunc(s,func(c rune)bool{return c<=31||c==127})<0}
func CanonicalSnapshotBytes(turn CanonicalId,revision Revision,expert *ExpertRef)([]byte,error){if e:=turn.Validate();e!=nil{return nil,e};if e:=revision.Validate();e!=nil{return nil,e};var b strings.Builder;fmt.Fprintf(&b,"${p.domain}\\n%s\\n%d\\n",turn,revision);if expert==nil{b.WriteString("none\\n")}else{if e:=expert.Validate();e!=nil{return nil,e};fmt.Fprintf(&b,"expert\\n%s\\n%s\\n%s\\n%s\\n%s\\n",expert.ExpertId,expert.Version,expert.ArchiveSha256,expert.RoleSha256,expert.KnowledgeManifestSha256)};return []byte(b.String()),nil}
func SnapshotDigest(turn CanonicalId,revision Revision,expert *ExpertRef)(string,error){b,e:=CanonicalSnapshotBytes(turn,revision,expert);if e!=nil{return "",e};return fmt.Sprintf("%x",sha256.Sum256(b)),nil}
func FreezeSnapshot(turn CanonicalId,revision Revision,expert *ExpertRef)(TurnExpertSnapshot,error){d,e:=SnapshotDigest(turn,revision,expert);if e!=nil{return TurnExpertSnapshot{},e};return TurnExpertSnapshot{FormatVersion:1,TurnOperationId:turn,BindingRevision:revision,Expert:expert,SnapshotDigest:Digest(d)},nil}
func CanonicalKnowledgeManifestBytes(resources []KnowledgeResource)([]byte,error){if len(resources)<1||len(resources)>32{return nil,errors.New("invalid knowledge count")};rs:=append([]KnowledgeResource(nil),resources...);sort.Slice(rs,func(i,j int)bool{return rs[i].Id<rs[j].Id});var out bytes.Buffer;fmt.Fprintf(&out,"${k.domain}\\n%d\\n",len(rs));for i,r:=range rs{if e:=r.Validate();e!=nil{return nil,e};if i>0&&rs[i-1].Id==r.Id{return nil,errors.New("duplicate knowledge id")};for _,v:=range []string{r.Id,r.Title,string(r.Path),string(r.Sha256),fmt.Sprint(r.Bytes),string(r.ContentVersion),r.ContentStatus}{fmt.Fprintf(&out,"%d:",len([]byte(v)));out.WriteString(v)};out.WriteByte('\\n')};return out.Bytes(),nil}
func KnowledgeManifestDigest(resources []KnowledgeResource)(string,error){b,e:=CanonicalKnowledgeManifestBytes(resources);if e!=nil{return "",e};return fmt.Sprintf("%x",sha256.Sum256(b)),nil}
`;
const timeoutRust=Object.entries(transport.method_timeout_ms).map(([method,ms])=>`pub const ${method.toUpperCase()}_TIMEOUT_MS:u64=${ms};`).join('\n')+`\npub const NATIVE_RESPONSE_TIMEOUT_MS:u64=${transport.native_response_timeout_ms};\n`;
const timeoutGo='\nvar MethodTimeoutMs=map[string]int64{'+Object.entries(transport.method_timeout_ms).map(([method,ms])=>q(method)+':'+ms).join(',')+`}\nconst NativeResponseTimeoutMs=${transport.native_response_timeout_ms}\n`;
const outputs=new Map([
 ['sdks/rust/experts-v2/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:banner+rustProjection.rust+rustHelpers+timeoutRust})],
 ['sdks/go/experts-v2/types.gen.go',execFileSync('gofmt',[],{input:banner+goProjection.go+goHelpers+timeoutGo})],
 ['sdks/jsonschema/experts-v2.schema.json',q(schema,null,2)+'\n'],
]);
const bundleSchemas=['v2','v3'].map(v=>read('jsonschema/skills/skill-bundle-manifest-'+v+'.schema.json').toString());
outputs.set('sdks/go/experts-v2/bundle_schemas.gen.go',execFileSync('gofmt',[],{input:banner+'package experts\n'+bundleSchemas.map((s,i)=>`const SkillBundleManifestV${i+2}SchemaJSON=${q(s)}\n`).join('')}));
const nativeRoots=[...new Set(native.commands.flatMap(c=>[c.request,c.response]).concat(native.error))];
const nativeSchema={$schema:schema.$schema,$id:schema.$id+'/native',$defs:definitionClosure(defs,nativeRoots)};
assert.ok(!nativeSchema.$defs.ExpertRef&&!nativeSchema.$defs.TurnExpertSnapshot&&!nativeSchema.$defs.ScopeBinding);
const ajv=new Ajv({strict:true,allErrors:true,inlineRefs:false,code:{source:true,esm:true,optimize:true}});addFormats(ajv);ajv.addSchema(nativeSchema);
const exports=Object.fromEntries(nativeRoots.map(n=>['validate'+n,nativeSchema.$id+'#/$defs/'+n]));for(const r of Object.values(exports))ajv.getSchema(r);
const runtimeRequire=createRequire(import.meta.resolve('ajv/dist/runtime/equal.js'));
const notices=['ajv','fast-deep-equal'].map(n=>readFileSync(path.join(path.dirname(runtimeRequire.resolve(n+'/package.json')),'LICENSE'),'utf8')).join('\n\n');
let validators=standaloneCode(ajv,exports).replaceAll('require("ajv/dist/runtime/ucs2length").default','('+ucs2length.default.toString()+')').replaceAll('require("ajv/dist/runtime/equal").default','('+equal.default.toString()+')');
// UUID validation uses the exact source pattern, so it needs no runtime formats import.
validators=validators.replaceAll('require("ajv-formats/dist/formats").fullFormats.uuid','(/^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)');assert.ok(!validators.includes('require('));
function tsProjection(v){if(Array.isArray(v))return v.map(tsProjection);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='title'&&k!=='allOf').map(([k,x])=>[k,tsProjection(x)]));}
const ts=await compile({...tsProjection(nativeSchema),anyOf:nativeRoots.map(n=>({$ref:'#/$defs/'+n}))},'ExpertNativeTypes',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true,ignoreMinAndMaxItems:true});
outputs.set('sdks/typescript/src/domain/experts-v2.generated.ts',ts+'\nexport const EXPERT_COMMANDS='+q(native.commands)+' as const;\n');
outputs.set('sdks/typescript/src/api/generated/experts-v2-validator.gen.js',banner+'/* Bundled helper license notices:\n'+notices+'\n*/\n'+validators);
outputs.set('sdks/typescript/src/api/generated/experts-v2-validator.gen.d.ts',banner+'import type * as T from "../../domain/experts-v2.generated.js";\nexport interface Validator<T>{(value:unknown):value is T;errors?:unknown;}\n'+nativeRoots.map(n=>`export declare const validate${n}:Validator<T.${n}>;`).join('\n')+'\n');
outputs.set('sdks/jsonschema/experts-v2-native.schema.json',q(nativeSchema,null,2)+'\n');
const vectors=[{name:'ordinary',formatVersion:1,turnOperationId:'00000000-0000-4000-8000-000000000158',bindingRevision:0,expert:null},{name:'expert',formatVersion:1,turnOperationId:'00000000-0000-4000-8000-000000000159',bindingRevision:1,expert:{expertId:'jd-ops-expert',version:'0.1.0',archiveSha256:'a'.repeat(64),roleSha256:'b'.repeat(64),knowledgeManifestSha256:'c'.repeat(64)}}].map(v=>({...v,canonicalText:canonicalExpertSnapshotText(v,p),snapshotDigest:hash(canonicalExpertSnapshotText(v,p))}));
outputs.set('fixtures/experts-v2/digest-vectors.json',q(vectors,null,2)+'\n');
const knowledge=[{id:'m02',title:'第二模块',path:'references/m02.md',sha256:'b'.repeat(64),bytes:42,content_version:'0.1.0',content_status:'reviewed-reference'},{id:'m01',title:'第一模块',path:'references/m01.md',sha256:'a'.repeat(64),bytes:20,content_version:'0.1.0',content_status:'incomplete'}];
outputs.set('fixtures/experts-v2/knowledge-digest-vectors.json',q([{resources:knowledge,canonicalText:canonicalKnowledgeManifestBytes(knowledge,k).toString('utf8'),digest:hash(canonicalKnowledgeManifestBytes(knowledge,k))}],null,2)+'\n');
outputs.set('sdks/javascript/experts-v2/canonical.gen.mjs',banner+'import assert from "node:assert/strict";\nimport {createHash} from "node:crypto";\n'+canonicalExpertSnapshotText.toString()+'\n'+canonicalKnowledgeManifestBytes.toString()+'\nexport const snapshotPolicy='+q(p)+';\nexport const knowledgePolicy='+q(k)+';\nexport function expertSnapshotDigest(value){return createHash("sha256").update(canonicalExpertSnapshotText(value,snapshotPolicy)).digest("hex");}\nexport function knowledgeManifestDigest(resources){return createHash("sha256").update(canonicalKnowledgeManifestBytes(resources,knowledgePolicy)).digest("hex");}\n');
const lockPath='compatibility/experts-v2/source.lock.json',base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sources=[...documents.keys(),'jsonschema/skills/skill-bundle-manifest-v3.schema.json','scripts/experts-v2-source.mjs','scripts/generate-experts-v2.mjs','scripts/market-broker-codegen.mjs','scripts/sync-model-call-surfaces-v2.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,q({schema_version:1,contract_version:'0.2.0',feature:'FEAT-164',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[...new Set(sources)].map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const f=path.join(root,p);if(check)assert.deepEqual(readFileSync(f),Buffer.from(b),p);else{mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,b);}}
console.log(`Experts ${check?'checked':'generated'}: ${names.length} definitions; ${native.commands.length} safe UI commands; existing owned private pipe; no legacy generation.`);
