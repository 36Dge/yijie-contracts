import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as validators from '../sdks/typescript/src/api/generated/market-selection-validator.gen.js';
import {loadMarketSelectionSource,validateMarketSelectionManifest,marketSelectionSourcePath} from '../scripts/market-selection-source.mjs';
const {source,manifest}=loadMarketSelectionSource();
const schema=JSON.parse(readFileSync('sdks/jsonschema/market-selection.schema.json'));
const id='00000000-0000-4000-8000-000000000157';
const request=()=>({schemaVersion:1,requestId:id,contextId:id,payload:{operationId:id,projectId:null,contentBlocks:[{type:'text',text:'普通本地输入'}],intent:{profileId:'minimax-m3-high-v1',expectedRevision:0},selection:[]}});
test('source adds exactly one ordinary chat IPC and reuses external authorities',()=>{
 assert.equal(Object.hasOwn(source,'paths'),false);assert.equal(Object.hasOwn(source,'servers'),false);
 assert.equal(manifest.transport,'native_ipc');assert.equal(manifest.native_ipc.commands.length,1);
 assert.equal(manifest.native_ipc.commands[0].command,'chat_market_submit_v1');
 for(const name of ['CanonicalId','SelectionRef','ProfileId','ModelRevision','TextInput'])assert.ok(source.$defs[name].$ref&&!source.$defs[name].$ref.startsWith('#'));
 assert.match(manifest.semantics.legacyCollision,/never adopt/);
 assert.match(manifest.semantics.unqualifiedProvider,/all new submissions/);
});
test('private manifest is validated independently and cannot introduce undeclared transport or command',()=>{
 validateMarketSelectionManifest(manifest,Object.keys(source.$defs));
 assert.throws(()=>validateMarketSelectionManifest({...manifest,transport:'http'},Object.keys(source.$defs)));
 assert.throws(()=>validateMarketSelectionManifest({...manifest,futureMetadata:true},Object.keys(source.$defs)));
 assert.throws(()=>validateMarketSelectionManifest({...manifest,native_ipc:{...manifest.native_ipc,commands:[]}},Object.keys(source.$defs)));
 assert.equal(marketSelectionSourcePath,'compatibility/market-selection/wire.schema.json');
 assert.equal(existsSync('jsonschema/chat/market-selection-v1.schema.json'),false);
 assert.equal(existsSync('openapi/market-selection/market-selection.yaml'),false);
});
test('structural Native request distinguishes target, null and content references',()=>{
 assert.ok(validators.validateSubmitRequest(request()));
 const missing=request();delete missing.payload.projectId;assert.equal(validators.validateSubmitRequest(missing),false);
 const existing=request();existing.payload.sessionId=id;assert.ok(validators.validateSubmitRequest(existing));
 existing.payload.projectId=id;assert.equal(validators.validateSubmitRequest(existing),false);
 const future=request();future.payload.futureField=1;assert.equal(validators.validateSubmitRequest(future),false);
 const blocks=request();blocks.payload.contentBlocks=[{type:'image',attachmentId:id},{type:'file',attachmentId:id}];assert.ok(validators.validateSubmitRequest(blocks));
});
test('required model and selection identity are bounded by original sources',()=>{
 const value=request();value.payload.intent.profileId='other';assert.equal(validators.validateSubmitRequest(value),false);
 const refs=request();refs.payload.selection=[{installationId:id,revision:1,generation:1}];assert.ok(validators.validateSubmitRequest(refs));
 refs.payload.selection[0].generation=0;assert.equal(validators.validateSubmitRequest(refs),false);
 assert.equal(validators.validateSelection(Array.from({length:52},(_,i)=>({installationId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,revision:1,generation:1}))),false);
});
test('cross-language vectors encode exact operation identity and sorted refs',()=>{
 const vectors=JSON.parse(readFileSync('fixtures/market-selection/digest-vectors.json'));
 for(const v of vectors){assert.equal(createHash('sha256').update(v.canonicalText).digest('hex'),v.selectionDigest);assert.ok(v.canonicalText.endsWith('\n'));assert.ok(validators.validateSelection(v.selection));}
 assert.notEqual(vectors[0].selectionDigest,createHash('sha256').update(vectors[0].canonicalText.replace('000000000157','000000000158')).digest('hex'));
});
test('receipt states local durability and preserves first-turn identity distinction',()=>{
 const receipt={outcome:'local_durable_accepted',sessionId:id,localTurnId:id,submissionOperationId:id,turnOperationId:'00000000-0000-4000-8000-000000000158',selectionDigest:'a'.repeat(64)};
 assert.ok(validators.validateSubmissionReceipt(receipt));assert.equal(validators.validateSubmissionReceipt({...receipt,outcome:'runtime_accepted'}),false);
 assert.ok(validators.validateError({schemaVersion:1,code:'invalid_request',retryable:false}));
 assert.equal(validators.validateError({schemaVersion:1,requestId:null,code:'invalid_request',retryable:false}),false);
});
test('source generation remains synchronized with the additive page-reopen request',()=>{
 execFileSync(process.execPath,['scripts/generate-market-selection.mjs','--check'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/generate-market-connectors.mjs','--check'],{stdio:'pipe'});
 const definitions=JSON.parse(readFileSync('openapi/market-connectors/market-connectors.yaml')).components.schemas;
 assert.equal(Object.keys(definitions).length,56);
 assert.equal(definitions.OperationReopenRequest.properties.payload.$ref,'#/components/schemas/OperationCancelPayload');
 assert.equal(Object.keys(schema.$defs).filter(n=>n==='SelectionRef').length,1);
});
