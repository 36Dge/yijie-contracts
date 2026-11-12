import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const schema=JSON.parse(readFileSync('jsonschema/media-generation/v1.schema.json'));
const ajv=new Ajv({strict:false,allErrors:true});
ajv.addSchema(schema);
const validate=name=>ajv.getSchema(schema.$id+'#/$defs/'+name);
const id='17200000-0000-4000-8000-000000000001';

test('media input preserves the required reference choice and excludes provider configuration',()=>{
  const valid=validate('GenerateInput');
  assert(valid({prompt:'A blue ceramic cup',use_current_reference:false}));
  assert(valid({prompt:'The same cup on a wooden table',use_current_reference:true}));
  assert(!valid({prompt:'A blue ceramic cup'}));
  assert(!valid({prompt:'A blue ceramic cup',use_current_reference:false,provider:'seedream'}));
  assert(!valid({prompt:'',use_current_reference:false}));
});

test('a receipt distinguishes staged artifacts from blocked or unknown execution',()=>{
  const valid=validate('GenerateResult');
  assert(valid({status:'staged',code:'ok',next_action:'check_artifact',source:'builtin',artifact_id:id}));
  assert(valid({status:'blocked',code:'expert_required',next_action:'use_expert',source:'builtin'}));
  assert(valid({status:'unknown',code:'outcome_unknown',next_action:'report_failure',source:'builtin'}));
  assert(!valid({status:'committed',code:'ok',next_action:'check_artifact',source:'builtin'}));
  assert(!valid({status:'failed',code:'generation_failed',next_action:'report_failure',source:'builtin',artifact_id:id}));
});

test('the application adapter uses paired, separate media capabilities',()=>{
  const document=JSON.parse(readFileSync('jsonschema/document-runtime/v1.schema.json'));
  const local=new Ajv({strict:false});local.addSchema(document);
  const valid=local.getSchema(document.$id+'#/definitions/AdapterStartup');
  const startup={host_origin:'http://127.0.0.1:18081',host_token:'host-local-test',capability:'a'.repeat(64)};
  assert(valid(startup));
  assert(valid({...startup,media:{capability:'b'.repeat(64),host_token:'c'.repeat(64)}}));
  assert(!valid({...startup,media:{capability:'b'.repeat(64)}}));
  assert.equal(schema['x-mcp'].parallel_calls,false);
  assert.equal(schema['x-mcp'].annotations.readOnlyHint,false);
  execFileSync(process.execPath,['scripts/generate-media-generation.mjs','--check']);
});
