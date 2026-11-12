import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';
const schema=JSON.parse(readFileSync('jsonschema/video-generation/v1.schema.json'));
const examples=JSON.parse(readFileSync('compatibility/video-generation/examples.json'));
const ajv=new Ajv({strict:false,allErrors:true});ajv.addSchema(schema);
for(const example of examples)test(example.name,()=>{
 const validate=ajv.getSchema(schema.$id+'#/$defs/'+example.type);
 assert.equal(validate(example.value),example.valid,JSON.stringify(validate.errors));
});
test('MCP schemas are self-contained and preserve the same input meaning',()=>{
 const tools=JSON.parse(readFileSync('sdks/jsonschema/video-generation-tools.gen.json'));
 for(const [key,type] of [['generate','GenerateInput'],['get','GetInput']]){
  assert(!JSON.stringify(tools[key]).includes('$ref'));
  const validate=ajv.compile(tools[key]);
  for(const example of examples.filter(v=>v.type===type))assert.equal(validate(example.value),example.valid,example.name);
 }
 assert.equal(schema['x-mcp'].get.readOnlyHint,false);
 assert.equal(schema['x-mcp'].parallel_calls,false);
 assert.equal(schema['x-provider'].optional_parameters,'omitted');
 execFileSync(process.execPath,['scripts/generate-video-generation.mjs','--consumer=host','--check']);
});
