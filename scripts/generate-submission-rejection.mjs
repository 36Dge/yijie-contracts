import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {projectTypes} from './market-broker-codegen.mjs';
import {formatSourceFile} from './format-source-file.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check'),consumer=args.find(a=>a.startsWith('--consumer='))?.slice(11);
assert(args.every(a=>['--check','--consumer=host','--consumer=desktop'].includes(a)));
const source='jsonschema/agent/market-submission-rejection-v1.schema.json';
const read=p=>readFileSync(path.join(root,p)),hash=b=>createHash('sha256').update(b).digest('hex');
const schema=JSON.parse(read(source)),defs=structuredClone(schema.$defs);
const sources=[source,'openapi/agent-host/market-submission-rejection-v1.yaml','openapi/market-connectors/market-connectors.yaml','compatibility/market-selection/wire.schema.json','scripts/generate-submission-rejection.mjs','scripts/market-broker-codegen.mjs','scripts/format-source-file.mjs'];
for(const name of ['CanonicalId','SelectionDigest']){
 const [relative,pointer]=defs[name].$ref.split('#');const file=path.posix.normalize(path.posix.join(path.posix.dirname(source),relative));assert(sources.includes(file));
 defs[name]=pointer.split('/').slice(1).reduce((v,k)=>v[k],YAML.parse(read(file).toString()));
}
const rules={patterns:{
 '^[0-9a-f]{64}$':e=>`if ${e}.len()!=64||!${e}.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid digest");}`,
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$':e=>`if ${e}.len()!=36||!${e}.bytes().enumerate().all(|(i,b)|if [8,13,18,23].contains(&i){b==b'-'}else{b.is_ascii_digit()||(b'a'..=b'f').contains(&b)}){return Err("invalid identity");}`,
}};
const projection=projectTypes(defs,Object.keys(defs),{goPackage:'submissionrejection',rules});
const banner='// Generated from market-submission-rejection-v1; DO NOT EDIT.\n';
const output=new Map([
 ['sdks/go/submissionrejection/types.gen.go',formatSourceFile('gofmt',[],banner+projection.go)],
 ['sdks/rust/submissionrejection/types.gen.rs',formatSourceFile('rustfmt',['--edition','2021'],banner+projection.rust)],
 ['sdks/jsonschema/market-submission-rejection-v1.schema.json',JSON.stringify({...schema,$defs:defs},null,2)+'\n'],
]);
const lock='compatibility/submission-rejection/source.lock.json';
const base=existsSync(path.join(root,lock))?JSON.parse(read(lock)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
output.set(lock,JSON.stringify({schema_version:1,feature:'FEAT-174',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(read(p))})),generated:[...output].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
function put(p,b){if(check)assert.deepEqual(readFileSync(p),Buffer.from(b),p);else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,b);}}
for(const[p,b]of output)put(path.join(root,p),b);
const pairs=consumer==='host'?[['sdks/go/submissionrejection/types.gen.go','internal/contracts/submissionrejection/types.gen.go'],['sdks/jsonschema/market-submission-rejection-v1.schema.json','api/schemas/market-submission-rejection-v1.schema.json'],[lock,'api/submission-rejection.candidate.json']]:consumer==='desktop'?[['sdks/rust/submissionrejection/types.gen.rs','src-tauri/src/chat/connectors/submission_rejection_generated.rs'],[lock,'contracts/submission-rejection.candidate.json']]:[];
for(const[src,dst]of pairs)put(path.join(root,'../yijie-'+(consumer==='host'?'agent-host':consumer),dst),read(src));
console.log('Submission rejection proof '+(check?'verified':'generated')+'; read-only local candidate.');
