import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
const schema=JSON.parse(readFileSync(new URL('../jsonschema/skills/market-v2.schema.json',import.meta.url)));
const ajv=new Ajv({strict:false,allErrors:true});ajv.addSchema(schema);
const valid=name=>ajv.getSchema(schema.$id+'#/$defs/'+name);
const op='019f8b06-0ea1-7c0d-97a7-3cd3bdeaf2e0';
test('skill-v2 permits empty offers and keeps attention receipts unresolved',()=>{
 assert(valid('Bundle')({schema_version:2,marketplace_name:'yijie-builtin',skills:[]}));
 assert(valid('Catalog')({schema_version:2,revision:'b'.repeat(64),skills:[],operations:[{operation_id:op,skill_id:'ordinary',epoch:1,state:'needs_attention',error_code:'native_preflight_failed'}]}));
 assert.match(schema.$defs.OperationState.description,/needs_attention.*unresolved/);
});
test('skill-v2 retains independent installation, enablement and dependency facts',()=>{
 const skill={id:'user.sample',version:'1.0.0',runtime_name:'yj-user-sample:plain',display_name:'Ordinary notes',description:'Explain the supplied arithmetic.',category:'personal',order:0,icon_key:'edit',origin:'user',installation_state:'installed',enabled:true,runtime_visible:true,retired:false,dependency_state:'unknown',required_tools:[],epoch:1,failure_code:''};
 assert(valid('Skill')(skill),JSON.stringify(valid('Skill').errors));
 assert(valid('Catalog')({schema_version:2,revision:'a'.repeat(64),skills:[skill],operations:[]}));
 assert(!valid('Skill')({...skill,installation_state:'future_state'}));
});
test('skill-v2 freezes mutation identity and bounded epoch before side effects',()=>{
 assert(valid('Mutation')({operation_id:op,skill_id:'builtin.sample',kind:'disable',expected_epoch:1}));
 assert(!valid('Mutation')({operation_id:op,skill_id:'builtin.sample',kind:'disable',expected_epoch:-1}));
 assert(!valid('Mutation')({operation_id:'',skill_id:'builtin.sample',kind:'disable',expected_epoch:1}));
});
test('skill-v2 import is a bounded local byte submission with a declared digest',()=>{
 const request={operation_id:op,file_name:'SKILL.md',format:'markdown',sha256:'a'.repeat(64),bytes:256};
 assert(valid('ImportRequest')(request));
 assert(!valid('ImportRequest')({...request,format:'remote'}));
 assert(!valid('ImportRequest')({...request,bytes:67108865}));
});
test('skill-v2 catalog accommodates a full release beside installed identities',()=>{
 const skill={id:'user.sample',version:'1.0.0',runtime_name:'plain',display_name:'Ordinary notes',description:'Local capacity check',category:'personal',order:0,icon_key:'edit',origin:'user',installation_state:'installed',enabled:true,runtime_visible:true,retired:false,dependency_state:'unknown',required_tools:[],epoch:1,failure_code:''};
 const catalog=n=>({schema_version:2,revision:'a'.repeat(64),skills:Array.from({length:n},(_,i)=>({...skill,id:'ordinary-'+i})),operations:[]});
 assert(valid('Catalog')(catalog(513)));
 assert(valid('Catalog')(catalog(1024)));
 assert(!valid('Catalog')(catalog(1025)));
 assert.equal(schema.$defs.Bundle.properties.skills.maxItems,512);
});
