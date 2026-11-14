import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
const schema=JSON.parse(readFileSync(new URL('../sdks/jsonschema/market-submission-rejection-v1.schema.json',import.meta.url)));
const ajv=new Ajv({strict:false,allErrors:true});ajv.addSchema(schema);
const valid=ajv.getSchema(schema.$id+'#/$defs/Response');
const id='019f8b06-0ea1-7c0d-97a7-3cd3bdeaf2e0';
test('rejection proof requires every immutable binding and a known non-dispatched outcome',()=>{
 const response={schemaVersion:1,requestId:id,data:{schemaVersion:1,hostInstanceId:id,taskId:id,localSessionId:id,submissionOperationId:id,turnOperationId:id,selectionDigest:'a'.repeat(64),reason:'skill_maintenance_busy',outcome:'not_dispatched'}};
 assert(valid(response));
 for(const key of Object.keys(response.data)){const value=structuredClone(response);delete value.data[key];assert(!valid(value),key);}
 for(const [key,value] of [['outcome','accepted'],['reason','future_reason'],['schemaVersion',2]]) assert(!valid({...response,data:{...response.data,[key]:value}}));
 assert(valid({...response,data:{...response.data,reason:'skill_unavailable'}}));
});
