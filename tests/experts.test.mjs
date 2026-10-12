import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {loadExpertsSource,canonicalExpertSnapshotText,canonicalKnowledgeManifestBytes} from '../scripts/experts-source.mjs';
import {expertSnapshotDigest,knowledgeManifestDigest} from '../sdks/javascript/experts/canonical.gen.mjs';
import * as native from '../sdks/typescript/src/api/generated/experts-validator.gen.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const source=loadExpertsSource(),fixtures=read('fixtures/experts/normal-wire.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(source.schema);
const validate=n=>ajv.getSchema(source.schema.$id+'#/$defs/'+n);
const bundleAjv=new Ajv({strict:true,allErrors:true});addFormats(bundleAjv);
const v2=read('jsonschema/skills/skill-bundle-manifest-v2.schema.json'),v3=read('jsonschema/skills/skill-bundle-manifest-v3.schema.json');
bundleAjv.addSchema(v2);const validateBundle=bundleAjv.compile(v3),bundle=read('fixtures/experts/bundle-v3-local.json');

test('normal source frames compile strictly and retain distinct session identities',()=>{
  for(const name of Object.keys(source.defs))assert.ok(validate(name),name);
  for(const[name,value]of Object.entries(fixtures))assert.ok(validate(name)(value),name+JSON.stringify(validate(name).errors));
  assert.notEqual(fixtures.ApplyRequest.payload.localSessionId,fixtures.ApplyRequest.payload.agentSessionId);
  assert.notEqual(fixtures.ApplyRequest.payload.agentSessionId,fixtures.ApplyRequest.payload.nativeThreadId);
});
test('binding removal is explicit and unknown operations cannot auto retry',()=>{
  const remove=structuredClone(fixtures.BindingSetRequest);remove.payload.expert=null;assert.ok(native.validateBindingSetRequest(remove));
  delete remove.payload.expert;assert.equal(native.validateBindingSetRequest(remove),false);
  assert.equal(native.validateError({...fixtures.Error,retryable:true}),false);
  assert.ok(native.validateError({...fixtures.Error,code:'temporarily_unavailable',retryable:true}));
  assert.ok(source.transport.semantics.binding.includes('unknown'));
});
test('ordinary revision zero retains an explicit expert-family routing marker',()=>{
  const ordinary=structuredClone(fixtures.BindingReadResponse);
  Object.assign(ordinary.data,{managed:false,bindingRevision:0,expert:null,state:'none'});
  delete ordinary.data.operationId;delete ordinary.data.errorCode;
  assert.ok(native.validateBindingReadResponse(ordinary));
  ordinary.data.managed=true;assert.ok(native.validateBindingReadResponse(ordinary));
  delete ordinary.data.managed;assert.equal(native.validateBindingReadResponse(ordinary),false);
  const bound=structuredClone(fixtures.BindingReadResponse);bound.data.managed=false;
  assert.equal(native.validateBindingReadResponse(bound),false);
});
test('resource preparation and recovery use the owned scope and original operation',()=>{
  const binding=fixtures.ApplyRequest.payload;
  const operation={operationId:binding.operationId,expert:fixtures.BindingSetRequest.payload.expert,action:'prepare',state:'pending'};
  const payload={hostInstanceId:binding.hostInstanceId,scope:binding.scope,operationId:operation.operationId,expert:operation.expert};
  for(const [name,method] of [['PrivateResourcePrepareRequest','expert_resources_prepare'],['PrivateResourceRemoveRequest','expert_resources_remove']]){
    assert.ok(validate(name)({schemaVersion:1,requestId:fixtures.ApplyRequest.requestId,method,payload}));
    assert.ok(source.transport.commands.some(value=>value.method===method));
    assert.ok(source.transport.method_timeout_ms[method]<source.transport.native_response_timeout_ms);
  }
  assert.ok(validate('PrivateResourceReadRequest')({schemaVersion:1,requestId:fixtures.ApplyRequest.requestId,method:'expert_resources_operation_read',payload:{hostInstanceId:binding.hostInstanceId,scope:binding.scope,operationId:operation.operationId}}));
  assert.ok(validate('PrivateStatus')({catalogRevision:'a'.repeat(64),executionAvailable:true,resourceOperations:[operation]}));
  assert.equal(native.validatePrivateResourcePrepareRequest,undefined);
  assert.equal(native.validatePrivateStatus,undefined);
});
test('safe renderer closure excludes private identities, paths, hashes and grants',()=>{
  const schema=read('sdks/jsonschema/experts-native.schema.json');
  for(const name of ['ExpertRef','TurnExpertSnapshot','ScopeBinding','ApplyRequest','PrivateGrantRequest'])assert.equal(schema.$defs[name],undefined,name);
  for(const name of ['PrivateGrantRequest','ApplyRequest','SubmissionReadRequest'])assert.equal(native['validate'+name],undefined);
  const projection=structuredClone(fixtures.BindingReadResponse);projection.data.expert.archiveSha256='a'.repeat(64);assert.equal(native.validateBindingReadResponse(projection),false);
  const request=structuredClone(fixtures.BindingSetRequest);request.payload.expert.roleSha256='b'.repeat(64);assert.equal(native.validateBindingSetRequest(request),false);
});
test('versioned submit retains original market body and separate immutable expert context',()=>{
  assert.equal(source.source.$defs.MarketSubmission.$ref,'../market-host/wire.schema.json#/$defs/Submission');
  assert.equal(source.source.$defs.MarketSubmitPayload.$ref,'../market-selection/wire.schema.json#/$defs/SubmitPayload');
  const request=structuredClone(fixtures.PrivateGrantRequest);delete request.payload.submission.expertSnapshot;assert.equal(validate('PrivateGrantRequest')(request),false);
  assert.ok(source.transport.commands.some(c=>c.method==='expert_submission_read'&&c.response==='SubmissionReadResponse'));
  assert.ok(source.transport.semantics.submission.includes('entire')||source.transport.semantics.submission.includes('full typed wrapper'));
});
test('snapshot canonical bytes bind actual turn, binding revision and every version digest',()=>{
  for(const vector of read('fixtures/experts/digest-vectors.json')){
    assert.equal(canonicalExpertSnapshotText(vector,source.transport.snapshot_digest),vector.canonicalText);
    assert.equal(expertSnapshotDigest(vector),vector.snapshotDigest);
    assert.notEqual(expertSnapshotDigest({...vector,bindingRevision:vector.bindingRevision+1}),vector.snapshotDigest);
  }
});
test('knowledge digest uses UTF-8 byte lengths and identity order across languages',()=>{
  for(const vector of read('fixtures/experts/knowledge-digest-vectors.json')){
    const bytes=canonicalKnowledgeManifestBytes(vector.resources,source.transport.knowledge_digest);
    assert.equal(bytes.toString('utf8'),vector.canonicalText);assert.equal(createHash('sha256').update(bytes).digest('hex'),vector.digest);
    assert.equal(knowledgeManifestDigest([...vector.resources].reverse()),vector.digest);
    const changed=structuredClone(vector.resources);changed[0].title+='说明';assert.notEqual(knowledgeManifestDigest(changed),vector.digest);
  }
});
test('v3 local expert metadata requires explicit local permission without redistribution approval',()=>{
  assert.ok(validateBundle(bundle),JSON.stringify(validateBundle.errors));
  const release=structuredClone(bundle);release.distribution_channel='desktop-release';assert.equal(validateBundle(release),false);
  const missing=structuredClone(bundle);delete missing.skills[0].expert.local_use_authorization;assert.equal(validateBundle(missing),false);
  const unreviewed=structuredClone(bundle);unreviewed.skills[0].provenance.review_status='blocked';assert.equal(validateBundle(unreviewed),false);
  const projection=structuredClone(bundle);projection.skills[0].expert.runtime_projection='skill';assert.equal(validateBundle(projection),false);
});
test('ordinary v2 records retain exact source constraints inside v3',()=>{
  const ordinary=structuredClone(bundle.skills[0]);delete ordinary.asset_kind;delete ordinary.expert;ordinary.license.redistribution_status='verified';
  assert.ok(validateBundle({...bundle,skills:[ordinary]}));
  assert.ok(bundleAjv.getSchema(v2.$id)({...bundle,schema_version:2,skills:[ordinary]}));
  const explicit=structuredClone(ordinary);explicit.asset_kind='skill';assert.ok(validateBundle({...bundle,skills:[explicit]}));
  ordinary.license.redistribution_status='unverified';assert.equal(validateBundle({...bundle,skills:[ordinary]}),false);
  const inherited=v=>Array.isArray(v)?v.map(inherited):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([key,x])=>[key,key==='$ref'&&x.startsWith('#/')?'skill-bundle-manifest-v2.schema.json'+x:inherited(x)])):v;
  assert.deepEqual(v3.$defs.ordinaryEntry.allOf,inherited(v2.$defs.skillEntry.allOf));
  assert.deepEqual(v3.allOf[0],inherited(v2.allOf[0]));
});
test('new output is synchronized without regenerating or changing old authorities',()=>{
  execFileSync(process.execPath,['scripts/generate-experts.mjs','--check'],{stdio:'pipe'});
  const lock=read('compatibility/experts/source.lock.json');assert.equal(lock.release,false);
  for(const file of ['jsonschema/skills/skill-bundle-manifest-v1.schema.json','jsonschema/skills/skill-bundle-manifest-v2.schema.json','compatibility/market-host/wire.schema.json','compatibility/market-selection/wire.schema.json','scripts/generate.mjs','scripts/generate-market-host.mjs','scripts/market-broker-codegen.mjs']){
    assert.deepEqual(readFileSync(file),execFileSync('git',['show',lock.base_commit+':'+file]),file);
  }
});

test('explicit recovery carries immutable original intent separately from current authority',()=>{
  const binding=fixtures.PrivateBindingRecoverRequest;
  assert.deepEqual(binding.payload.original,fixtures.ApplyRequest.payload);
  assert.ok(validate('PrivateBindingRecoverRequest')(binding));
  assert.ok(validate('PrivateResourceRecoverRequest')(fixtures.PrivateResourceRecoverRequest));
  assert.ok(native.validateBindingRecoverRequest(fixtures.BindingRecoverRequest));
  assert.ok(native.validateResourceOperationRecoverRequest(fixtures.ResourceOperationRecoverRequest));
  assert.equal(native.validatePrivateBindingRecoverRequest,undefined);
  assert.equal(native.validatePrivateResourceRecoverRequest,undefined);
  for(const method of ['expert_binding_recover','expert_resources_recover']) {
    assert.ok(source.transport.commands.some(value=>value.method===method));
    assert.ok(source.transport.method_timeout_ms[method]<source.transport.native_response_timeout_ms);
  }
  assert.ok(source.transport.semantics.explicit_recovery.includes('Read/reopen/repeated set or prepare remain query-only'));
});
