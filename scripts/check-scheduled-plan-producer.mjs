import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const file = process.argv[2];
if (!file) throw new Error('Pass the synthetic native producer artifact');
const schema = JSON.parse(readFileSync('sdks/jsonschema/scheduled-plan.schema.json'));
const examples = JSON.parse(readFileSync(file));
const ajv = new Ajv2020({ strict:true, allErrors:true }); addFormats(ajv); ajv.addSchema(schema);
for (const [name, value] of Object.entries(examples)) {
  assert.ok(Object.hasOwn(schema.$defs, name), name);
  const validate = ajv.compile({$ref:schema.$id+'#/$defs/'+name});
  for (const example of Array.isArray(value) ? value : [value]) assert.equal(validate(example),true,`${name}: ${JSON.stringify(validate.errors)}`);
}
assert.deepEqual(Object.keys(examples).sort(), ['PlanView','SavePlanRequest','ScheduleErrorCode','TimePreview']);
console.log('Native scheduled plan producer payloads conform to the unique source schema.');
