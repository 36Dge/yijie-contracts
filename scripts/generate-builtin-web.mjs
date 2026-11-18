// FEAT-175 isolated candidate generation. No Runtime build, provider or secrets.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {compile} from 'json-schema-to-typescript';
import Ajv from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import ucs2length from 'ajv/dist/runtime/ucs2length.js';
import {family, root, loadBuiltinWebSource, nativeOpenApiSchema as openapi} from './builtin-web-source.mjs';

const args = process.argv.slice(2);
assert(args.every(a => ['--check', '--consumer=host', '--consumer=api', '--consumer=connectors', '--consumer=desktop'].includes(a)));
const check = args.includes('--check');
const read = p => readFileSync(path.resolve(root, p));
const hash = v => createHash('sha256').update(v).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
const {schema, policy, portableTools, tools, standalone} = loadBuiltinWebSource();
const credentialPipe = JSON.parse(read('compatibility/market-broker-control/control.json')).kimi_model_credential;
const runtimeLock = JSON.parse(read('compatibility/runtime-tool-search/source.lock.json'));
const artifact = path.resolve(root, '../yijie-codex', runtimeLock.runtime_relative_path);
const manifest = readFileSync(path.join(artifact, 'runtime-manifest.json'));
assert.equal(hash(manifest), runtimeLock.runtime_manifest_sha256);
const runtime = JSON.parse(manifest);
assert.equal(hash(readFileSync(path.join(artifact, 'codex'))), runtime.runtime.sha256);
const names = ['McpServerElicitationRequestParams', 'McpServerElicitationRequestResponse'];
const canonical = Object.fromEntries(names.map(n => [n, readFileSync(path.join(artifact, 'generated-json-schema', n + '.json'))]));
// The complete canonical schemas remain separately bundled as validity authority.
const definitions = {};
for (const [name, bytes] of Object.entries(canonical)) {
  const s = JSON.parse(bytes);
  definitions[name] = openapi(s);
  Object.assign(definitions, openapi(s.definitions, true));
}
const spec = {openapi: '3.0.3', info: {title: 'Canonical native MCP elicitation', version: '0.1.0'}, paths: {}, components: {schemas: definitions}};
const temporary = path.join(root, '.local/builtin-web-native.openapi.json');
mkdirSync(path.dirname(temporary), {recursive: true}); writeFileSync(temporary, json(spec));
const nativeGo = execFileSync('go', ['tool', 'oapi-codegen', '-generate', 'types,skip-prune', '-package', 'builtinweb', temporary], {cwd: root, env: {...process.env, GOPROXY: 'off'}});
// HTTP/control DTOs derive from the same validity authority. Conditional
// constraints remain in wire.schema.json and are checked by consumers.
function wireOpenApi(value) {
  if (Array.isArray(value)) return value.map(wireOpenApi);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (['$id', '$schema', '$defs', 'if', 'then', 'else', 'allOf'].includes(key)) continue;
    if (key === '$ref') out[key] = child.replace('#/$defs/', '#/components/schemas/');
    else if (key === 'const') out.enum = [child];
    else out[key] = wireOpenApi(child);
  }
  return out;
}
const wireTemporary = path.join(root, '.local/builtin-web-wire.openapi.json');
writeFileSync(wireTemporary, json({openapi: '3.0.3', info: {title: 'Builtin web wire types', version: policy.contract_version}, paths: {}, components: {schemas: wireOpenApi(schema.$defs)}}));
const wireGo = execFileSync('go', ['tool', 'oapi-codegen', '-generate', 'types,skip-prune', '-package', 'builtinweb', wireTemporary], {cwd: root, env: {...process.env, GOPROXY: 'off'}});
const banner = '// Generated from builtin-web-retrieval/1. DO NOT EDIT.\n';
const constants = execFileSync('gofmt', {input: banner + `package builtinweb
import _ "embed"
const ServerName = ${JSON.stringify(policy.server_name)}
const ServerInstructions = ${JSON.stringify(policy.server_instructions)}
const ApprovalMode = ${JSON.stringify(policy.approval_mode)}
const ToolTimeoutSeconds = ${policy.tool_timeout_seconds}
const StartupTimeoutSeconds = ${policy.startup_timeout_seconds}
const SubjectConcurrency = ${policy.parameters.subject_concurrency}
const APIIdentity = ${JSON.stringify(policy.service_identities.api)}
const ExecutorIdentity = ${JSON.stringify(policy.service_identities.executor)}
const LocalAPIOrigin = ${JSON.stringify(policy.local_demo.api_origin)}
const LocalCredentialEnvironment = ${JSON.stringify(policy.local_demo.credential_environment_key)}
const LocalEpochHeader = ${JSON.stringify(policy.local_demo.epoch_header)}
const LocalOwnerID = ${JSON.stringify(policy.local_demo.owner_user_id)}
const LocalTenantID = ${JSON.stringify(policy.local_demo.tenant_id)}
const RetiredServiceID = ${JSON.stringify(policy.local_demo.retired_service_id)}
const CredentialPipeEnvironmentKey = ${JSON.stringify(credentialPipe.environmentKey)}
const CredentialPipePreamble = ${JSON.stringify(credentialPipe.preamble)}
const CredentialPipeTerminator = ${JSON.stringify(credentialPipe.terminator)}
const CredentialPipeMaxKeyBytes = ${credentialPipe.maxKeyBytes}
const MaxResultBytes = ${policy.parameters.mcp_result_bytes}
var ToolNames = [...]string{${policy.tools.map(t => JSON.stringify(t.name)).join(',')}}
var ErrorMessages = map[string]string{${Object.entries(policy.error_messages).map(([code, message]) => JSON.stringify(code)+':'+JSON.stringify(message)).join(',')},}
type ExpertPolicy struct { ExpertID, Version, RoleSHA256, Policy string }
var ExpertPolicies = [...]ExpertPolicy{${policy.expert_policies.map(p => '{' + [p.expert_id, p.version, p.role_sha256, p.policy].map(JSON.stringify).join(',') + '}').join(',')},}
//go:embed tools.json
var Tools []byte
//go:embed wire.schema.json
var Schema []byte
`});
const outputs = new Map([
  ['sdks/go/builtinweb/native.gen.go', nativeGo],
  ['sdks/go/builtinweb/wire.gen.go', wireGo],
  ['sdks/go/builtinweb/policy.gen.go', constants],
  ['sdks/go/builtinweb/tools.json', json(portableTools)],
  ['sdks/go/builtinweb/wire.schema.json', json(schema)],
  ['sdks/jsonschema/builtin-web-retrieval.schema.json', json(schema)],
  ['sdks/jsonschema/builtin-web-retrieval.tools.json', json(tools)],
  ['sdks/rust/builtinweb/source.gen.rs', banner + `pub const TOOLS_JSON: &str = ${JSON.stringify(JSON.stringify(tools))};\npub const SCHEMA_JSON: &str = ${JSON.stringify(JSON.stringify(schema))};\npub const ERROR_MESSAGES_JSON: &str = ${JSON.stringify(JSON.stringify(policy.error_messages))};\npub const LOCAL_API_ORIGIN: &str = ${JSON.stringify(policy.local_demo.api_origin)};\npub const LOCAL_CREDENTIAL_ENVIRONMENT: &str = ${JSON.stringify(policy.local_demo.credential_environment_key)};\npub const LOCAL_EPOCH_HEADER: &str = ${JSON.stringify(policy.local_demo.epoch_header)};\npub const RETIRED_SERVICE_ID: &str = ${JSON.stringify(policy.local_demo.retired_service_id)};\n`],
]);
outputs.set('sdks/rust/builtinweb/source.gen.rs', outputs.get('sdks/rust/builtinweb/source.gen.rs')
  + `pub const SERVER_INSTRUCTIONS: &str = ${JSON.stringify(policy.server_instructions)};\npub const SUBJECT_CONCURRENCY: usize = ${policy.parameters.subject_concurrency};\npub const GATEWAY_QUEUE_WAIT_SECONDS: u64 = ${policy.parameters.gateway_queue_wait_seconds};\n`);
outputs.set('sdks/go/builtinweb/validate.gen.go', execFileSync('gofmt', {input: banner + `package builtinweb
import("bytes";"encoding/json";"errors";"regexp";"strings";"sync";"github.com/santhosh-tekuri/jsonschema/v6")
var once sync.Once
var compiled map[string]*jsonschema.Schema
var compileError error
func Validate(name string, raw []byte) error {
 once.Do(func(){
  var doc map[string]any
  if compileError=json.Unmarshal(Schema,&doc);compileError!=nil{return}
  c:=jsonschema.NewCompiler();c.AssertFormat()
  // RE2 lacks the source DateBound negative lookahead. This equivalent finite
  // year expression preserves 0001..9999 without adding another regex engine.
  c.UseRegexpEngine(func(pattern string)(jsonschema.Regexp,error){
   pattern=strings.Replace(pattern,"^(?!0000)[0-9]{4}","^([1-9][0-9]{3}|0[1-9][0-9]{2}|00[1-9][0-9]|000[1-9])",1)
   return regexp.Compile(pattern)
  })
  const uri="https://contracts.yijie.ai/local/builtin-web.json"
  if compileError=c.AddResource(uri,doc);compileError!=nil{return}
  compiled=make(map[string]*jsonschema.Schema)
  for key:=range doc["$defs"].(map[string]any){compiled[key],compileError=c.Compile(uri+"#/$defs/"+key);if compileError!=nil{return}}
 })
 if compileError!=nil{return compileError}
 if compiled[name]==nil || !json.Valid(raw){return errors.New("invalid web payload")}
 var value any
 decoder:=json.NewDecoder(bytes.NewReader(raw));decoder.UseNumber()
 if decoder.Decode(&value)!=nil || compiled[name].Validate(value)!=nil{return errors.New("invalid web payload")};return nil
}
`}));
function sensitive(value, seen = new Set()) {
  if(!value || typeof value!=='object') return false;
  if(value['x-sensitive']) return true;
  if(value.$ref) {
    const name=value.$ref.split('/').at(-1);
    if(!seen.has(name) && schema.$defs[name]) {seen.add(name);if(sensitive(schema.$defs[name],seen))return true;}
  }
  return Object.values(value).some(child=>sensitive(child,new Set(seen)));
}
const sensitiveTypes=Object.entries(schema.$defs).filter(([,value])=>sensitive(value)).map(([name])=>name);
outputs.set('sdks/go/builtinweb/redact.gen.go',execFileSync('gofmt',{input:banner+'package builtinweb\n'+sensitiveTypes.map(name=>`func (${name}) String() string {return "${name}([redacted])"}\nfunc (value ${name}) GoString() string {return value.String()}\n`).join('')}));
for (const [name, bytes] of Object.entries(canonical)) outputs.set('sdks/jsonschema/builtin-web-native/' + name + '.json', bytes);
let nativeTS = '';
for (const [name, bytes] of Object.entries(canonical)) nativeTS += await compile(JSON.parse(bytes), name, {bannerComment: banner.trim(), unknownAny: true, ignoreMinAndMaxItems: true});
outputs.set('sdks/typescript/src/domain/builtin-web-native.generated.ts', nativeTS);
const tsSchema = structuredClone(schema);
// The runtime schema retains conditional validity; TypeScript is shape-only.
for (const definition of Object.values(tsSchema.$defs)) delete definition.allOf;
outputs.set('sdks/typescript/src/domain/builtin-web.generated.ts',
  await compile({...tsSchema, anyOf: Object.keys(tsSchema.$defs).map(n => ({$ref: '#/$defs/' + n}))}, 'BuiltinWebV1', {bannerComment: banner.trim(), additionalProperties: false, unknownAny: true, ignoreMinAndMaxItems: true})
  + `\nexport const RETIRED_SERVICE_ID = ${JSON.stringify(policy.local_demo.retired_service_id)} as const;\n`);
const browser = new Ajv({strict:true, allErrors:true, code:{source:true,esm:true}});
browser.addSchema({...standalone('AppErrorOutput'),$id:'urn:yijie:builtin-web:error'});
let browserError = standaloneCode(browser,{validateBuiltinWebErrorOutput:'urn:yijie:builtin-web:error'}).replaceAll('require("ajv/dist/runtime/ucs2length").default','('+ucs2length.default.toString()+')');
assert(!browserError.includes('require('));
outputs.set('sdks/typescript/src/api/generated/builtin-web-error-validator.gen.js', banner+'/* AJV helper license:\n'+read('node_modules/ajv/LICENSE').toString()+'*/\n'+browserError);
outputs.set('sdks/typescript/src/api/generated/builtin-web-error-validator.gen.d.ts',banner+'import type { AppErrorOutput } from "../../domain/builtin-web.generated";\nexport declare const validateBuiltinWebErrorOutput: ((value: unknown) => value is AppErrorOutput) & {errors?: unknown};\n');
const lockPath = family + '/source.lock.json';
const sources = [family + '/wire.schema.json', family + '/policy.json', 'openapi/public/web-retrieval.yaml', 'openapi/internal/web-retrieval.yaml', 'openapi/agent-host/builtin-web.yaml', 'openapi/local/web-retrieval.yaml', 'compatibility/web-retrieval/wire.schema.json', 'compatibility/web-retrieval/tools.json', 'compatibility/market-broker-control/control.json', 'compatibility/runtime-tool-search/source.lock.json', 'scripts/builtin-web-source.mjs', 'scripts/generate-builtin-web.mjs', 'scripts/generation-plan.mjs', 'pnpm-lock.yaml', 'go.mod', 'go.sum'];
const base = existsSync(path.join(root, lockPath)) ? JSON.parse(read(lockPath)).base_commit : execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const lock = {schema_version: 1, feature: 'FEAT-175', contract_version: policy.contract_version, mode: 'local_worktree_candidate', release: false, base_commit: base,
  runtime_relative_path: runtimeLock.runtime_relative_path, runtime_manifest_sha256: hash(manifest), runtime_binary_sha256: runtime.runtime.sha256,
  canonical_schemas: Object.fromEntries(Object.entries(canonical).map(([n, b]) => [n, hash(b)])),
  sources: sources.map(p => ({path: p, sha256: hash(read(p))})), generated: [...outputs].map(([p, b]) => ({path: p, sha256: hash(b)}))};
outputs.set(lockPath, json(lock));
for (const consumer of ['host', 'api', 'connectors']) if (args.includes('--consumer=' + consumer)) {
  const repo = consumer === 'host' ? 'yijie-agent-host' : 'yijie-' + consumer;
  for (const [p, b] of [...outputs]) if (p.startsWith('sdks/go/builtinweb/')) outputs.set('../' + repo + '/internal/contracts/builtinweb/' + path.basename(p), b);
  outputs.set('../' + repo + (consumer === 'host' ? '/api/' : '/contracts/') + 'builtin-web.candidate.json', json(lock));
}
for (const consumer of ['connectors', 'desktop']) if (args.includes('--consumer=' + consumer)) {
  const repo = '../yijie-' + consumer;
  const destination = consumer === 'connectors' ? '/worker/src/' : '/src-tauri/src/contracts/';
  outputs.set(repo + destination + 'builtin_web_generated.rs', outputs.get('sdks/rust/builtinweb/source.gen.rs'));
  outputs.set(repo + '/contracts/builtin-web.candidate.json', json(lock));
  if(consumer==='desktop') {
    for(const [p,b] of [...outputs]) if(p.startsWith('sdks/typescript/src/') && p.includes('/builtin-web')) outputs.set(repo+'/src/'+p.slice('sdks/typescript/src/'.length),b);
  }
}
for (const [p, value] of outputs) {
  const target = path.resolve(root, p), bytes = Buffer.from(value);
  if (check) assert.deepEqual(readFileSync(target), bytes, p);
  else { mkdirSync(path.dirname(target), {recursive: true}); writeFileSync(target, bytes); }
}
console.log('FEAT-175 source/SDK ' + (check ? 'verified' : 'generated') + '; unpublished candidate, fixed Runtime unchanged, zero external calls.');
