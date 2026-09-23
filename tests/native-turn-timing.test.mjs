import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema=JSON.parse(readFileSync(new URL('../sdks/jsonschema/native-turn-timing.schema.json',import.meta.url)));
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const validator=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
test('native timing generation and consumer copies match source',()=>{
 execFileSync(process.execPath,['scripts/sync-native-turn-timing.mjs','--check'],{stdio:'pipe'});
});
test('native timing keeps zero, unknown, invalid and time units distinct',()=>{
 for(const name of ['UnixSecondsFact','DurationMsFact']){
  const validate=validator(name);
  for(const v of [{state:'known',value:0},{state:'known',value:250},{state:'unknown'},{state:'invalid'}])assert.ok(validate(v),JSON.stringify(validate.errors));
  for(const v of [{state:'known'},{state:'unknown',value:0},{state:'known',value:null},{state:'known',value:1.5},{state:'known',value:9007199254740992},{state:'known',value:3,received_at:4}])assert.equal(validate(v),false);
 }
 assert.equal(validator('DurationMsFact')({state:'known',value:-1}),false);
 assert.equal(validator('UnixSecondsFact')({state:'known',value:-1}),true);
});
test('clock response has exact identity and no lifecycle authority',()=>{
 const validate=validator('NativeTurnTiming');
 const id='15500000-0000-4000-8000-000000000001';
 const v={schema_version:1,source:'runtime_read',agent_session_id:id,thread_id:id,turn_id:id,started_at:{state:'known',value:1720000000},completed_at:{state:'known',value:1720000000},duration_ms:{state:'known',value:250}};
 assert.ok(validate(v));
 for(const copy of [{...v,schema_version:2},{...v,source:'local_receive'},{...v,status:'completed'},{...v,thread_id:'not-an-id'}])assert.equal(validate(copy),false);
 for(const field of ['started_at','completed_at','duration_ms']){const c={...v};delete c[field];assert.equal(validate(c),false);}
});
