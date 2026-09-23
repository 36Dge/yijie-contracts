import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base-commit')) throw new Error('Expected --base-commit SHA');
const base = args[1] ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(base)) throw new Error('Full generation baseline required');
execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root });
const source = 'openapi/scheduled-task-recovery/scheduled-task-recovery.yaml';
const draft = 'jsonschema/scheduled-tasks/plan-draft-v1.schema.json';
const spec = JSON.parse(readFileSync(path.join(root, source)));
const goOut = 'sdks/go/openapi/scheduled-task-recovery/types.gen.go';
const schemaOut = 'sdks/jsonschema/scheduled-task-recovery.schema.json';
const write = (file, value) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), value);
};
mkdirSync(path.dirname(path.join(root, goOut)), { recursive: true });
execFileSync('go', ['tool', 'oapi-codegen', '-generate', 'types,skip-prune', '-package', 'scheduledrecovery', '-o', goOut, source], { cwd: root, stdio: 'inherit' });
// Only this family is projected. x-state-rules is source-owned, with both the
// schema validator and producer conformance enforcing the dependent fields.
function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'x-state-rules') continue;
    result[key] = key === '$ref' ? child.replace('#/components/schemas/', '#/$defs/') : project(child);
  }
  if (value['x-state-rules']) {
    const { field, rules } = value['x-state-rules'];
    result.allOf = Object.entries(rules).map(([state, rule]) => ({
      if: { properties: { [field]: { const: state } }, required: [field] },
      then: { ...(rule.required ? { required: rule.required } : {}),
        ...((rule.required || rule.forbidden) ? { properties: { ...Object.fromEntries((rule.required ?? []).map(name => [name, {}])), ...Object.fromEntries((rule.forbidden ?? []).map(name => [name, false])) } } : {}) },
    }));
  }
  return result;
}
write(schemaOut, JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://schemas.yijie.ai/scheduled-task-recovery/v1', $defs: project(spec.components.schemas) }, null, 2) + '\n');
// A closed source-local Rust projection. Validation is generated from the same
// properties and x-state-rules as Go/schema; no consumer-maintained wire shape.
const rustOut = 'sdks/rust/scheduled-task-recovery/types.gen.rs';
const pascal = s => s.split('_').map(w => w[0].toUpperCase()+w.slice(1)).join('');
let rust = `// Generated from scheduled recovery source; DO NOT EDIT.
use serde::{Deserialize, Serialize};
fn optional_non_null<'de,D,T>(d:D)->Result<Option<T>,D::Error> where D:serde::Deserializer<'de>,T:Deserialize<'de>{T::deserialize(d).map(Some)}
fn canonical(value:&str)->bool { uuid::Uuid::parse_str(value).is_ok_and(|id| !id.is_nil() && id.to_string()==value) }
`;
const rustDefinitions = new Map(Object.entries(spec.components.schemas));
for (const [name, schema] of rustDefinitions) {
  if (schema.enum) {
    rust += `#[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize,Deserialize)]\npub enum ${name} {\n`;
    for (const v of schema.enum) rust += `#[serde(rename="${v}")] ${pascal(v)},\n`;
    rust += '}\n';
  } else if (schema.type === 'string') {
    rust += `pub type ${name} = String;\n`;
  } else if (schema.type === 'object') {
    const fields = Object.entries(schema.properties);
    const fieldText = fields.map(([field, value]) => {
      let type = value.$ref ? value.$ref.split('/').at(-1) : 'String';
      if (value.type === 'object' || value.enum) { type = name+pascal(field); rustDefinitions.set(type,value); }
      return schema.required.includes(field) ? `pub ${field}:${type},` : `#[serde(default,skip_serializing_if="Option::is_none",deserialize_with="optional_non_null")] pub ${field}:Option<${type}>,`;
    }).join('\n');
    rust += `#[derive(Clone,PartialEq,Eq,Serialize,Deserialize)]\n#[serde(try_from="${name}Wire")]\npub struct ${name} {${fieldText}}\n`;
    rust += `#[derive(Deserialize)]\n#[serde(deny_unknown_fields)]\nstruct ${name}Wire {${fieldText}}\n`;
    rust += `impl TryFrom<${name}Wire> for ${name} { type Error=&'static str; fn try_from(w:${name}Wire)->Result<Self,Self::Error>{let value=Self{${fields.map(([f])=>`${f}:w.${f}`).join(',')}};value.validate()?;Ok(value)}}\n`;
    rust += `impl ${name} {pub fn validate(&self)->Result<(), &'static str>{\n`;
    for (const [field, value] of fields) {
      if(value.type==='object') rust += `self.${field}.validate()?;\n`;
      if(value.minLength) rust += `if self.${field}.chars().count()<${value.minLength} {return Err("invalid recovery length");}\n`;
      if(value.maxLength) rust += `if self.${field}.chars().count()>${value.maxLength} {return Err("invalid recovery length");}\n`;
      if (value.$ref?.endsWith('/CanonicalID')) rust += schema.required.includes(field)
        ? `if !canonical(&self.${field}) {return Err("invalid recovery identity");}\n`
        : `if self.${field}.as_ref().is_some_and(|v|!canonical(v)){return Err("invalid recovery identity");}\n`;
    }
    if (schema['x-state-rules']) {
      const {field,rules}=schema['x-state-rules'];
      const stateType=schema.properties[field].$ref.split('/').at(-1);
      for (const [state,rule] of Object.entries(rules)) {
        const invalid=[...(rule.required??[]).map(f=>`self.${f}.is_none()`),...(rule.forbidden??[]).map(f=>`self.${f}.is_some()`)].join(' || ');
        if(invalid) rust += `if self.${field}==${stateType}::${pascal(state)} && (${invalid}) {return Err("invalid recovery state fields");}\n`;
      }
    }
    rust += 'Ok(())}}\n';
    rust += `impl std::fmt::Debug for ${name} {fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result {f.write_str("${name}([redacted])")}}\n`;
  } else throw new Error('Unsupported recovery Rust source shape: '+name);
}
write(rustOut, rust);
execFileSync('rustfmt',['--edition','2021',path.join(root,rustOut)]);
const sha = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const entries = names => names.map(file => ({ path: file, sha256: sha(file) }));
write('compatibility/scheduled-task-recovery/source.lock.json', JSON.stringify({
  schema_version: 1, contract_version: spec.info.version, mode: 'local_candidate', release: false,
  repository: 'https://github.com/36Dge/yijie-contracts.git', base_commit: base,
  sources: entries([source, draft, 'scripts/generate-scheduled-task-recovery.mjs', 'scripts/sync-scheduled-task-recovery.mjs', 'scripts/scheduled-consumer-source.mjs', 'go.mod', 'go.sum']),
  generated: entries([goOut, schemaOut, rustOut]), generators: { rust: 'source-local closed recovery validation v1', go: 'oapi-codegen/v2@v2.7.2', jsonschema: 'source-local deterministic projection v1' },
}, null, 2) + '\n');
console.log('Generated scheduled-task-recovery local candidate; no legacy outputs changed.');
