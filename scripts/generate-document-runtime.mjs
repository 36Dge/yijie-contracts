import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const consumer = process.argv.find(x => x.startsWith('--consumer='))?.split('=')[1];
assert(process.argv.slice(2).every(x => x === '--check' || ['--consumer=host','--consumer=desktop'].includes(x)));
const sourcePath = 'jsonschema/document-runtime/v1.schema.json';
const bytes = readFileSync(path.join(root, sourcePath));
const schema = JSON.parse(bytes);
const hash = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x, null, 2) + '\n';
function typeOf(t, lang) {
  if (lang === 'ts' && t.const !== undefined) return JSON.stringify(t.const);
  if (lang === 'ts' && t.enum) return t.enum.map(v=>JSON.stringify(v)).join(' | ');
  if (t.$ref) return t.$ref.split('/').at(-1);
  if (t.type === 'array') return lang === 'go' ? `[]${typeOf(t.items,lang)}` : lang === 'ts' ? `Array<${typeOf(t.items,lang)}>` : `Vec<${typeOf(t.items,lang)}>`;
  return ({string:lang==='rust'?'String':'string',integer:lang==='go'?'int64':lang==='ts'?'number':'u64',boolean:lang==='ts'?'boolean':'bool'})[t.type] ?? assert.fail('unsupported schema type');
}
let go = '// Generated from document-runtime/v1; DO NOT EDIT.\npackage documentruntime\n';
let rust = '// Generated from document-runtime/v1; DO NOT EDIT.\n';
let ts = '// Generated from document-runtime/v1; DO NOT EDIT.\n';
for (const [name,d] of Object.entries(schema.definitions)) {
  assert.equal(d.additionalProperties, false);
  go += `type ${name} struct {\n`;
  ts += `export interface ${name} {\n`;
  rust += `#[derive(Clone,serde::Serialize,serde::Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct ${name} {\n`;
  for (const [field,t] of Object.entries(d.properties)) {
    const optional = !d.required.includes(field);
    ts += `${field}${optional?'?':''}: ${typeOf(t,'ts')};\n`;
    const title = field.split('_').map(v=>v[0].toUpperCase()+v.slice(1)).join('');
    go += `${title} ${optional?'*':''}${typeOf(t,'go')} \`json:"${field}${optional?',omitempty':''}"\`\n`;
    rust += `${optional?'#[serde(default,skip_serializing_if="Option::is_none")]\n':''}pub ${field==='type'?'r#type':field}: ${optional?`Option<${typeOf(t,'rust')}>`:typeOf(t,'rust')},\n`;
  }
  go+='}\n';rust+='}\n';ts+='}\n';
}
const formats=schema.definitions.EnvironmentInput.properties.format.enum;
go+=`func FormatAllowed(value string) bool { switch value { case ${formats.map(JSON.stringify).join(',')}: return true };return false }\n`;
const outputs = new Map([
  ['sdks/go/documentruntime/types.gen.go',execFileSync('gofmt',[],{input:go})],
  ['sdks/rust/documentruntime/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
  ['sdks/typescript/src/jsonschema/document-runtime.gen.ts',ts],
]);
const lockPath='compatibility/document-runtime/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(readFileSync(path.join(root,lockPath))).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
outputs.set(lockPath,json({schema_version:1,feature:'FEAT-171',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[sourcePath,'scripts/generate-document-runtime.mjs'].map(p=>({path:p,sha256:hash(readFileSync(path.join(root,p)))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))}));
function put(target,data){if(check)assert.deepEqual(readFileSync(target),Buffer.from(data),target);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,data);}}
for(const [p,b] of outputs)put(path.join(root,p),b);
if(consumer){
  const pairs=consumer==='host'?[[sourcePath,'api/schemas/document-runtime-v1.schema.json'],['sdks/go/documentruntime/types.gen.go','internal/contracts/documentruntime/types.gen.go'],['sdks/rust/documentruntime/types.gen.rs','artifact-mcp/src/document_types.gen.rs'],[lockPath,'api/document-runtime.candidate.json']]:[[sourcePath,'contracts/document-runtime-v1.schema.json'],['sdks/rust/documentruntime/types.gen.rs','src-tauri/src/chat/document_runtime_generated.rs'],[lockPath,'contracts/document-runtime.candidate.json']];
  for(const [src,dst] of pairs)put(path.join(root,'..',consumer==='host'?'yijie-agent-host':'yijie-desktop',dst),readFileSync(path.join(root,src)));
}
console.log('Document runtime contract generated/verified; old artifact publisher and events unchanged.');
