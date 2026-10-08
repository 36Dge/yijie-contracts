import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import * as standalone from '../sdks/typescript/src/api/generated/market-connectors-validator.gen.js';
const source=JSON.parse(readFileSync('openapi/market-connectors/market-connectors.yaml'));
const schema=JSON.parse(readFileSync('sdks/jsonschema/market-connectors.schema.json'));
const ajv=new Ajv({strict:true,allErrors:true});
ajv.addFormat('uuid',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);ajv.addSchema(schema);
const id='00000000-0000-4000-8000-000000000157';
const id2='00000000-0000-4000-8000-000000000158';
const envelope=payload=>({schemaVersion:1,requestId:id,contextId:id2,payload});
const entry={serviceId:'synthetic-service',serverName:'synthetic-service',displayName:'合成连接器',categoryId:'productivity',categoryLabel:'效率工具',description:'Synthetic local contract data only',iconAssetId:'synthetic-service',transport:'http',authMode:'unknown',availability:'unverified',blockerCodes:['dependency_missing']};
const installation={installationId:id,serviceId:'synthetic-service',revision:1,generation:1,status:'installed',desiredEnabled:false,effectiveEnabled:false,configurationStatus:'unconfigured',authorizationStatus:'unknown',connectionStatus:'disconnected'};
const operation={operationId:id2,installationId:id,serviceId:'synthetic-service',action:'install',status:'succeeded',revision:1,cancellable:false};
const ref={installationId:id,revision:1,generation:1};
const common={installationId:id,operationId:id2,expectedRevision:1};
const fixtures={
 CatalogEntry:entry,Installation:installation,Operation:operation,
 SnapshotRequest:envelope({}),
 InstallRequest:envelope({serviceId:'synthetic-service',operationId:id2,expectedRevision:0}),
 SetEnabledRequest:envelope({...common,desiredEnabled:false}),
 UninstallRequest:envelope({...common,confirmed:true}),
 ConfigureRequest:envelope({...common,expectedGeneration:1}),
 AuthorizeRequest:envelope({...common,expectedGeneration:1}),
 OperationReadRequest:envelope({operationId:id2}),
 OperationCancelRequest:envelope({operationId:id2,expectedRevision:1}),
 OperationReopenRequest:envelope({operationId:id2,expectedRevision:1}),
 SelectionValidateRequest:envelope({selection:[ref]}),
 SnapshotResponse:{schemaVersion:1,requestId:id,data:{catalogRevision:1,catalog:[entry],installations:[installation],capabilities:['connector.read'],executionAvailable:false}},
 MutationResponse:{schemaVersion:1,requestId:id,data:{installation,operation}},
 OperationResponse:{schemaVersion:1,requestId:id,data:operation},
 SelectionValidateResponse:{schemaVersion:1,requestId:id,data:{selection:[{reference:ref,serviceId:'synthetic-service',displayName:'合成连接器'}],executionAvailable:false}},
 Error:{schemaVersion:1,requestId:id,code:'execution_unavailable',retryable:false},
 WorkerAuthStatusRequest:{schemaVersion:1,requestId:id,method:'auth_status',serviceId:'synthetic-service'},
 WorkerAuthStatusResponse:{schemaVersion:1,requestId:id,data:{serviceId:'synthetic-service',qualification:'not_qualified',authorizationStatus:'unknown',connectionStatus:'disconnected',executionAvailable:false,libraryPolicy:{mcpLibrary:'codex-rmcp-client',oauthStore:'keyring_only',credentialBoundary:'connectors_only',stdioShutdown:'eof_only',externalCallsEnabled:false}}},
 WorkerError:{schemaVersion:1,code:'unknown_service',retryable:false},
};
function check(name,value,expected){
 const compiled=ajv.getSchema(schema.$id+'#/$defs/'+name);const emitted=standalone['validate'+name];
 assert.equal(compiled(value),expected,`${name}: source validation ${JSON.stringify(compiled.errors)}`);
 assert.equal(emitted(value),expected,`${name}: standalone validation ${JSON.stringify(emitted.errors)}`);
}
test('new source command table uses ten versioned commands and existing context binding',()=>{
 assert.equal(source['x-native-ipc'].contextBinding,'chat_bind_management_context_v1');
 assert.equal(source['x-native-ipc'].commands.length,10);
 assert.ok(source['x-native-ipc'].commands.every(c=>c.command.endsWith('_v1')&&schema.$defs[c.request]&&schema.$defs[c.response]));
 assert.deepEqual(source.components.schemas.Permission.enum,['connector.read','connector.manage','connector.credentials.manage','connector.use']);
 assert.deepEqual(source.paths,{});
});
test('source and standalone accept normal non-secret local requests and observations',()=>{
 for(const [name,fixture]of Object.entries(fixtures))check(name,fixture,true);
});
test('request envelope requires context, identity, schema version and closed payload',()=>{
 for(const field of ['schemaVersion','requestId','contextId','payload']){
  const omitted={...fixtures.SnapshotRequest};delete omitted[field];check('SnapshotRequest',omitted,false);
  check('SnapshotRequest',{...fixtures.SnapshotRequest,[field]:null},false);
 }
 check('SnapshotRequest',{...fixtures.SnapshotRequest,schemaVersion:2},false);
 check('SnapshotRequest',{...fixtures.SnapshotRequest,requestId:'00000000-0000-0000-0000-000000000000'},false);
 check('SnapshotRequest',{...fixtures.SnapshotRequest,futureRevision:1},false);
 check('SnapshotRequest',envelope({futureRevision:1}),false);
});
test('idempotent management carries explicit revisions and credential generations',()=>{
 check('InstallRequest',envelope({...fixtures.InstallRequest.payload,expectedRevision:1}),false);
 check('SetEnabledRequest',envelope({...fixtures.SetEnabledRequest.payload,expectedRevision:0}),false);
 check('SetEnabledRequest',envelope({...fixtures.SetEnabledRequest.payload,expectedRevision:9007199254740992}),false);
 check('ConfigureRequest',envelope({...fixtures.ConfigureRequest.payload,expectedGeneration:0}),false);
 check('UninstallRequest',envelope({...fixtures.UninstallRequest.payload,confirmed:false}),false);
});
test('response unknown fields are forward compatible; known fields/enums stay strict',()=>{
 check('CatalogEntry',{...entry,futureBadge:'beta'},true);
 check('SnapshotResponse',{...fixtures.SnapshotResponse,futureRevision:1},true);
 check('Installation',{...installation,connectionStatus:'future_state'},false);
 check('Installation',{...installation,credentialRef:null},false);
 check('Error',{schemaVersion:1,code:'future_error',retryable:false},false);
 check('SnapshotResponse',{...fixtures.SnapshotResponse,data:{...fixtures.SnapshotResponse.data,capabilities:['future.permission']}},false);
});
test('local authorization capability is optional false and independent of tool qualification',()=>{
 const definition=source.components.schemas.CatalogEntry;
 assert.equal(definition.properties.authorizationAvailable.default,false);
 assert.ok(!definition.required.includes('authorizationAvailable'));
 for(const authorizationAvailable of [undefined,false,true]){
  const catalogEntry={...entry,authMode:'oauth'};
  if(authorizationAvailable!==undefined)catalogEntry.authorizationAvailable=authorizationAvailable;
  check('CatalogEntry',catalogEntry,true);
  check('SnapshotResponse',{...fixtures.SnapshotResponse,data:{...fixtures.SnapshotResponse.data,catalog:[catalogEntry]}},true);
  assert.equal(catalogEntry.authorizationAvailable===true,authorizationAvailable===true);
  assert.equal(catalogEntry.availability,'unverified');
 }
 check('CatalogEntry',{...entry,authorizationAvailable:null},false);
 check('CatalogEntry',{...entry,authorizationAvailable:'true'},false);
});
test('selection references are bounded versioned identities without configuration',()=>{
 check('SelectionRef',{...ref,revision:0},false);
 check('SelectionValidateRequest',envelope({selection:[ref,ref]}),false);
 check('SelectionValidateRequest',envelope({selection:[]}),true);
 check('SelectionRef',{...ref,displayName:'synthetic'},false);
});
test('worker policy/status cannot claim qualified execution or silent secret storage fallback',()=>{
 check('WorkerAuthStatusRequest',{...fixtures.WorkerAuthStatusRequest,method:'library_policy'},false);
 check('WorkerAuthStatusResponse',{...fixtures.WorkerAuthStatusResponse,data:{...fixtures.WorkerAuthStatusResponse.data,executionAvailable:true}},false);
 check('WorkerLibraryPolicy',{...fixtures.WorkerAuthStatusResponse.data.libraryPolicy,oauthStore:'file'},false);
 check('WorkerError',{schemaVersion:1,code:'not_qualified',retryable:false},true);
});
test('front-end source exposes no arbitrary platform configuration or plaintext secret field',()=>{
 const prohibited=new Set(['url','serverUrl','command','args','env','headers','token','secret','apiKey','clientSecret','credentialValue','authorizationUrl']);
 function walk(value){if(!value||typeof value!=='object')return;for(const key of Object.keys(value.properties??{}))assert.ok(!prohibited.has(key));for(const child of Object.values(value))walk(child);}
 walk(schema);
});
test('canonical generation stays synchronized without running legacy generation or provider calls',()=>{
 execFileSync(process.execPath,['scripts/generate-market-connectors.mjs','--check'],{stdio:'pipe'});
});

test('authorization page recovery has scoped original-operation authority without a new auth intent',()=>{
 const command=source['x-native-ipc'].commands.find(c=>c.command==='market_connectors_operation_reopen_v1');
 assert.equal(command.requiredPermission,'connector.credentials.manage');
 assert.deepEqual(source.components.schemas.OperationCancelPayload.required,['operationId','expectedRevision']);
 check('OperationReopenRequest',envelope({operationId:id2,expectedRevision:2}),true);
 check('OperationReopenRequest',envelope({operationId:id2}),false);
});
