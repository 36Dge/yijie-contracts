import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import {loadBrokerSource,validateBrokerManifest} from '../scripts/market-broker-source.mjs';
const {source,manifest,names,schema}=loadBrokerSource();
const fixture=JSON.parse(readFileSync('fixtures/market-broker-control/normal-wire.json'));
const ajv=new Ajv({strict:true,allErrors:true});ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);ajv.addSchema(schema);
const validator=n=>ajv.getSchema(schema.$id+'#/$defs/'+n);
test('private control source declares eight owner-only actions and bounded resources',()=>{
 validateBrokerManifest(manifest,names);assert.equal(manifest.commands.length,8);assert.equal(names.length,55);
 assert.equal(manifest.transport,'owner_owned_stdio_jsonl');assert.equal(Object.hasOwn(source,'paths'),false);
 for(const n of ['SelectionSnapshot','SelectionRef','CanonicalId','ServiceId','Revision'])assert.ok(source.$defs[n].$ref&&!source.$defs[n].$ref.startsWith('#'));
 assert.equal(manifest.limits.maxLeaseTtlMs,300000);assert.equal(manifest.limits.maxFrameBytes,65536);
 assert.match(manifest.semantics.deduplication,/expired\/revoked prepare always fails/);
 assert.match(manifest.semantics.capacity,/Do not evict/);
 assert.match(manifest.semantics.capacity,/Revoke or Shutdown returns a typed capacity_exceeded/);
 assert.match(manifest.semantics.capacity,/while still holding the serial control gate/);
 assert.match(manifest.semantics.capacity,/return that original typed capacity error/);
 assert.match(manifest.semantics.capacity,/observe normal exit or retain STOP_PENDING/);
 assert.match(manifest.semantics.shutdown,/gate-held normal EOF retirement/);
 assert.throws(()=>validateBrokerManifest({...manifest,transport:'http'},names));
});
test('all generated definitions compile and normal typed requests/responses validate',()=>{
 for(const name of Object.keys(schema.$defs))assert.ok(validator(name));
 for(const[n,v]of Object.entries(fixture))assert.ok(validator(n)(v),n+': '+JSON.stringify(validator(n).errors));
});
test('control requests require exact identity, closed payload and bounded lifetime',()=>{
 for(const c of manifest.commands){
  const request=structuredClone(fixture[c.request]);delete request.requestId;assert.equal(validator(c.request)(request),false);
  const unknown=structuredClone(fixture[c.request]);unknown.payload.futureField=true;assert.equal(validator(c.request)(unknown),false);
  const nullable=structuredClone(fixture[c.request]);nullable.payload=null;assert.equal(validator(c.request)(nullable),false);
 }
 for(const ttlMs of [0,300001]){const r=structuredClone(fixture.PrepareRequest);r.payload.ttlMs=ttlMs;assert.equal(validator('PrepareRequest')(r),false);}
});
test('new thread intent is explicit null and actual binding identities are mandatory',()=>{
 const fresh=structuredClone(fixture.PrepareRequest);fresh.payload.context.nativeThreadId=null;
 assert.ok(validator('PrepareRequest')(fresh));
 delete fresh.payload.context.nativeThreadId;assert.equal(validator('PrepareRequest')(fresh),false);
 for(const name of ['BindTurnRequest','PendingCallRequest']){
  const request=structuredClone(fixture[name]);delete request.payload.nativeThreadId;assert.equal(validator(name)(request),false);
 }
 const decision=structuredClone(fixture.DecideCallRequest);delete decision.payload.identity.nativeThreadId;assert.equal(validator('DecideCallRequest')(decision),false);
 assert.match(manifest.semantics.deduplication,/nativeProcessEpoch, agentSessionId, actual turnOperationId/);
});
test('external network assembly is explicit and response extras are not authority',()=>{
 const r=structuredClone(fixture.InitializeResponse);r.data.externalCallsEnabled=true;assert.equal(validator('InitializeResponse')(r),true);assert.equal(manifest.contract_version,'0.3.0');assert.match(manifest.semantics.qualification,/not an execution grant/);
 assert.ok(validator('InitializeResponse')({...fixture.InitializeResponse,futureField:true}));
 assert.equal(validator('Error')({...fixture.Error,retryable:true}),false);
 for(const gatewayUrl of ['http://127.0.0.1:0/mcp','http://127.0.0.1:65536/mcp']){const v=structuredClone(fixture.InitializeResponse);v.data.gatewayUrl=gatewayUrl;assert.equal(validator('InitializeResponse')(v),false);}
});
test('query/decision have exact frozen identity and elicitation only carries a locator',()=>{
 assert.deepEqual(Object.keys(source.$defs.ElicitationMetadata.properties),['yijieMarketCallRef','yijieKind']);
 assert.ok(validator('ElicitationMetadata')(fixture.ElicitationMetadata));
 assert.equal(validator('ElicitationMetadata')({...fixture.ElicitationMetadata,yijieKind:'other'}),false);
 const decision=structuredClone(fixture.DecideCallRequest);delete decision.payload.identity.argsDigest;assert.equal(validator('DecideCallRequest')(decision),false);
 const query=structuredClone(fixture.PendingCallRequest);query.payload.callRef=null;assert.equal(validator('PendingCallRequest')(query),false);
});
test('control wire contains neither raw arguments nor credentials and source remains synchronized',()=>{
 const prohibited=new Set(['arguments','token','secret','apiKey','headers','env','credentialValue','clientSecret']);
 function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v.properties??{}))assert.ok(!prohibited.has(k),k);for(const c of Object.values(v))walk(c);}
 walk(schema);
 for(const script of ['generate-market-broker.mjs','generate-market-connectors.mjs','generate-market-selection.mjs'])execFileSync(process.execPath,['scripts/'+script,'--check'],{stdio:'pipe'});
});
