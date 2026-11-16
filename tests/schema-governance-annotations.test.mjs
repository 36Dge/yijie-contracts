import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {registerGovernanceAnnotations} from '../scripts/schema-governance-annotations.mjs';
import {outputFile} from '../scripts/generation-workspace.mjs';

function strict() {
  const ajv = new Ajv2020({strict: true, allErrors: true});
  registerGovernanceAnnotations(ajv);
  ajv.addKeyword({keyword: 'x-http', schemaType: 'object'});
  return ajv;
}

test('existing Skill marketplace source and every definition compile strictly', () => {
  const schema = JSON.parse(readFileSync('jsonschema/skills/market-v2.schema.json'));
  const ajv = strict(); ajv.addSchema(schema); ajv.compile(schema);
  for (const name of Object.keys(schema.$defs)) assert.equal(typeof ajv.getSchema(schema.$id + '#/$defs/' + name), 'function', name);
});

test('metadata registration preserves type and unknown-keyword rejection', () => {
  for (const authority of [{owner: 'ordinary authority'}, 'ordinary source authority']) {
    assert.doesNotThrow(() => strict().compile({type:'object', 'x-feature':'FEAT-175', 'x-authority':authority, 'x-semantics':{}, 'x-constants':{}}));
  }
  for (const metadata of [{'x-feature':175}, {'x-feature':'ordinary'}, {'x-authority':true}, {'x-authority':''}, {'x-semantics':[]}, {'x-constants':'ordinary'}, {'ordinary_unknown_keyword':true}]) {
    assert.throws(() => strict().compile({type:'object',...metadata}), /keyword|schema is invalid|value must be/);
  }
});

test('native generated snapshots may be rebuilt without admitting source mutations', () => {
  for (const name of ['PluginStateReadResponse','PluginReadParams','MarketplaceAddResponse','ConfigBatchWriteParams','ListMcpServerStatusResponse','config.schema']) {
    assert(outputFile('compatibility/runtime-skill-marketplace/'+name+'.json'));
  }
  for (const name of ['profile','wire.schema','policy','PluginUnknownParams']) assert(!outputFile('compatibility/runtime-skill-marketplace/'+name+'.json'));
});
