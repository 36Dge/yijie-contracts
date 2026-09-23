import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema=JSON.parse(readFileSync('sdks/jsonschema/scheduled-draft.schema.json'));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const covered=new Set();let count=0;
for(const file of process.argv.slice(2))for(const row of JSON.parse(readFileSync(file))){const validate=ajv.compile({$ref:schema.$id+'#/$defs/'+row.schema});assert.equal(validate(row.value),true,JSON.stringify(validate.errors));covered.add(row.schema);count++;}
for(const name of ['Capability','SessionReceipt','TurnReceipt','Error','CreateRequest','TurnRequest'])assert.ok(covered.has(name),'Missing actual producer '+name);
console.log(`Scheduled draft actual Host/Desktop producer conformance PASS (${count} values)`);
