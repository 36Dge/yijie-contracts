import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import {loadMarketHostSource,loadMarketProviderSource,dailyOutputSchema} from '../scripts/market-host-source.mjs';
import * as native from '../sdks/typescript/src/api/generated/market-host-native-validator.gen.js';
const host=loadMarketHostSource(),provider=loadMarketProviderSource(),fixture=JSON.parse(readFileSync('fixtures/market-host/normal-wire.json'));
function validators(source){const ajv=new Ajv({strict:true,allErrors:true});ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);ajv.addFormat('int64',{type:'number',validate:Number.isSafeInteger});ajv.addSchema(source.schema);return n=>ajv.getSchema(source.schema.$id+'#/$defs/'+n);}
const hv=validators(host),pv=validators(provider);
test('Host source compiles complete referenced v2 content and normal private frames',()=>{
 for(const n of Object.keys(host.defs))assert.ok(hv(n),n);
 for(const[n,v]of Object.entries(fixture))assert.ok(hv(n)(v),n+': '+JSON.stringify(hv(n).errors));
 assert.equal(host.source.$defs.ContentBlock.$ref,'../../openapi/agent-host/agent-host.yaml#/components/schemas/StartTurnV2ContentBlock');
 assert.equal(host.source.$defs.ServiceBinding.$ref,'../market-provider/wire.schema.json#/$defs/ProviderBinding');
});
test('private submission freezes all inputs while HTTP cannot replace intent',()=>{
 const grant=structuredClone(fixture.GrantRegisterRequest);delete grant.payload.submission.agentSessionId;assert.equal(hv('GrantRegisterRequest')(grant),false);
 const trigger={...fixture.SubmitRequest,payload:{...fixture.SubmitRequest.payload,contentBlocks:[{type:'text',text:'other ordinary text'}]}};assert.equal(hv('SubmitRequest')(trigger),false);
 const missing=structuredClone(fixture.GrantRegisterRequest);delete missing.payload.submission.services[0].credentialRef;assert.equal(hv('GrantRegisterRequest')(missing),false);
 assert.ok(host.manifest.http.filter(v=>v.method==='GET').every(v=>v.request_id_header==='X-Yijie-Market-Request-Id'));
});
test('optional bounded history index preserves old observations and request authority',()=>{
 const response=structuredClone(fixture.NativeObserveResponse);
 assert.ok(native.validateNativeObserveResponse(response));
 const turn={nativeTurnId:'15700000-0000-4000-8000-000000000042',selectionDisplay:[]};
 response.data.availableTurns=[turn];response.data.turnsTruncated=false;
 assert.ok(native.validateNativeObserveResponse(response));
 response.data.availableTurns=Array.from({length:129},()=>turn);
 assert.equal(native.validateNativeObserveResponse(response),false);
 const request=structuredClone(fixture.NativeObserveRequest);
 request.payload.nativeTurnId=turn.nativeTurnId;
 assert.ok(native.validateNativeObserveRequest(request));
 request.payload.selectionDisplay=[];
 assert.equal(native.validateNativeObserveRequest(request),false);
});
test('Native UI exports exactly observe and decision, never private grants or provider control',()=>{
 const m=JSON.parse(readFileSync('compatibility/market-host/native-ipc.json'));
 assert.deepEqual(m.commands.map(c=>c.command),['chat_market_observe_v1','chat_market_approval_decide_v1']);
 for(const n of ['NativeObserveRequest','NativeObserveResponse','NativeApprovalDecideRequest','NativeError'])assert.ok(native['validate'+n](fixture[n]));
 assert.equal(Object.hasOwn(native,'validateGrantRegisterRequest'),false);assert.equal(Object.hasOwn(native,'validateAuthBeginRequest'),false);
 const decision=structuredClone(fixture.NativeApprovalDecideRequest);decision.payload.scope=fixture.GrantRegisterRequest.payload.scope;assert.equal(native.validateNativeApprovalDecideRequest(decision),false);
 assert.ok(native.validateNativeError({...fixture.NativeError,code:'keyring_unavailable'}));
});
test('provider management validates exact non-secret installation and operation identity',()=>{
 for(const n of Object.keys(provider.defs))assert.ok(pv(n),n);
 for(const n of ['AuthBegin','AuthPoll','AuthCancel','Forget','Probe'])for(const suffix of ['Request','Response'])assert.ok(pv(n+suffix)(fixture[n+suffix]));
 const missing=structuredClone(fixture.AuthBeginRequest);delete missing.payload.binding.reference.revision;assert.equal(pv('AuthBeginRequest')(missing),false);
 const prohibited=new Set(['token','secret','apiKey','clientSecret','headers','credentialValue']);
 for(const source of [provider.schema,host.schema]){function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v.properties??{}))assert.ok(!prohibited.has(k),k);Object.values(v).forEach(walk);}walk(source);}
 assert.match(provider.manifest.semantics.asynchronous,/forget.*not rollbackable/);
});
test('new family generated output and original source families stay synchronized',()=>{
 for(const script of ['generate-market-host.mjs','generate-market-provider.mjs','generate-market-broker.mjs','generate-market-connectors.mjs','generate-market-selection.mjs'])execFileSync(process.execPath,['scripts/'+script,'--check'],{stdio:'pipe'});
 assert.equal(host.source.$defs.ErrorCode.anyOf[1].$ref,'../market-provider/wire.schema.json#/$defs/ErrorCode');
});
test('daily profile admits one instrument and one Gregorian day without expanding upstream tools',()=>{
 const policy=provider.manifest.tool_profile;
 assert.equal(policy.profile,'tushare-daily-v1');assert.equal(policy.gatewayToolName,'tushare_daily');assert.equal(policy.upstreamToolName,'daily');
 assert.equal(policy.risk,'read');assert.equal(policy.permissionMode,'ask');assert.equal(policy.maxRows,1);assert.equal(policy.maxCallsPerApproval,1);
 assert.equal(policy.upstreamInputSchemaSha256,'ec10409543d1ae690de2b5da5893a0e69387cdd5a398f976fb04d187fc632ae1');
 assert.match(provider.manifest.semantics.admission,/without network, a new probe or a new authorization attempt/);
 assert.match(provider.manifest.semantics.lifecycle,/polling never extends them/);
 assert.match(provider.manifest.semantics.lifecycle,/Every old turn\/call keeps its original monotonic TTL without renewal/);
 const validate=pv('TushareDailyArguments');
 for(const ts_code of ['000001.SZ','600000.SH','920001.BJ'])for(const trade_date of ['00010101','20000229','20240229','20260105','99991231'])assert.ok(validate({ts_code,trade_date}));
 for(const trade_date of ['00000101','19000229','21000229','20250229','20260230','20260431','20260001','20260100','20261301'])assert.equal(validate({ts_code:'000001.SZ',trade_date}),false,trade_date);
 for(const ts_code of ['000001','000001.sz','000001.SZ,600000.SH'])assert.equal(validate({ts_code,trade_date:'20260105'}),false);
 assert.equal(validate({ts_code:'000001.SZ',trade_date:'20260105',fields:'close'}),false);
 assert.equal(validate({ts_code:'000001.SZ'}),false);
 // Exercise ordinary calendar boundaries across one full Gregorian cycle.
 for(let year=2000;year<2400;year++){
  assert.equal(validate({ts_code:'600000.SH',trade_date:String(year)+'0229'}),year%4===0&&(year%100!==0||year%400===0));
 }
});
test('normalized daily output requires close for a nonempty row and preserves successful empty data',()=>{
 const schema=dailyOutputSchema(provider),validate=new Ajv({strict:true}).compile(schema);
 assert.deepEqual(JSON.parse(readFileSync('sdks/jsonschema/tushare-daily-output.schema.json')),{$schema:provider.schema.$schema,...schema});
 assert.deepEqual(provider.manifest.tool_profile.resultRequiredNumericFields,['close']);
 assert.deepEqual(schema.properties.rows.items.properties.ts_code,provider.defs.TushareDailyArguments.properties.ts_code);
 const row={ts_code:'000001.SZ',trade_date:'20260105',close:10.25};
 assert.ok(validate({rows:[]}));assert.ok(validate({rows:[row]}));assert.ok(validate({rows:[{...row,open:10,vol:0}]}));
 assert.equal(validate({}),false);assert.equal(validate({rows:[{ts_code:row.ts_code,trade_date:row.trade_date}]}),false);
 for(const close of [null,'10.25',Infinity])assert.equal(validate({rows:[{...row,close}]}),false);
 assert.equal(validate({rows:[{...row,open:null}]}),false);assert.equal(validate({rows:[row,row]}),false);
 assert.equal(validate({rows:[{...row,description:'ordinary text'}]}),false);
});
