import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
if(process.argv.length!==3)throw new Error('Pass actual native recovery producer JSON');
const schema=JSON.parse(readFileSync('sdks/jsonschema/scheduled-task-recovery.schema.json'));
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const values=JSON.parse(readFileSync(process.argv[2]));
for(const [field,type] of [['mapping','SessionMapping'],['operation','TurnOperationResult']]){
 const check=ajv.compile({$ref:schema.$id+'#/$defs/'+type});
 assert.equal(check(values[field]),true,type+': '+JSON.stringify(check.errors));
}
console.log('Actual Rust recovery values conform to canonical strict source.');
