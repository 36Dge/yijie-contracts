import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const spec=read('openapi/native-conversation-v6/native-conversation-v6.yaml');
function resolve(value){
 if(Array.isArray(value))return value.map(resolve);
 if(!value||typeof value!=='object')return value;
 const out={};for(const [k,v]of Object.entries(value)){if(k==='nullable')continue;out[k]=k==='$ref'?v.replace('#/components/schemas/','#/$defs/'):resolve(v)}
 return value.nullable?{anyOf:[out,{type:'null'}]}:out;
}
const ajv=new Ajv({strict:false,formats:{int32:true,int64:true,uuid:true,'date-time':true}});
function validator(name){return ajv.compile({...resolve(spec.components.schemas[name]),$defs:resolve(spec.components.schemas)});}
test('old Native v4 authority remains byte-identical',()=>{
 const path='openapi/native-conversation-v4/native-conversation-v4.yaml';
 assert.deepEqual(fs.readFileSync(path),execFileSync('git',['show',`b51d26063f03f8fdb4109e03ede0738053740ed3:${path}`]));
});
test('v6 retains parent lifecycle and safely describes ordinary actions',()=>{
 const valid=validator('NativeItem');
 const item={id:'command-1',type:'commandExecution',availability:'available',status:'completed',exitCode:0,commandActions:[{index:0,kind:'read',label:'README.md'},{index:1,kind:'search',query:'ordinary word'}]};
 assert(valid(item),JSON.stringify(valid.errors));
 assert(!valid({...item,commandActions:[{index:0,kind:'read',label:'a'.repeat(513)}]}));
 assert(!valid({...item,commandActions:Array.from({length:65},(_,index)=>({index,kind:'unknown'}))}));
 assert(!valid({...item,commandActions:[{index:0,kind:'read',status:'completed'}]}));
});
test('retry intent keeps absent, null, true and false distinct',()=>{
 const valid=validator('NativeNotification');const base={source:'runtime_notification',method:'error',threadId:'thread',turnId:'turn',availability:'available',code:'runtime_error'};
 for(const addition of [{},{willRetry:null},{willRetry:true},{willRetry:false}])assert(valid({...base,...addition}));
 assert(!valid({...base,willRetry:'unknown'}));
});
test('new source excludes diff and uses independent versions',()=>{
 assert(spec.paths['/v6/agent-sessions/{agent_session_id}/native-thread']);assert(spec.paths['/v13/agent-sessions/{agent_session_id}/events']);
 assert.deepEqual(spec.components.schemas.NativeEvent.properties.schema_version.enum,[13]);
 assert(!spec.components.schemas.NativeItem.properties.fileChange);
 assert(!spec.components.schemas.NativeItem.properties.diff);
});
