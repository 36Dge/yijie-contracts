import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema=JSON.parse(readFileSync('jsonschema/document-runtime/v1.schema.json'));
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const validate=name=>ajv.getSchema(schema.$id+'#/definitions/'+name);

test('document environment returns fixed nine-format capabilities and no paths while unavailable',()=>{
  assert.equal(schema.definitions.EnvironmentInput.properties.format.enum.length,9);
  const limits=Object.fromEntries(Object.entries(schema.definitions.Limits.properties).map(([k,v])=>[k,v.const]));
  const value={schema_version:1,status:'unavailable',code:'missing',bundle_id:'',platform:'macos-arm64',python_path:'',helper_path:'',renderer_path:'',guides:[],limits};
  const valid=validate('EnvironmentResponse');assert(valid(value),JSON.stringify(valid.errors));
  const ready={...value,status:'ready',code:'ok',bundle_id:'a'.repeat(64),python_path:'/application/python/bin/python3.12',helper_path:'/application/scripts/document.py',renderer_path:'/application/bin/yijie-document-render',guides:[{format:'docx',path:'/application/guides/docx.md'}]};
  assert(valid(ready),JSON.stringify(valid.errors));
  assert(!valid({...ready,renderer_path:''}));
  assert(!valid({...value,python_path:ready.python_path}));
});

test('ACK status is explicit and cannot imply a new execution',()=>{
  const valid=validate('StatusResponse');
  for(const status of ['staged','committed','expired','unknown'])assert(valid({schema_version:1,artifact_id:'12500000-0000-4000-8000-000000000001',status}));
  assert(!valid({schema_version:1,artifact_id:'12500000-0000-4000-8000-000000000001',status:'ready'}));
  for(const tool of Object.values(schema['x-tools']))assert.equal(tool.readOnly,true);
});

test('new read-only document tools leave the published artifact source unchanged',()=>{
  for(const file of ['jsonschema/artifact/media-v1.schema.json','jsonschema/artifact/media-v2.schema.json']){
    assert.deepEqual(readFileSync(file),execFileSync('git',['show','babc097206fb4edc772532d1d19e41597b6d6e50:'+file]));
  }
  execFileSync(process.execPath,['scripts/generate-document-runtime.mjs','--check']);
});
