// FEAT-173 source-first projection; fixed Runtime and older families stay unchanged.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'json-schema-to-typescript';
import {projectTypes} from './market-broker-codegen.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
assert(args.every(a=>['--check','--consumer=host'].includes(a)));
const source='jsonschema/video-generation/v1.schema.json';
const read=p=>readFileSync(path.join(root,p));
const q=JSON.stringify,hash=b=>createHash('sha256').update(b).digest('hex');
const schema=JSON.parse(read(source)),p=schema['x-provider'],h=schema['x-private-http'],m=schema['x-mcp'];
const uuidPattern=schema.$defs.GetInput.properties.video_operation_id.pattern;
const rules={
 patterns:{[uuidPattern]:e=>`if !valid_uuid(${e}){return Err("invalid video identity");}`,'\\S':e=>`if ${e}.trim().is_empty(){return Err("empty video prompt");}`},
 go:{
 GenerateInput:`if !utf8.ValidString(v.Prompt)||strings.TrimSpace(v.Prompt)==""||strings.ContainsRune(v.Prompt,0)||forbiddenPromptParameter(v.Prompt){return errors.New("invalid video prompt")};switch v.ImageMode{case ImageModeNone:if len(v.ImageIndices)!=0{return errors.New("unexpected images")};case ImageModeFirstFrame:if len(v.ImageIndices)!=1{return errors.New("one first frame required")};case ImageModeFirstLastFrames:if len(v.ImageIndices)!=2{return errors.New("two frame roles required")};case ImageModeReferenceImages:if len(v.ImageIndices)==0{return errors.New("reference images required")};for i,n:=range v.ImageIndices{for _,prior:=range v.ImageIndices[:i]{if n==prior{return errors.New("duplicate reference index")}}}};`,
 VideoResult:`ready:=v.Status==VideoStatusStaged||v.Status==VideoStatusCommitted;if ready!=(v.Code==VideoCodeOk)||(v.ArtifactId!=nil)!=(v.DeliveryTurnId!=nil)||(v.ProviderStatus!=nil)!=(v.ProviderObservedAt!=nil)||(v.Candidates!=nil)!=(v.CandidatesComplete!=nil){return errors.New("inconsistent video receipt")};if v.ArtifactId!=nil&&(v.VideoOperationId==nil||(v.Code!=VideoCodeOk&&v.Code!=VideoCodeDeliveryUnconfirmed)){return errors.New("invalid artifact reference")};if ready&&(v.ArtifactId==nil||(v.NextAction!=NextActionCheckArtifact&&v.NextAction!=NextActionReportStatus)){return errors.New("invalid delivered receipt")};if v.Status==VideoStatusStaged&&v.NextAction!=NextActionCheckArtifact{return errors.New("staged receipt needs ACK check")};if v.Code==VideoCodeDeliveryUnconfirmed&&(v.ArtifactId==nil||v.Status!=VideoStatusUnknown||v.NextAction!=NextActionReportStatus){return errors.New("invalid unconfirmed delivery")};if v.Code==VideoCodeSelectionRequired{if v.Candidates==nil||v.Status!=VideoStatusBlocked||v.NextAction!=NextActionSelectOperation||v.VideoOperationId!=nil{return errors.New("invalid selection receipt")}}else if v.Candidates!=nil{return errors.New("unexpected candidates")};if (v.NextAction==NextActionGetVideoResult||v.NextAction==NextActionCheckArtifact)&&v.VideoOperationId==nil{return errors.New("missing original operation")};if v.Code==VideoCodeExpertRequired&&(v.Status!=VideoStatusBlocked||v.NextAction!=NextActionUseExpert){return errors.New("invalid expert receipt")};`,
 },
 rust:{
 GenerateInput:`if self.prompt.contains(char::from(0))||forbidden_prompt_parameter(&self.prompt){return Err("invalid video prompt");}match self.image_mode{ImageMode::None if !self.image_indices.is_empty()=>return Err("unexpected images"),ImageMode::FirstFrame if self.image_indices.len()!=1=>return Err("one first frame required"),ImageMode::FirstLastFrames if self.image_indices.len()!=2=>return Err("two frame roles required"),ImageMode::ReferenceImages=>{if self.image_indices.is_empty(){return Err("reference images required");}for(i,n)in self.image_indices.iter().enumerate(){if self.image_indices[..i].contains(n){return Err("duplicate reference index");}}},_=>{}}`,
 VideoResult:`let ready=matches!(self.status,VideoStatus::Staged|VideoStatus::Committed);if ready!=(self.code==VideoCode::Ok)||self.artifact_id.is_some()!=self.delivery_turn_id.is_some()||self.provider_status.is_some()!=self.provider_observed_at.is_some()||self.candidates.is_some()!=self.candidates_complete.is_some(){return Err("inconsistent video receipt");}if self.artifact_id.is_some()&&(self.video_operation_id.is_none()||!matches!(self.code,VideoCode::Ok|VideoCode::DeliveryUnconfirmed)){return Err("invalid artifact reference");}if ready&&(self.artifact_id.is_none()||!matches!(self.next_action,NextAction::CheckArtifact|NextAction::ReportStatus)){return Err("invalid delivered receipt");}if self.status==VideoStatus::Staged&&self.next_action!=NextAction::CheckArtifact{return Err("staged receipt needs ACK check");}if self.code==VideoCode::DeliveryUnconfirmed&&(self.artifact_id.is_none()||self.status!=VideoStatus::Unknown||self.next_action!=NextAction::ReportStatus){return Err("invalid unconfirmed delivery");}if self.code==VideoCode::SelectionRequired{if self.candidates.is_none()||self.status!=VideoStatus::Blocked||self.next_action!=NextAction::SelectOperation||self.video_operation_id.is_some(){return Err("invalid selection receipt");}}else if self.candidates.is_some(){return Err("unexpected candidates");}if matches!(self.next_action,NextAction::GetVideoResult|NextAction::CheckArtifact)&&self.video_operation_id.is_none(){return Err("missing original operation");}if self.code==VideoCode::ExpertRequired&&(self.status!=VideoStatus::Blocked||self.next_action!=NextAction::UseExpert){return Err("invalid expert receipt");}`,
 }
};
const projected=projectTypes(schema.$defs,Object.keys(schema.$defs),{goPackage:'videogeneration',goImports:'"strings";',rules});
const constants={GenerateToolName:m.generate.name,GetToolName:m.get.name,GenerateDescription:m.generate.description,GetDescription:m.get.description,GeneratePath:h.generate_path,GetPath:h.get_path,MaxRequestBytes:h.max_request_bytes,MaxResponseBytes:h.max_response_bytes,BindingWaitMilliseconds:h.binding_wait_milliseconds,GenerateTimeoutSeconds:h.generate_timeout_seconds,GetTimeoutSeconds:h.get_timeout_seconds,ToolTimeoutSeconds:m.tool_timeout_seconds,ToolApprovalMode:m.approval_mode,Model:p.model,Endpoint:p.endpoint,PollIntervalSeconds:p.poll_interval_seconds,QueryTimeoutSeconds:p.query_timeout_seconds,DownloadTimeoutSeconds:p.download_timeout_seconds,MaxVideoBytes:p.max_video_bytes,MaxDownloads:p.max_downloads};
const goExtra=Object.entries(constants).map(([k,v])=>`const ${k}=${q(v)}\n`).join('')+`
var AllowedVideoHosts=[...]string{${p.allowed_video_hosts.map(q).join(',')}}
func forbiddenPromptParameter(value string)bool{for _,word:=range strings.Fields(value){if strings.HasPrefix(word,"--"){name:=strings.SplitN(word[2:],"=",2)[0];switch name{case ${p.forbidden_prompt_parameters.map(q).join(',')}:return true}}};return false}
func(v VideoResult)IsError()bool{switch v.Code{case VideoCodeOk,VideoCodeProviderPending,VideoCodeExistingOperation,VideoCodeSelectionRequired:return false;default:return true}}
`;
function expand(value){if(Array.isArray(value))return value.map(expand);if(!value||typeof value!=='object')return value;if(value.$ref)return expand(schema.$defs[value.$ref.split('/').at(-1)]);return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v)]));}
const inputSchemas={generate:expand(schema.$defs.GenerateInput),get:expand(schema.$defs.GetInput)};
const rustExtra=Object.entries(constants).map(([k,v])=>`pub const ${k.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:${typeof v==='string'?'&str':'u64'}=${q(v)};\n`).join('')+`
pub const GENERATE_INPUT_SCHEMA:&str=${q(q(inputSchemas.generate))};
pub const GET_INPUT_SCHEMA:&str=${q(q(inputSchemas.get))};
fn valid_uuid(value:&str)->bool {value.len()==36&&value.bytes().enumerate().all(|(i,b)|if [8,13,18,23].contains(&i){b==b'-'}else{b.is_ascii_digit()||(b'a'..=b'f').contains(&b)})}
fn forbidden_prompt_parameter(value:&str)->bool {value.split_whitespace().any(|word|word.strip_prefix("--").is_some_and(|rest|[${p.forbidden_prompt_parameters.map(q).join(',')}].contains(&rest.split('=').next().unwrap_or(""))))}
impl VideoResult{pub fn is_error(&self)->bool{!matches!(self.code,VideoCode::Ok|VideoCode::ProviderPending|VideoCode::ExistingOperation|VideoCode::SelectionRequired)}}
`;
const banner='// Generated from video-generation/v1. DO NOT EDIT.\n';
const outputs=new Map([
 ['sdks/go/videogeneration/types.gen.go',execFileSync('gofmt',[],{input:banner+projected.go+goExtra})],
 ['sdks/rust/videogeneration/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:banner+projected.rust+rustExtra})],
 ['sdks/typescript/src/jsonschema/video-generation.gen.ts',await compile({...schema,anyOf:Object.keys(schema.$defs).map(n=>({$ref:'#/$defs/'+n}))},'VideoGenerationV1',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true})],
 ['sdks/jsonschema/video-generation-tools.gen.json',q(inputSchemas)+'\n'],
]);
const lock='compatibility/video-generation/source.lock.json';
const base=existsSync(path.join(root,lock))?JSON.parse(read(lock)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
outputs.set(lock,JSON.stringify({schema_version:1,feature:'FEAT-173',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[source,'compatibility/video-generation/examples.json','scripts/generate-video-generation.mjs','scripts/market-broker-codegen.mjs'].map(file=>({path:file,sha256:hash(read(file))})),generated:[...outputs].map(([file,bytes])=>({path:file,sha256:hash(bytes)}))},null,2)+'\n');
function put(target,bytes){if(check)assert.deepEqual(readFileSync(target),Buffer.from(bytes),target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
for(const [name,bytes]of outputs)put(path.join(root,name),bytes);
if(args.includes('--consumer=host'))for(const[src,dst]of[
 [source,'api/schemas/video-generation-v1.schema.json'],
 ['compatibility/video-generation/examples.json','api/fixtures/video-generation-v1.examples.json'],
 ['sdks/go/videogeneration/types.gen.go','internal/contracts/videogeneration/types.gen.go'],
 ['sdks/rust/videogeneration/types.gen.rs','artifact-mcp/src/video_types.gen.rs'],
 [lock,'api/video-generation.candidate.json']
])put(path.join(root,'../yijie-agent-host',dst),read(src));
console.log('Video generation source/consumer '+(check?'verified':'generated')+'; local additive candidate, fixed Runtime unchanged.');
