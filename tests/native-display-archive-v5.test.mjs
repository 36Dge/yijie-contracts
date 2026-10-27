import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
const archive=JSON.parse(fs.readFileSync(new URL('../compatibility/native-display-archive-v5.json',import.meta.url)));
const old=JSON.parse(fs.readFileSync(new URL('../openapi/native-conversation-v4/native-conversation-v4.yaml',import.meta.url)));
function convert(v){if(Array.isArray(v))return v.map(convert);if(!v||typeof v!=='object')return v;const o={};for(const[k,x]of Object.entries(v)){if(k==='nullable')continue;o[k]=k==='$ref'?x.replace('#/components/schemas/','#/definitions/'):convert(x);}return v.nullable?{anyOf:[o,{type:'null'}]}:o;}
const validate=new Ajv({strict:false,formats:{int32:true,int64:true}}).compile({$ref:'#/definitions/NativeItem',definitions:convert(archive.schemas)});
test('archive freezes display-only scope and exact additive vocabulary',()=>{
 assert.equal(archive.contract_id,'native-display-archive-v5');assert.equal(archive.schema_version,1);
 assert.deepEqual(Object.keys(archive.schemas.NativeItem.properties).filter(k=>!(k in old.components.schemas.NativeItem.properties)).sort(),['appContext','commandActions','commandPreview','fileChange']);
 for(const[k,v]of Object.entries(old.components.schemas.NativeItem.properties)){if(k!=='type')assert.deepEqual(archive.schemas.NativeItem.properties[k],v);}
 assert.deepEqual(archive.schemas.NativeItem.required,old.components.schemas.NativeItem.required);
 assert.equal(archive.schemas.NativeItem.additionalProperties,false);
});
test('normal earlier items remain accepted with exact observed execution status',()=>{
 for(const item of [{id:'reply',type:'agentMessage',text:'Saved answer',phase:'final_answer',availability:'available'},{id:'cmd',type:'commandExecution',status:'failed',exitCode:1,commandLabel:'Read a local report',availability:'partial'}])assert.equal(validate(item),true,JSON.stringify(validate.errors));
});
test('known archive file details are retained by the schema',()=>{
 const item={id:'file',type:'fileChange',status:'completed',availability:'available',fileChange:{changes:[{index:0,kind:'add',pathLabel:'report.md',diffText:'Saved report\n',addedLines:1,removedLines:0}]}};
 assert.equal(validate(item),true,JSON.stringify(validate.errors));assert.equal(item.fileChange.changes[0].diffText,'Saved report\n');
});
test('ordinary future item and unregistered display property remain unsupported',()=>{
 assert.equal(validate({id:'future',type:'laterDisplay',availability:'available'}),false);
 assert.equal(validate({id:'reply',type:'agentMessage',text:'Saved',availability:'available',laterField:'ordinary value'}),false);
});
