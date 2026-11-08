import { existsSync } from "node:fs";
// Source-first display contract and exact canonical Runtime input types.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import Ajv from 'ajv';
import standalone from 'ajv/dist/standalone/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check'), sync = process.argv.includes('--sync');
assert(process.argv.slice(2).every(a => ['--check', '--sync'].includes(a)));
const read = p => readFileSync(path.resolve(root, p));
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = 'openapi/context-window/context-window.yaml';
const spec = JSON.parse(read(source));
const defs = spec.components.schemas;
const nativeLockPath = 'compatibility/runtime-interaction-tools/source.lock.json';
const nativeLock = JSON.parse(read(nativeLockPath));
const nativePath = '../yijie-codex/' + nativeLock.runtime_relative_path + '/generated-json-schema/v2/ThreadTokenUsageUpdatedNotification.json';
const native = JSON.parse(read(nativePath));
const outputs = new Map();
function jsonSchema(s) {
  if (Array.isArray(s)) return s.map(jsonSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) if (k !== 'nullable') out[k] = k === '$ref' ? v.replace('#/components/schemas/', '#/definitions/') : jsonSchema(v);
  return s.nullable ? { anyOf: [out, { type: 'null' }] } : out;
}
const schema = { $schema: 'http://json-schema.org/draft-07/schema#', definitions: jsonSchema(defs) };
outputs.set('sdks/jsonschema/context-window.schema.json', json(schema));
outputs.set('sdks/jsonschema/context-window-native.schema.json', json(native));
outputs.set('sdks/typescript/src/openapi/context-window.gen.ts', Buffer.from(astToString(await openapiTS(spec, { defaultNonNullable: false }))));
const ajv = new Ajv({ strict: false, code: { source: true, esm: true }, formats: {
  int64: true,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'date-time': /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/,
} });
for (const name of Object.keys(defs)) ajv.addSchema({ ...schema.definitions[name], definitions: schema.definitions }, name);
const names = ['ContextWindowSnapshot', 'ContextWindowQuery'];
let validator = standalone(ajv, Object.fromEntries(names.map(n => ['validate' + n, n])));
validator = validator.replaceAll('require("ajv/dist/runtime/ucs2length").default', 'ucs2length');
outputs.set('sdks/typescript/src/context-window-validator.gen.js', Buffer.from('/* Generated; do not edit. */\nimport ucs2lengthModule from "ajv/dist/runtime/ucs2length.js";\nconst ucs2length = typeof ucs2lengthModule === "function" ? ucs2lengthModule : ucs2lengthModule.default;\n' + validator));
outputs.set('sdks/typescript/src/context-window-validator.gen.d.ts', Buffer.from(names.map(n => `export function validate${n}(value: unknown): boolean;`).join('\n') + '\n'));
function nativeOpenapi(s) {
  if (Array.isArray(s)) return s.map(nativeOpenapi);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (['$schema', 'definitions', 'title'].includes(k)) continue;
    if (k === '$ref') out[k] = v.replace('#/definitions/', '#/components/schemas/');
    else if (k === 'type' && Array.isArray(v)) { out.type = v.find(t => t !== 'null'); out.nullable = v.includes('null'); }
    else out[k] = nativeOpenapi(v);
  }
  return out;
}
const scratch = mkdtempSync(path.join(os.tmpdir(), 'yijie-context-window-codegen-'));
try {
  for (const [file, document] of [
    ['types.gen.go', spec],
    ['runtime.gen.go', { openapi: '3.0.3', info: { title: 'Native token usage', version: '0.1.0' }, paths: {}, components: { schemas: { ThreadTokenUsageUpdatedNotification: nativeOpenapi(native), ...nativeOpenapi(native.definitions) } } }],
  ]) {
    const input = path.join(scratch, 'source.json'); writeFileSync(input, json(document));
    outputs.set('sdks/go/openapi/context-window/' + file, execFileSync('go', ['tool', 'oapi-codegen', '-generate', 'types,skip-prune', '-package', 'contextwindow', input], { cwd: root }));
  }
} finally { rmSync(scratch, { recursive: true }); }
const snake = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
function rustType(s) {
  if (s.allOf) return rustType(s.allOf[0]);
  if (s.$ref) return s.$ref.split('/').at(-1);
  if (s.type === 'string') return 'String';
  if (s.type === 'integer') return 'i64';
  if (s.type === 'boolean') return 'bool';
  if (s.type === 'array') return `Vec<${rustType(s.items)}>`;
  throw Error('Unsupported context type');
}
function rustCheck(s, v) {
  if (s.allOf) return rustCheck(s.allOf[0], v);
  if (s.$ref) return `${v}.validate()?;`;
  const fail = 'return Err("invalid context window");';
  let c = '';
  if (s.enum) c += `if ![${s.enum.map(JSON.stringify).join(',')}].contains(${s.type === 'string' ? '&' + v + '.as_str()' : v}){${fail}}`;
  if (s.minLength) c += `if ${v}.chars().count()<${s.minLength}{${fail}}`;
  if (s.maxLength) c += `if ${v}.chars().count()>${s.maxLength}{${fail}}`;
  if (s.minimum !== undefined) c += `if *${v}<${s.minimum}{${fail}}`;
  if (s.maximum !== undefined) c += `if *${v}>${s.maximum}{${fail}}`;
  if (s.format === 'uuid') c += `if uuid::Uuid::parse_str(${v}).is_err(){${fail}}`;
  if (s.format === 'date-time') c += `if chrono::DateTime::parse_from_rfc3339(${v}).is_err(){${fail}}`;
  if (s.type === 'array') c += `if ${v}.len()>${s.maxItems}{${fail}}for entry in ${v}{${rustCheck(s.items, 'entry')}}`;
  return c;
}
let rust = '// Generated from context-window source. DO NOT EDIT.\nfn required_nullable<\'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<\'de>,T:serde::Deserialize<\'de>{<Option<T> as serde::Deserialize<\'de>>::deserialize(d)}\n';
for (const [name, def] of Object.entries(defs)) {
  assert.equal(def.additionalProperties, false);
  assert.equal(def.required.length, Object.keys(def.properties).length);
  const fields = [], checks = [];
  for (const [field, s] of Object.entries(def.properties)) {
    const f = snake(field), type = rustType(s), checkBody = rustCheck(s, 'value');
    fields.push(`#[serde(rename=${JSON.stringify(field)}${s.nullable ? ',deserialize_with="required_nullable"' : ''})] pub ${f}:${s.nullable ? `Option<${type}>` : type},`);
    if (checkBody) checks.push(s.nullable ? `if let Some(value)=&self.${f}{${checkBody}}` : `{let value=&self.${f};${checkBody}}`);
  }
  rust += `#[derive(Debug,Clone,PartialEq,serde::Serialize,serde::Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct ${name}{${fields.join('\n')}}\nimpl ${name}{pub fn validate(&self)->Result<(),&'static str>{${checks.join('\n')}Ok(())}}\n`;
}
outputs.set('sdks/rust/context-window/types.gen.rs', execFileSync('rustfmt', ['--edition', '2021'], { input: rust }));
// Reuse the established local-candidate baseline convention. Committing the
// already generated files must not invalidate their source/consumer checks.
const lockPath = 'compatibility/context-window/source.lock.json';
const base = existsSync(path.join(root, lockPath)) ? JSON.parse(read(lockPath)).base_commit
  : execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
assert.match(base, /^[a-f0-9]{40}$/);
assert.equal(execFileSync('git', ['rev-parse', `${base}^{commit}`], {cwd: root, encoding: 'utf8'}).trim(), base);
execFileSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], {cwd: root, stdio: 'pipe'});
const lock = { schema_version: 1, contract_version: spec.info.version, mode: 'local_worktree_candidate', release: false, base_commit: base, sources: Object.fromEntries([source, 'scripts/generate-context-window.mjs', nativeLockPath, nativePath, '../yijie-codex/codex-rs/protocol/src/protocol.rs', '../yijie-codex/codex-rs/core/src/session/mod.rs', 'docs/context-window-restore.md'].map(p => [p, hash(read(p))])), generated: Object.fromEntries([...outputs].map(([p, b]) => [p, hash(b)])) };
outputs.set('compatibility/context-window/source.lock.json', json(lock));
if (sync || check) {
  for (const [from, to] of [
    ['sdks/go/openapi/context-window/types.gen.go', '../yijie-agent-host/internal/contracts/contextwindow/types.gen.go'],
    ['sdks/go/openapi/context-window/runtime.gen.go', '../yijie-agent-host/internal/contracts/contextwindow/runtime.gen.go'],
    ['sdks/jsonschema/context-window.schema.json', '../yijie-agent-host/internal/contracts/contextwindow/schema.json'],
    ['sdks/jsonschema/context-window-native.schema.json', '../yijie-agent-host/internal/contracts/contextwindow/native.schema.json'],
    ['sdks/rust/context-window/types.gen.rs', '../yijie-desktop/src-tauri/src/chat/context_window_generated.rs'],
    ['sdks/typescript/src/openapi/context-window.gen.ts', '../yijie-desktop/src/api/generated/context-window.gen.ts'],
    ['sdks/typescript/src/context-window-validator.gen.js', '../yijie-desktop/src/api/generated/context-window-validator.gen.js'],
    ['sdks/typescript/src/context-window-validator.gen.d.ts', '../yijie-desktop/src/api/generated/context-window-validator.gen.d.ts'],
    ['compatibility/context-window/source.lock.json', '../yijie-desktop/contracts/context-window.candidate.json'],
    ['compatibility/context-window/source.lock.json', '../yijie-agent-host/api/context-window.candidate.json'],
  ]) outputs.set(to, outputs.get(from));
}
for (const [p, bytes] of outputs) {
  const dest = path.resolve(root, p);
  if (check) assert.deepEqual(readFileSync(dest), bytes, p);
  else { mkdirSync(path.dirname(dest), { recursive: true }); writeFileSync(dest, bytes); }
}
console.log('Context window generated/verified; local candidate only.');
