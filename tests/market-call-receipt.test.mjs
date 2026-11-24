import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import {loadBrokerSource} from '../scripts/market-broker-source.mjs';
import {loadMarketHostSource as loadV1} from '../scripts/market-host-source.mjs';
import {loadMarketHostSource as loadV2} from '../scripts/market-host-v2-source.mjs';

const baseline='2592f5d5b07fcd92de10d25c4dcf73bd1ce03cb5';
const {schema,manifest}=loadBrokerSource();
const fixture=JSON.parse(readFileSync('fixtures/market-broker-control/normal-wire.json'));
const identity=fixture.PendingCallResponse.data.identity;
const decision=fixture.DecideCallRequest.payload;
const receipt={schemaVersion:1,callRef:identity.callRef,serviceId:identity.serviceId,
  reference:identity.reference,nativeThreadId:identity.nativeThreadId,nativeTurnId:identity.nativeTurnId,
  turnOperationId:identity.binding.turnOperationId,selectionDigest:identity.binding.selectionDigest,
  toolName:identity.toolName,argsDigest:identity.argsDigest,argsEncoding:identity.argsEncoding,
  decisionReceipt:{approvalId:decision.approvalRef,decisionId:decision.decisionId,decision:'approve_once'},
  admissionConsumed:true};
function validator(schema,name){
  const ajv=new Ajv({strict:true,allErrors:true});
  ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  ajv.addFormat('int64',{type:'number',validate:Number.isSafeInteger});ajv.addSchema(schema);
  return ajv.getSchema(schema.$id+'#/$defs/'+name);
}
test('one-shot decision, rejection and natural expiry have distinct read-only receipts',()=>{
  const valid=validator(schema,'GatewayCallReceipt');
  assert.ok(valid(receipt),JSON.stringify(valid.errors));
  for(const value of ['reject','cancel'])assert.ok(valid({...receipt,admissionConsumed:false,decisionReceipt:{...receipt.decisionReceipt,decision:value}}));
  assert.ok(valid({...receipt,admissionConsumed:false,decisionReceipt:null}));
  assert.equal(valid({...receipt,decisionReceipt:null}),false);
  assert.equal(valid({...receipt,decisionReceipt:{...receipt.decisionReceipt,decision:'reject'}}),false);
  const incomplete={...receipt};delete incomplete.decisionReceipt;assert.equal(valid(incomplete),false);
  assert.equal(valid({...receipt,schemaVersion:2}),false);
});
test('result metadata fits native retention and contains no execution or credential capability',()=>{
  assert.equal(manifest.result_metadata.key,'yijie.market.call');
  assert.equal(manifest.result_metadata.methodKey,'yijie.market.method');
  assert.ok(Buffer.byteLength(JSON.stringify(receipt))<manifest.result_metadata.maxMetadataBytes);
  assert.ok(manifest.result_metadata.maxResultEnvelopeBytes<1024*1024);
  const fields=Object.keys(schema.$defs.GatewayCallReceipt.properties);
  for(const forbidden of ['credentialRef','capabilityRef','arguments','scope','token'])assert.ok(!fields.includes(forbidden));
});
test('old and new Host readers accept both old observations and additive linked observations',()=>{
  const oldObservation={nativeItemId:'ordinary-item',nativeThreadId:receipt.nativeThreadId,
    nativeTurnId:receipt.nativeTurnId,serverName:'yijie_market',toolName:receipt.toolName,state:'completed',truncated:false};
  const linked={...oldObservation,callRef:receipt.callRef,correlation:receipt};
  for(const [family,current] of [['market-host',loadV1()],['market-host-v2',loadV2()]]){
    const old=JSON.parse(execFileSync('git',['show',`${baseline}:sdks/jsonschema/${family}.schema.json`],{maxBuffer:16*1024*1024}));
    for(const source of [old,current.schema]){
      const valid=validator(source,'ToolObservation');
      assert.ok(valid(oldObservation),JSON.stringify(valid.errors));assert.ok(valid(linked),JSON.stringify(valid.errors));
    }
    assert.equal(current.source.$defs.ServiceBinding.$ref,'../market-provider/wire.schema.json#/$defs/ProviderBinding');
    assert.match(current.manifest.semantics.approvals,/default_tools_approval_mode=approve/);
    assert.match(current.manifest.semantics.approvals,/ask\/on-request/);
  }
});
