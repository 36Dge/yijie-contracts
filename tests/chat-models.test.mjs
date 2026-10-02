import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
const schema=JSON.parse(readFileSync('jsonschema/chat/model-selection-v1.schema.json'));
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(schema);
const validate=name=>ajv.getSchema(schema.$id+'#/$defs/'+name);
test('two fixed profiles retain exact model/provider/effort identities',()=>{
 assert.deepEqual(schema['x-model-profiles'].map(p=>[p.profile_id,p.provider,p.model,p.effort]),[['kimi-k3-max-v1','kimi','kimi-k3','max'],['minimax-m3-high-v1','minimax','MiniMax-M3','high']]);
 for(const p of schema['x-model-profiles'])assert.ok(validate('ModelDefinition')(p));
});
test('selection request needs original operation, revision and known profile',()=>{
 const request={schema_version:1,operation_id:'00000000-0000-4000-8000-000000000156',expected_revision:0,profile_id:'kimi-k3-max-v1'};
 assert.ok(validate('SelectRequest')(request));
 for(const changed of [{...request,expected_revision:-1},{...request,profile_id:'unsupported'}, {...request,schema_version:2}])assert.equal(validate('SelectRequest')(changed),false);
});
test('forwarded routes resolve original payload authority and require explicit model header',()=>{
 const spec=JSON.parse(readFileSync('openapi/chat-models/chat-models.yaml'));
 for(const item of Object.values(spec.paths))for(const [method,operation]of Object.entries(item)){
   const ref=operation['x-source-operation'];if(!ref)continue;
   const [file,pointer]=ref.split('#');let original=YAML.parse(readFileSync(path.resolve('openapi/chat-models',file),'utf8'));
   for(const k of pointer.split('/').slice(1))original=original[k.replaceAll('~1','/').replaceAll('~0','~')];
   assert.ok(original?.operationId);
   if(method==='post')assert.ok(operation.parameters.some(p=>p.name==='X-Yijie-Model-Profile'&&p.required));
 }
});
