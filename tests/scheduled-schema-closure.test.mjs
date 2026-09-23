import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadScheduledSources, registerScheduledAnnotations, projectScheduledSource } from '../scripts/scheduled-schema-source.mjs';

function strict() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv); registerScheduledAnnotations(ajv); return ajv;
}
const sources = loadScheduledSources();
const raw = strict();
// Reverse registration intentionally: canonical references do not depend on file order.
for (const schema of [...sources.values()].reverse()) raw.addSchema(schema);
const schemaByFamily = {
  draft: [...sources.values()][0],
  plan: [...sources.values()][1],
  execution: [...sources.values()][2],
  recovery: JSON.parse(readFileSync('sdks/jsonschema/scheduled-task-recovery.schema.json')),
};
const projections = {};
for (const [family, source] of Object.entries(schemaByFamily)) {
  const schema = ['plan','execution'].includes(family)
    ? JSON.parse(readFileSync(`sdks/jsonschema/scheduled-${family}.schema.json`)) : source;
  const ajv = strict(); ajv.addSchema(schema);
  projections[family] = { ajv, schema };
}
const compile = (ajv, schema, name) => name === 'root'
  ? ajv.compile(schema) : ajv.compile({ $ref: schema.$id+'#/$defs/'+name });

test('all original scheduled sources and projected definitions compile strictly', () => {
  for (const source of sources.values()) {
    raw.compile(source);
    for (const name of Object.keys(source.$defs ?? {})) compile(raw, source, name);
  }
  for (const {ajv,schema} of Object.values(projections)) {
    ajv.compile(schema);
    for (const name of Object.keys(schema.$defs ?? {})) compile(ajv,schema,name);
  }
});

test('pre-closure payload decisions are identical in canonical sources and generated projections', () => {
  const baseline = JSON.parse(readFileSync('tests/fixtures/scheduled-schema-closure.json'));
  assert.equal(baseline.cases.length, 240);
  assert.equal(baseline.cases.filter(example => example.valid).length, 68);
  for (const example of baseline.cases) {
    const {family,definition,name,value,valid} = example;
    const {ajv,schema} = projections[family];
    const projected = compile(ajv,schema,definition);
    assert.equal(projected(value), valid, `${family}/${definition}/${name}: projection`);
    if (family !== 'recovery') {
      const source = compile(raw,schemaByFamily[family],definition);
      assert.equal(source(value), valid, `${family}/${definition}/${name}: source`);
    }
  }
});

test('registered version annotation keeps strict unknown-keyword and metadata-type rejection', () => {
  assert.doesNotThrow(() => strict().compile({type:'object','x-family-version':'0.1.0'}));
  assert.throws(() => strict().compile({type:'object','x-family-version':1}), /x-family-version|schema is invalid/);
  assert.throws(() => strict().compile({type:'object','x-family-version':'ordinary'}), /x-family-version|schema is invalid/);
  assert.throws(() => strict().compile({type:'object',ordinary_unknown_keyword:true}), /unknown keyword/);
});

test('projection rejects unregistered IDs and absent fragments without a remote loader', () => {
  const id = schemaByFamily.execution.$id;
  for (const reference of [
    'https://schemas.yijie.ai/scheduled-tasks/missing/v1#/$defs/Identity',
    schemaByFamily.plan.$id+'#/$defs/OrdinaryMissingField',
  ]) {
    const documents = new Map(sources);
    const changed = structuredClone(documents.get(id)); changed.$defs.Identity = {$ref:reference};
    documents.set(id,changed);
    assert.throws(() => projectScheduledSource(id,documents), /Unregistered|Missing/);
  }
});
