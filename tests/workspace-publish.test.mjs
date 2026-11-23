import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const read = name => JSON.parse(readFileSync('jsonschema/artifact/' + name + '.schema.json'));
test('workspace publisher accepts path-only and existing name hints while private requests still require both fields', () => {
  const ajv = new Ajv({strict: false});
  const schema = read('workspace-publish-v1');
  const model = ajv.compile(schema);
  for (const version of ['media-v1', 'media-v2']) {
    const privateInput = ajv.compile(read(version).definitions.PublishInput);
    for (const example of schema.examples) {
      assert(model(example));
      assert.equal(privateInput(example), Object.hasOwn(example, 'display_name'));
    }
  }
  assert(!model({relative_path: 'report.docx', display_name: null}));
  assert(!model({display_name: 'report.docx'}));
});
