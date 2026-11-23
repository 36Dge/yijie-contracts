import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const read = p => readFileSync(path.join(root, p));
const sourcePath = 'jsonschema/artifact/media-v2.schema.json';
const source = JSON.parse(read(sourcePath));
const legacySourcePath = 'jsonschema/artifact/media-v1.schema.json';
const legacySource = JSON.parse(read(legacySourcePath));
const publishPath = 'jsonschema/artifact/workspace-publish-v1.schema.json';
const publish = JSON.parse(read(publishPath));
function mediaEvent(mediaSource, schemaVersion) {
const event = JSON.parse(read('jsonschema/agent/session-event-v3.schema.json'));
event.$id = 'https://schemas.yijie.ai/agent/session-event-v9.schema.json';
event.title = 'AgentSessionEventV9';
event.description = 'Explicit FEAT-159 media subscription; v3 shape and resource authority, expanded MIME only.';
// Canonical inheritance, never a second hand-maintained event definition.
function version(v) { if (!v || typeof v !== 'object') return; if(v.properties?.schema_version?.const === 3) v.properties.schema_version.const = schemaVersion; for(const x of Object.values(v)) version(x); }
version(event);
if (schemaVersion !== 9) {
  event.$id = `https://schemas.yijie.ai/agent/session-event-v${schemaVersion}.schema.json`;
  event.title = `AgentSessionEventV${schemaVersion}`;
  event.description = 'Explicit FEAT-165 file subscription; v3 shape and resource authority, expanded MIME only.';
}
const completed = event.definitions.artifactCompletedPayload;
completed.properties.media_type.enum = Object.values(mediaSource['x-media-types']).flat();
for(const rule of completed.allOf) {
  const kind = rule.if.properties.kind.const;
  const values = mediaSource['x-media-types'][kind];
  rule.then.properties.media_type = { enum: values };
}
return event;
}
const event = mediaEvent(legacySource, 9);
const filesEvent = mediaEvent(source, source['x-event-schema-version']);
let go = '// Generated from artifact/media-v2; DO NOT EDIT.\npackage artifactmedia\n';
let rust = '// Generated from artifact/media-v2; DO NOT EDIT.\n';
for(const [name, d] of Object.entries(source.definitions)) {
  assert.equal(d.additionalProperties, false);
  go += `type ${name} struct {\n`;
  rust += `#[derive(Clone,serde::Serialize,serde::Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct ${name} {\n`;
  for(const [f, t] of Object.entries(d.properties)) {
    const type = t.$ref?.split('/').at(-1);
    assert.ok(type || t.type === 'string');
    go += `${f.split('_').map(x=>x[0].toUpperCase()+x.slice(1)).join('')} ${type ?? 'string'} \`json:"${f}"\`\n`;
    rust += `pub ${f}: ${type ?? 'String'},\n`;
  }
  go += '}\n'; rust += '}\n';
}
const media=source['x-media-types'];
go += `func MediaAllowed(kind, mime string) bool { switch kind {${Object.entries(media).map(([k,vs])=>`case "${k}":switch mime {case ${vs.map(x=>JSON.stringify(x)).join(',')}: return true}`).join(';')}};return false}\n`;
rust += `pub fn media_type_allowed(kind:&str,mime:&str)->bool {match kind {${Object.entries(media).map(([k,vs])=>`${JSON.stringify(k)} => matches!(mime, ${vs.map(x=>JSON.stringify(x)).join('|')}),`).join('')}_=>false}}\n`;
go += `func LegacyMediaAllowed(kind, mime string) bool { switch kind {${Object.entries(legacySource['x-media-types']).map(([k,vs])=>`case "${k}":switch mime {case ${vs.map(x=>JSON.stringify(x)).join(',')}: return true}`).join(';')}};return false}\n`;
const policy=`// Generated from artifact media source. Do not edit.\nexport const ARTIFACT_MEDIA_TYPES = ${JSON.stringify(media,null,2)} as const;\n`;
const outputs = new Map([
 ['sdks/typescript/src/jsonschema/artifact-media-policy.gen.ts',policy],
  ['sdks/jsonschema/artifact-media-events-v9.schema.json',JSON.stringify(event,null,2)+'\n'],
  ['sdks/jsonschema/artifact-media-events-v12.schema.json',JSON.stringify(filesEvent,null,2)+'\n'],
  ['sdks/go/artifactmedia/types.gen.go',execFileSync('gofmt',[],{input:go})],
  ['sdks/rust/artifactmedia/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
  ['sdks/typescript/src/jsonschema/artifact-media.gen.ts',await compile(source,'ArtifactMediaV2')],
]);
// Model arguments and optional HTTP diagnostics evolve independently of the
// frozen v1 HTTP body and v9/v12 event sources.
const reasons = Object.entries(publish['x-error-reasons']);
const goName = value => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');
const reasonHeader = JSON.stringify(publish['x-reason-header']);
const publishGo = `// Code generated from workspace-publish-v1; DO NOT EDIT.
package artifactmedia
const PublishReasonHeader = ${reasonHeader}
type PublishReason string
func (reason PublishReason) Error() string { return string(reason) }
const (
${reasons.map(([key]) => `Reason${goName(key)} PublishReason = ${JSON.stringify(key)}`).join('\n')}
)
func (reason PublishReason) Known() bool {
  switch reason { case ${reasons.map(([key]) => 'Reason' + goName(key)).join(',')}: return true }
  return false
}
`;
const fields = Object.entries(publish.properties).map(([key, spec]) => {
  assert.equal(spec.type, 'string');
  return publish.required.includes(key) ? `pub ${key}: String,` :
    `#[serde(default, deserialize_with="present_string")] pub ${key}: Option<String>,`;
});
const publishRust = `// Code generated from workspace-publish-v1; DO NOT EDIT.
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkspacePublishInput { ${fields.join('\n')} }
fn present_string<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<String>, D::Error> {
    <String as serde::Deserialize>::deserialize(d).map(Some)
}
pub const PUBLISH_REASON_HEADER: &str = ${reasonHeader};
pub const PRIVATE_NAME_BYTES: usize = ${source.definitions.PublishInput.properties.display_name['x-yijie-max-utf8-bytes']};
pub const PUBLISH_BODY_BYTES: usize = ${source['x-http'].publish.limits.body_bytes};
pub fn reason_message(reason: &str) -> &'static str {
    match reason { ${reasons.map(([key, message]) => `${JSON.stringify(key)} => ${JSON.stringify(message)},`).join('\n')}
    _ => ${JSON.stringify(publish['x-error-reasons'].unavailable)} }
}
`;
outputs.set('sdks/go/artifactmedia/publish.gen.go', execFileSync('gofmt', [], {input: publishGo}));
outputs.set('sdks/rust/artifactmedia/publish.gen.rs', execFileSync('rustfmt', ['--edition','2021'], {input: publishRust}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lockPath='compatibility/artifact-media/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
outputs.set(lockPath,JSON.stringify({schema_version:1,mode:'local_candidate',release:false,base_commit:base,sources:[sourcePath,legacySourcePath,publishPath,'jsonschema/agent/session-event-v3.schema.json','scripts/generate-artifact-media.mjs'].map(path=>({path,sha256:sha(read(path))})),generated:[...outputs].map(([path,bytes])=>({path,sha256:sha(bytes)}))},null,2)+'\n');
for(const [file,bytes] of outputs) { const target=path.join(root,file);if(check)assert.deepEqual(readFileSync(target),Buffer.from(bytes),file);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);} }
const consumer=process.argv.find(x=>x.startsWith('--consumer='))?.split('=')[1];
if(consumer) {
  assert.ok(['host','desktop'].includes(consumer));
  const repo=consumer==='host'?'yijie-agent-host':'yijie-desktop';
  const pairs=consumer==='host'?[[sourcePath,'api/schemas/artifact-media-v2.schema.json'],[legacySourcePath,'api/schemas/artifact-media-v1.schema.json'],['sdks/go/artifactmedia/types.gen.go','internal/contracts/artifactmedia/types.gen.go'],['sdks/rust/artifactmedia/types.gen.rs','artifact-mcp/src/types.gen.rs'],[lockPath,'api/artifact-media.candidate.json']]:[['sdks/typescript/src/jsonschema/artifact-media-policy.gen.ts','src/api/generated/artifact-media-policy.gen.ts'],[sourcePath,'contracts/artifact-media-v2.schema.json'],[legacySourcePath,'contracts/artifact-media-v1.schema.json'],['sdks/rust/artifactmedia/types.gen.rs','src-tauri/src/chat/artifact_media_generated.rs'],[lockPath,'contracts/artifact-media.candidate.json']];
  if (consumer === 'host') pairs.push(
    [publishPath, 'api/schemas/workspace-publish-v1.schema.json'],
    ['sdks/go/artifactmedia/publish.gen.go', 'internal/contracts/artifactmedia/publish.gen.go'],
    ['sdks/rust/artifactmedia/publish.gen.rs', 'artifact-mcp/src/publish.gen.rs'],
  );
  for(const [src,dst] of pairs){const target=path.join(root,'..',repo,dst),bytes=read(src);if(check)assert.deepEqual(readFileSync(target),bytes,dst);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
}
console.log('Artifact media generated/verified; local candidate, legacy source unchanged.');
