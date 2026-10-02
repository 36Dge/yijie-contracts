import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema=JSON.parse(readFileSync('sdks/jsonschema/scheduled-execution.schema.json'));
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const validate=n=>ajv.compile({$ref:schema.$id+'#/$defs/'+n});
const id='15500000-0000-4000-8000-000000000003';
const confirm={request_id:id,plan_id:id,expected_revision:1,max_runs:2,expires_at:1800000000};
test('execution identities project the unchanged storage identity authority',()=>{
 const original=JSON.parse(readFileSync('jsonschema/scheduled-tasks/plan-storage-v1.schema.json'));
 assert.deepEqual(schema.$defs.Identity,original.$defs.Identity);
 assert.equal(validate('Identity')('00000000-0000-0000-0000-000000000000'),false);
});
test('finite confirmation cannot grant scope, mode, enabled state or caller authority',()=>{
 const v=validate('GrantConfirmation');assert.equal(v(confirm),true);
 for(const max_runs of [0,-1,2147483648,null])assert.equal(v({...confirm,max_runs}),false);
 for(const field of ['owner','tenant_id','authorization_revision','permission_mode','enabled'])assert.equal(v({...confirm,[field]:'ordinary'}),false);
 assert.equal(v({...confirm,expires_at:null}),false);
});
test('workspace references distinguish native policy from user project and reject raw paths',()=>{
 const v=validate('WorkspaceReference');
 for(const source of ['user_project','managed_schedule','managed_chat'])assert.equal(v({source,resource_id:id}),true);
 assert.equal(v({source:'bookmark',resource_id:id}),false);
 assert.equal(v({source:'managed_schedule',resource_id:id,path:'/ordinary/path'}),false);
});
test('run intent, native outcome and delivery state are distinct closed values',()=>{
 const run={run_id:id,plan_id:id,plan_revision:1,schedule_epoch:1,request_id:id,operation_id:id,trigger:'manual',grant_id:id,snapshot_digest:'a'.repeat(64),workspace:{source:'managed_schedule',resource_id:id},permission_mode:'ask',delivery_state:'uncertain',native_outcome:'unobserved',needs_attention:true};
 const v=validate('RunView');assert.equal(v(run),true);
 assert.equal(v({...run,trigger:'automatic'}),false);
 assert.equal(v({...run,trigger:'automatic',logical_slot:'2026-09-18T09:00'}),true);
 assert.equal(v({...run,trigger:'rerun',original_run_id:id}),true);
 for(const update of [{trigger:'rerun'},{original_run_id:null},{original_run_id:id},{permission_mode:'auto'},{native_outcome:'business_success'},{delivery_state:'future'}])assert.equal(v({...run,...update}),false);
});
