import { loadScheduledSources, projectScheduledSource } from './scheduled-schema-source.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceName = 'jsonschema/scheduled-tasks/plan-storage-v1.schema.json';
const source = JSON.parse(readFileSync(path.join(root, sourceName)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base-commit')) throw new Error('Expected --base-commit SHA');
const base = args[1] ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(base)) throw new Error('Full base commit required');
execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root });
const projection = projectScheduledSource(source.$id, loadScheduledSources(['draft', 'plan']));
const definitions = new Map(Object.entries(projection.$defs));
const pascal = value => value.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('');
function typeOf(schema, suggested, language) {
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/$defs/')) throw new Error('Unexpected external reference');
    return schema.$ref.split('/').at(-1);
  }
  if (schema.enum) { definitions.set(suggested, schema); return suggested; }
  if (schema.type === 'array') return language === 'rust' ? `Vec<${typeOf(schema.items, suggested+'Item', language)}>` : `Array<${typeOf(schema.items, suggested+'Item', language)}>`;
  if (schema.type === 'string') return language === 'rust' ? 'String' : 'string';
  if (schema.type === 'integer') return language === 'rust' ? 'i64' : 'number';
  if (schema.type === 'boolean') return language === 'rust' ? 'bool' : 'boolean';
  throw new Error(`Unsupported source shape for ${suggested}`);
}
let rust = '// Generated from scheduled plan source; DO NOT EDIT.\nuse serde::{Deserialize, Serialize};\n\n';
rust += "// Optional in this source means omitted, never explicit JSON null.\nfn optional_non_null<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>\nwhere D: serde::Deserializer<'de>, T: Deserialize<'de> {\n    T::deserialize(deserializer).map(Some)\n}\n\n";
let ts = '// Generated from scheduled plan source; DO NOT EDIT.\n';
for (const [name, schema] of definitions) {
  if (schema.enum) {
    if (!schema.enum.every(value => typeof value === 'string')) throw new Error('Only string enums supported');
    rust += `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]\npub enum ${name} {\n`;
    for (const value of schema.enum) rust += `    #[serde(rename = "${value}")]\n    ${pascal(value)},\n`;
    rust += '}\n\n'; ts += `export type ${name} = ${schema.enum.map(value => JSON.stringify(value)).join(' | ')};\n`;
  } else if (schema.type === 'object') {
    rust += `#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct ${name} {\n`;
    ts += `export interface ${name} {\n`;
    for (const [field, value] of Object.entries(schema.properties)) {
      const required = schema.required.includes(field);
      const rustType = typeOf(value, name+pascal(field), 'rust');
      if (!required) rust += '    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "optional_non_null")]\n';
      rust += `    pub ${field}: ${required ? rustType : `Option<${rustType}>`},\n`;
      ts += `  ${field}${required ? '' : '?'}: ${typeOf(value, name+pascal(field), 'ts')};\n`;
    }
    rust += `}\nimpl std::fmt::Debug for ${name} {\n    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("${name}([redacted])") }\n}\n\n`;
    ts += '}\n';
  } else {
    rust += `pub type ${name} = ${typeOf(schema, name, 'rust')};\n\n`;
    ts += `export type ${name} = ${typeOf(schema, name, 'ts')};\n`;
  }
}
const write = (file, bytes) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), bytes); };
const outputs = ['sdks/rust/scheduled-plan/types.gen.rs', 'sdks/typescript/src/jsonschema/scheduled-plan.gen.ts', 'sdks/jsonschema/scheduled-plan.schema.json'];
write(outputs[0], rust); write(outputs[1], ts); write(outputs[2], JSON.stringify(projection, null, 2)+'\n');
execFileSync('rustfmt', ['--edition', '2021', path.join(root, outputs[0])]);
const sha = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const entries = files => files.map(file => ({ path: file, sha256: sha(file) }));
write('compatibility/scheduled-plan/source.lock.json', JSON.stringify({ schema_version: 1, contract_version: source['x-family-version'], mode: 'local_candidate', release: false, repository: 'https://github.com/36Dge/yijie-contracts.git', base_commit: base,
  sources: entries(['scripts/scheduled-schema-source.mjs', sourceName, 'jsonschema/scheduled-tasks/plan-draft-v1.schema.json', 'scripts/generate-scheduled-plan.mjs', 'scripts/sync-scheduled-plan.mjs', 'scripts/scheduled-consumer-source.mjs']), generated: entries(outputs), generators: { rust_typescript: 'source-local closed schema subset v1; serde validation plus native semantics', jsonschema: 'canonical context-preserving draft references v2' } }, null, 2)+'\n');
console.log('Generated scheduled plan local candidate; legacy and phase-one sources unchanged.');
