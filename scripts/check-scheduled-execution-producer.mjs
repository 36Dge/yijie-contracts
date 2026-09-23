import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
if(process.argv.length!==3)throw new Error('Pass the actual native producer JSON file');
const schema=JSON.parse(readFileSync('sdks/jsonschema/scheduled-execution.schema.json'));
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const values=JSON.parse(readFileSync(process.argv[2]));
for(const key of ['GrantConfirmation','GrantView','RunView']){
 const check=ajv.compile({$ref:schema.$id+'#/$defs/'+key});
 assert.equal(check(values[key]),true,key+': '+JSON.stringify(check.errors));
}
console.log('Actual native 3A producer conforms to canonical execution schema.');
