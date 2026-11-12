// FEAT-172 local source-first MCP/Host projection. No provider or Runtime calls.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'json-schema-to-typescript';
import {projectTypes} from './market-broker-codegen.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
assert(args.every(x=>['--check','--consumer=host'].includes(x)));
const sourcePath='jsonschema/media-generation/v1.schema.json';
const read=p=>readFileSync(path.join(root,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const schema=JSON.parse(read(sourcePath));
const rules={
  go:{
    GenerateInput:'if !utf8.ValidString(v.Prompt)||strings.TrimSpace(v.Prompt)==""||strings.ContainsRune(v.Prompt,0){return errors.New("invalid image prompt")};',
    GenerateResult:'ready:=v.Status==GenerateStatusStaged||v.Status==GenerateStatusCommitted;if ready!=(v.Code==GenerateCodeOk)||ready!=(v.ArtifactId!=nil)||(ready&&v.NextAction!=NextActionCheckArtifact){return errors.New("inconsistent image result")};',
  },
  rust:{
    GenerateInput:'if self.prompt.trim().is_empty()||self.prompt.contains(char::from(0)){return Err("invalid image prompt");}',
    GenerateResult:'let ready=matches!(self.status,GenerateStatus::Staged|GenerateStatus::Committed);if ready!=(self.code==GenerateCode::Ok)||ready!=self.artifact_id.is_some()||(ready&&self.next_action!=NextAction::CheckArtifact){return Err("inconsistent image result");}',
  },
};
const projection=projectTypes(schema.$defs,Object.keys(schema.$defs),{goPackage:'mediageneration',goImports:'"strings";',rules});
const policy=schema['x-mcp'];
const routes=schema['x-expert-routes'];
assert(Array.isArray(routes)&&routes.length>0);
const routeKeys=['route','expertId','version','roleSha256','service','proxy','method'];
assert(routes.every(r=>routeKeys.every(k=>typeof r[k]==='string'&&r[k].length>0)));
const goConstants=`\nconst ToolName=${JSON.stringify(policy.tool)}\nconst ToolDescription=${JSON.stringify(policy.description)}\nconst PrivatePath=${JSON.stringify(schema['x-private-http'].path)}\nconst ToolApprovalMode=${JSON.stringify(policy.approval_mode)}\nconst BindingWaitMilliseconds=${schema['x-private-http'].binding_wait_milliseconds}\nconst ToolTimeoutSeconds=${policy.tool_timeout_seconds}\ntype ExpertImageRoute struct{Route,ExpertID,Version,RoleSHA256,Service,Proxy,Method string}\nvar ExpertImageRoutes=[...]ExpertImageRoute{${routes.map(r=>'{'+routeKeys.map(k=>JSON.stringify(r[k])).join(',')+'}').join(',')},}\n`;
const rustConstants=`\npub const TOOL_NAME:&str=${JSON.stringify(policy.tool)};\npub const TOOL_DESCRIPTION:&str=${JSON.stringify(policy.description)};\npub const PRIVATE_PATH:&str=${JSON.stringify(schema['x-private-http'].path)};\npub const TOOL_TIMEOUT_SECONDS:u64=${policy.tool_timeout_seconds};\npub const IMAGE_EXPERT_SERVICES:&[(&str,&str,&str,&str)]=&[${routes.map(r=>'('+[r.expertId,r.version,r.roleSha256,r.service].map(JSON.stringify).join(',')+')').join(',')}];\n`;
const banner='// Generated from media-generation/v1; DO NOT EDIT.\n';
const outputs=new Map([
  ['sdks/go/mediageneration/types.gen.go',execFileSync('gofmt',[],{input:banner+projection.go+goConstants})],
  ['sdks/rust/mediageneration/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:banner+projection.rust+rustConstants})],
  ['sdks/typescript/src/jsonschema/media-generation.gen.ts',await compile({...schema,anyOf:Object.keys(schema.$defs).map(n=>({$ref:'#/$defs/'+n}))},'MediaGenerationV1',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true})],
]);
const lockPath='compatibility/media-generation/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
outputs.set(lockPath,json({schema_version:1,feature:'FEAT-172',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[sourcePath,'scripts/generate-media-generation.mjs','scripts/market-broker-codegen.mjs'].map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))}));
function put(p,b){if(check)assert.deepEqual(readFileSync(p),Buffer.from(b),p);else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,b);}}
for(const[p,b]of outputs)put(path.join(root,p),b);
if(args.includes('--consumer=host'))for(const[src,dst]of[
  [sourcePath,'api/schemas/media-generation-v1.schema.json'],
  ['sdks/go/mediageneration/types.gen.go','internal/contracts/mediageneration/types.gen.go'],
  ['sdks/rust/mediageneration/types.gen.rs','artifact-mcp/src/media_types.gen.rs'],
  [lockPath,'api/media-generation.candidate.json'],
])put(path.join(root,'../yijie-agent-host',dst),read(src));
console.log('Media generation source/consumer '+(check?'verified':'generated')+'; local candidate, fixed Runtime unchanged.');
