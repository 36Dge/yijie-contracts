import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const read=p=>JSON.parse(readFileSync(p));
const source=read('openapi/user-input/user-input.yaml');
const resolved=read('sdks/openapi/user-input.resolved.json');
const native=read('compatibility/runtime-interaction-tools/types.openapi.json');
const schema=read('sdks/jsonschema/user-input.schema.json');
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addFormat('int64',true);
const check=name=>ajv.compile({...schema.definitions[name],definitions:schema.definitions});
test('questions and answers are exact canonical Runtime projections',()=>{
 for(const n of ['ToolRequestUserInputQuestion','ToolRequestUserInputOption','ToolRequestUserInputAnswer'])assert.deepEqual(resolved.components.schemas[n],native.components.schemas[n]);
 assert.match(source.components.schemas.ToolRequestUserInputQuestion.$ref,/compatibility\/runtime-interaction-tools/);
});
test('source validates optional freeform, masked fields, empty skip and content-free receipt',()=>{
 const id='10000000-0000-4000-8000-000000000001';
 const pending={request_id:id,turn_id:'ordinary-turn',item_id:'ordinary-item',state:'pending',timeout_paused:false,questions:[{id:'ordinary',header:'输入',question:'普通合成说明',isSecret:true,isOther:true}]};
 assert(check('UserInputRequest')(pending));
 assert(check('UserInputAnswerRequest')({operation_id:id,answers:{ordinary:{answers:['ordinary value']}}}));
 assert(check('UserInputAnswerRequest')({operation_id:id,answers:{}}));
 assert(check('UserInputRequest')({...pending,state:'answered',questions:[],operation_id:id}));
 assert(!check('UserInputAnswerRequest')({decision:'approve_once'}));
 assert(!check('UserInputRequest')({...pending,state:'future_state'}));
});
test('ordinary compaction policy differs from explicit fresh window without enabling other groups',()=>{
 const profile=read('compatibility/runtime-interaction-tools/profile.json');
 assert.deepEqual(Object.keys(profile.native_config.features).sort(),['default_mode_request_user_input','token_budget']);
 assert.equal(profile.native_config.features.token_budget.reset_on_compact,false);
 assert.equal(profile.release,false);
});
test('new families preserve all previous source contracts at the explicit current fallback',()=>{
 const base='c24d73fde83a01b5dd2a9ded8defb5bbef34e311';
 // The retained FEAT-169 display extension predates this stage and is separately
 // reviewed. This stage introduces no additional existing wire/schema changes.
 const changed=execFileSync('git',['diff',base,'--name-only','--','openapi','jsonschema','protobuf','asyncapi','compatibility'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.deepEqual(changed,['openapi/native-conversation-v6/native-conversation-v6.yaml']);
 assert.equal(read('openapi/native-conversation-v6/native-conversation-v6.yaml').info.version,'0.7.0');
});
test('closed question errors keep the existing shape and unknown outcomes are not absence',()=>{
 const validate=check('UserInputError');
 assert.equal(source.info.version,'0.2.0');
 const codes=source.components.schemas.UserInputError.properties.error.properties.code.enum;
 assert.deepEqual([...codes].sort(),['invalid_request','unauthorized','not_found','conflict','unavailable'].sort());
 for(const code of codes)assert(validate({error:{code,message:'User input request unavailable'}}));
 assert(!validate({error:{code:'future_code',message:'ordinary failure'}}));
 assert(!validate({error:{code:'not_found'}}));
});
