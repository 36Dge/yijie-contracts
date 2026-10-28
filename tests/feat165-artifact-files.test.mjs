import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import YAML from 'yaml';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const extra=['text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
test('FEAT165 explicit v12 preserves legacy v9 media and v3 resources',()=>{
 const old=read('sdks/jsonschema/artifact-media-events-v9.schema.json'),next=read('sdks/jsonschema/artifact-media-events-v12.schema.json');
 const id='16500000-0000-4000-8000-000000000001';
 const ajv=new Ajv({strict:false});formats(ajv);const valid=ajv.compile(next),legacy=ajv.compile(old);
 for(const mime of extra){const event={schema_version:12,event_id:id,stream_id:id,sequence:1,occurred_at:'2026-10-28T08:00:00Z',event_type:'item.artifact.completed',task_id:id,agent_session_id:id,codex_thread_id:id,turn_id:id,item_id:'artifact-'+id,terminal:false,payload:{artifact_id:id,kind:'file',provenance:'tool',status:'ready',ordinal:0,media_type:mime,size_bytes:100,sha256:'a'.repeat(64),content_href:`/v3/agent-sessions/${id}/artifacts/${id}/content`}};assert(valid(event),JSON.stringify(valid.errors));assert.equal(legacy({...event,schema_version:9}),false);}
 for(const [kind,values] of Object.entries(read('jsonschema/artifact/media-v1.schema.json')['x-media-types']))assert(values.every(v=>read('jsonschema/artifact/media-v2.schema.json')['x-media-types'][kind].includes(v)));
});
test('FEAT165 SVG and MP4 are file context in public, history and immutable submission',()=>{
 const source=YAML.parse(readFileSync('openapi/agent-host/agent-host.yaml','utf8')).components.schemas;
 const history=read('jsonschema/chat/message.schema.json');
 for(const mime of ['image/svg+xml','video/mp4']){
  assert(source.StartTurnV2FileMediaType.enum.includes(mime));assert(!source.StartTurnV2ImageBlock.properties.media_type.enum.includes(mime));assert(history.$defs.fileMediaType.enum.includes(mime));
  const market=read('sdks/jsonschema/market-host-v2.schema.json');assert(market.$defs.StartTurnV2FileMediaType.enum.includes(mime));
 }
 assert.match(source.StartTurnV2FileBlock.properties.context_chunks.description,/metadata descriptions, not transcripts/);
});
