import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

const source=JSON.parse(readFileSync('jsonschema/chat/model-selection-v2.schema.json'));
const legacy=JSON.parse(readFileSync('jsonschema/chat/model-selection-v1.schema.json'));
const spec=JSON.parse(readFileSync('openapi/chat-models-v2/chat-models-v2.yaml'));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
ajv.addKeyword({keyword:'x-model-profiles',schemaType:'array'});
ajv.addKeyword({keyword:'x-family-version',schemaType:'string'});
ajv.addSchema(legacy);ajv.addSchema(source);
const validate=name=>ajv.getSchema(source.$id+'#/$defs/'+name);
const old='kimi-k3-max-v1', current='kimi-k3-1-pro-max-v1', mini='minimax-m3-high-v1';
const session='00000000-0000-4000-8000-000000000164';
const operation='00000000-0000-4000-8000-000000000165';
const request={schema_version:2,operation_id:operation,expected_revision:7,profile_id:current};
const selection={schema_version:2,agent_session_id:session,state:'ready',revision:7,profile_id:old,availability:'retired'};

test('v2 compiles every definition under strict schema validation',()=>{
  for(const name of Object.keys(source.$defs))assert.ok(validate(name),name);
});
test('known historic identities do not grant fresh execution authority',()=>{
  assert.equal(validate('ProfileId')(old),true);
  assert.equal(validate('ActiveProfileId')(old),false);
  for(const profile_id of [current,mini])assert.equal(validate('ActiveProfileId')(profile_id),true);
  for(const name of ['SelectRequest','RecoverRequest']){
    assert.equal(validate(name)(request),true);
    assert.equal(validate(name)({...request,profile_id:old}),false);
    assert.equal(validate(name)({...request,schema_version:1}),false);
    assert.equal(validate(name)({...request,expected_revision:-1}),false);
  }
});
test('catalog is exactly the new Kimi and retained MiniMax with exact model metadata',()=>{
  assert.deepEqual(source['x-model-profiles'].map(p=>[p.profile_id,p.model,p.effort]),[[current,'kimi-k3.1-pro','max'],[mini,'MiniMax-M3','high']]);
  const models=source['x-model-profiles'].map(profile=>({profile,available:true,reason:'ready'}));
  const catalog={schema_version:2,default_profile:current,models};
  assert.equal(validate('Catalog')(catalog),true);
  assert.equal(validate('Catalog')({...catalog,models:[models[0],models[0]]}),false);
  assert.equal(validate('Catalog')({...catalog,default_profile:mini}),false);
  assert.equal(validate('ModelDefinition')({...models[0].profile,model:'kimi-k3'}),false);
  assert.equal(validate('ModelDefinition')({...models[0].profile,provider:'minimax'}),false);
  assert.equal(validate('ModelAvailability')({...models[0],available:false}),false);
  assert.equal(validate('ModelAvailability')({...models[0],available:false,reason:'activation_required'}),true);
  assert.equal(validate('ModelAvailability')({...models[0],reason:'activation_required'}),false);
});
test('retired is readable and is not mislabeled as an unknown application result',()=>{
  assert.equal(validate('Selection')(selection),true);
  assert.equal(validate('Selection')({...selection,availability:'ready'}),false);
  assert.equal(validate('Selection')({...selection,profile_id:current}),false);
  assert.equal(validate('Selection')({...selection,profile_id:current,state:'unknown',availability:'selection_unknown'}),true);
  assert.equal(validate('Selection')({...selection,profile_id:current,state:'unknown',availability:'ready'}),false);
});
test('completed legacy operation receipts retain the original requested identity and result',()=>{
  const originalResult={schema_version:1,agent_session_id:session,state:'ready',revision:8,profile_id:old,operation_id:operation};
  const receipt={schema_version:2,agent_session_id:session,operation_id:operation,state:'committed',request:{...request,schema_version:1,profile_id:old},result:originalResult};
  assert.equal(validate('ModelOperationReceipt')(receipt),true);
  assert.equal(validate('ModelOperationReceipt')({...receipt,result:selection}),false);
  assert.equal(validate('ModelOperationReceipt')({...receipt,result:{...originalResult,availability:'retired'}}),false);
  assert.equal(validate('OperationRequestSnapshot')({...request,schema_version:1}),false);
  assert.equal(validate('OperationRequestSnapshot')({...request,profile_id:old}),false);
  const {result,...incomplete}=receipt;
  assert.equal(validate('ModelOperationReceipt')(incomplete),false);
  assert.equal(validate('ModelOperationReceipt')({...incomplete,state:'unknown'}),true);
  // Reading this request snapshot is allowed; using it as a new v2 selection is not.
  assert.equal(validate('SelectRequest')(receipt.request),false);
});
test('v2 operation snapshots preserve an original v2 result with matching version',()=>{
  const result={...selection,profile_id:current,availability:'ready',revision:8};
  const receipt={schema_version:2,agent_session_id:session,operation_id:operation,state:'committed',request,result};
  assert.equal(validate('ModelOperationReceipt')(receipt),true);
  assert.equal(validate('ModelOperationReceipt')({...receipt,result:{schema_version:1,agent_session_id:session,state:'ready',revision:8,profile_id:mini}}),false);
});
test('v2 routes isolate writes from v1 and use an active-profile source reference',()=>{
  for(const [route,item] of Object.entries(spec.paths)){
    assert.ok(route.startsWith('/v2/model-chat/'));
    for(const op of Object.values(item)){
      assert.ok(op.operationId.endsWith('V2'));
      for(const param of op.parameters??[])if(param.name==='X-Yijie-Model-Profile')assert.equal(param.schema.$ref,'../../jsonschema/chat/model-selection-v2.schema.json#/$defs/ActiveProfileId');
      if(op['x-source-operation']){
        const [file,pointer]=op['x-source-operation'].split('#');
        let base=YAML.parse(readFileSync(path.resolve('openapi/chat-models-v2',file),'utf8'));
        for(const key of pointer.split('/').slice(1))base=base[key.replaceAll('~1','/').replaceAll('~0','~')];
        assert.ok(base.operationId);
        for(const code of ['400','409','503'])assert.ok(JSON.stringify(op.responses[code]).includes('model-selection-v2.schema.json#/$defs/Error'));
      }
    }
  }
  const base='/v2/model-chat/agent-sessions/{agent_session_id}/model-operations/{operation_id}';
  assert.ok(spec.paths[base].get);
  assert.ok(spec.paths[base+'/recover'].post);
  assert.ok(!spec.paths[base].get.parameters.some(p=>p.name==='X-Yijie-Model-Profile'));
});
test('legacy schema and default catalog retain their original versioned meaning',()=>{
  const legacy=JSON.parse(readFileSync('jsonschema/chat/model-selection-v1.schema.json'));
  assert.equal(legacy['x-model-profiles'][0].model,'kimi-k3');
  assert.deepEqual(legacy.$defs.ProfileId.enum,[old,mini]);
  assert.equal(legacy.$defs.Catalog.properties.schema_version.const,1);
});
test('offline API projection retains resolvable source discriminators and has no network references',()=>{
  const bundle=JSON.parse(readFileSync('sdks/openapi/chat-models-v2.bundle.json'));
  let discriminators=0;
  function resolve(ref){
    assert.ok(ref.startsWith('#/'),ref);
    let value=bundle;
    for(const part of ref.slice(2).split('/'))value=value[part.replaceAll('~1','/').replaceAll('~0','~')];
    assert.ok(value,ref);
  }
  function walk(value){
    if(!value||typeof value!=='object')return;
    if(value.$ref)resolve(value.$ref);
    if(value.discriminator?.mapping){
      discriminators++;
      for(const ref of Object.values(value.discriminator.mapping))resolve(ref);
    }
    for(const child of Object.values(value))walk(child);
  }
  walk(bundle);
  assert.ok(discriminators>0);
});
