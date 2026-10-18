import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import formats from 'ajv-formats';

test('normal media v9 events conform and legacy v3 keeps its original enum',()=>{
 const schema=JSON.parse(readFileSync('sdks/jsonschema/artifact-media-events-v9.schema.json'));
 const legacy=JSON.parse(readFileSync('jsonschema/agent/session-event-v3.schema.json'));
 const ajv=new Ajv2020({strict:false});formats(ajv);const validate=ajv.compile(schema);
 assert.equal(schema.properties.schema_version.const,9);
 assert.equal(legacy.properties.schema_version.const,3);
 assert.ok(!legacy.definitions.artifactCompletedPayload.properties.media_type.enum.includes('text/html'));
 for(const [kind,mime] of [['file','text/html'],['image','image/svg+xml'],['video','video/mp4']]){
  const id='15900000-0000-4000-8000-000000000001';
  const event={schema_version:9,event_id:id,stream_id:id,sequence:1,occurred_at:'2026-10-18T08:00:00Z',event_type:'item.artifact.completed',task_id:id,agent_session_id:id,codex_thread_id:id,turn_id:id,item_id:'artifact-'+id,terminal:false,payload:{artifact_id:id,kind,provenance:'tool',status:'ready',ordinal:0,media_type:mime,size_bytes:100,sha256:'a'.repeat(64),content_href:`/v3/agent-sessions/${id}/artifacts/${id}/content`}};
  assert.ok(validate(event),JSON.stringify(validate.errors));
 }
});
