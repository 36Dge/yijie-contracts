import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const read=p=>JSON.parse(readFileSync(p));
const schema=read('sdks/jsonschema/scheduled-draft.schema.json'),output=read('sdks/jsonschema/scheduled-draft-output.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const check=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
const id='15500000-0000-4000-8000-000000000001';
test('all draft definitions and canonical localized model schema strictly compile',()=>{for(const name of Object.keys(schema.$defs))check(name);ajv.compile(output);});
test('fixed purpose requests are versioned, text only and exclude authority or paths',()=>{
 const base={schema_version:1,policy_version:1,task_id:id,workspace_id:id};assert.ok(check('CreateRequest')(base));
 for(const extra of [{schema_version:2},{policy_version:0},{cwd:'/synthetic/path'},{outputSchema:{}},{config:{}},{scope:id},{workspace_id:'00000000-0000-0000-0000-000000000000'}])assert.equal(check('CreateRequest')({...base,...extra}),false);
 const turn={schema_version:1,policy_version:1,operation_id:id,text:'每天总结'};assert.ok(check('TurnRequest')(turn));assert.equal(check('TurnRequest')({...turn,text:'a'.repeat(10001)}),false);assert.equal(check('TurnRequest')({...turn,attachments:[]}),false);
});
test('availability needs an explicit reason and receipts carry no saved plan or native config',()=>{
 const c=check('Capability');for(const available of [true,false])for(const reason of ['ready','storage_disabled','policy_unqualified'])assert.equal(c({schema_version:1,available,reason}),available===(reason==='ready'));
 const r={schema_version:1,policy_version:1,purpose:'scheduled_plan_draft',task_id:id,agent_session_id:id,workspace_id:id};assert.ok(check('SessionReceipt')(r));assert.equal(check('SessionReceipt')({...r,purpose:'ordinary'}),false);assert.equal(check('SessionReceipt')({...r,plan_id:id}),false);
});
test('fixed output is exactly the canonical clarification/candidate projection',()=>{
 const a=ajv.compile(output),b=check('Output');
 for(const value of [{schema_version:1,kind:'needs_clarification',missing_fields:['time'],question:'什么时间？'},{schema_version:1,kind:'candidate',name:'总结',content:'总结信息',schedule:{frequency:'daily',time_zone:'Asia/Shanghai',local_time:'09:00'},target:{mode:'dedicated_chat'}},{}]){assert.equal(a(value),b(value));assert.equal(a({...value,plan_id:id}),false);}
});
test('five owner bearer routes refer to the authoritative family',()=>{
 const api=read('openapi/scheduled-plan-draft/scheduled-plan-draft.yaml');assert.equal(Object.keys(api.paths).length,5);assert.deepEqual(api.security,[{LocalBearer:[]}]);
 for(const methods of Object.values(api.paths))for(const op of Object.values(methods))for(const response of Object.values(op.responses)){const ref=response.content['application/json'].schema.$ref;assert.ok(ref.startsWith(schema.$id+'#/$defs/'));assert.ok(ajv.compile({$ref:ref}));}
});

test('read-only recovery binds persistent purpose and mapping without inventing origin',()=>{
 const value={schema_version:1,policy_version:1,purpose:'scheduled_plan_draft',task_id:id,agent_session_id:id,workspace_id:id,mapping_state:'reserved'};
 const valid=check('RecoveryMapping');assert.ok(valid(value));assert.ok(valid({...value,mapping_state:'bound',codex_thread_id:id,responding_host_instance_id:id}));
 for(const extra of [{mapping_state:'bound'},{codex_thread_id:id},{workspace_id:undefined},{purpose:'ordinary'},{responding_host_instance_id:null},{original_host_instance_id:id}])assert.equal(valid({...value,...extra}),false);
});
