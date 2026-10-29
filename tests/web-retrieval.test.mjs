import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {loadWebRetrievalSource} from '../scripts/web-retrieval-source.mjs';

const family=loadWebRetrievalSource();
const ajv=new Ajv({strict:true,allErrors:true});
addFormats(ajv);
const validator=name=>ajv.compile(family.standalone(name));
test('three current tools expose canonical closed input/output and billed read-only annotations',()=>{
  assert.deepEqual(family.tools.map(t=>t.name),['kimi_web_search','kimi_web_search_pro','kimi_web_fetch']);
  for(const tool of family.tools){
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.equal(tool.outputSchema.type,'object');
    assert.equal(tool.outputSchema.oneOf.length,tool.name==='kimi_web_search'?3:2);
    assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true});
  }
  assert.deepEqual(JSON.parse(readFileSync('sdks/jsonschema/web-retrieval.tools.json')),family.tools);
  assert.equal(family.manifest.semantics.permissionMode,'ask');
  assert.equal(family.manifest.semantics.businessRetry,'never');
});
test('Search defaults only omitted limit and validates Unicode character boundaries',()=>{
  const valid=validator('SearchArguments');
  for(const value of [{query:'official documentation'},{query:'检索'.repeat(1024),limit:1},{query:'ordinary',limit:20}])assert.ok(valid(value),JSON.stringify(valid.errors));
  for(const value of [{query:''},{query:'   '},{query:'文'.repeat(2049)},{query:'ordinary',limit:0},{query:'ordinary',limit:21},{query:'ordinary',limit:null},{query:'ordinary',limit:1.5},{query:'ordinary',unexpected:true}])assert.equal(valid(value),false);
  assert.equal(family.schema.$defs.SearchArguments.properties.limit.default,5);
  assert.equal(family.schema.$defs.SearchArguments.properties.query.pattern.length,2);
});
test('Fetch input accepts an explicit bounded HTTP(S) URL and rejects absent/extra values',()=>{
  const valid=validator('FetchArguments');
  assert.ok(valid({url:'https://example.org/documentation'}));
  assert.ok(valid({url:'http://example.org/documentation'}));
  for(const value of [{},{url:null},{url:'ordinary text'},{url:'ftp://example.org/documentation'},{url:'https://example.org/'+ 'a'.repeat(4096)},{url:'https://example.org/',extra:1}])assert.equal(valid(value),false);
});
test('successful list and body preserve source shape and explicit truncation',()=>{
  const search=validator('SearchOutput'),fetch=validator('FetchOutput');
  assert.ok(search({results:[],truncated:false}));
  assert.ok(search({results:[{title:'',url:'https://example.org/',snippet:''}],truncated:true}));
  assert.equal(search({results:[]}),false);
  assert.equal(search({results:[{title:'Example',url:'https://example.org/'}],truncated:false}),false);
  const body={url:'https://example.org/',title:'Example',markdown:'# Ordinary content',truncated:false};
  assert.ok(fetch(body));assert.ok(fetch({...body,truncated:true}));
  assert.equal(fetch({...body,markdown:' \n'}),false);
  assert.equal(fetch({...body,html:'ordinary additional field'}),false);
  assert.equal(fetch({...body,truncated:null}),false);
});
test('error branches are closed and code/message pairs are canonical local text',()=>{
  const search=validator('SearchOutput'),fetch=validator('FetchOutput');
  for(const [code,message]of Object.entries(family.manifest.error_messages)){
    const error={error:{code,message}};assert.ok(search(error));assert.ok(fetch(error));
    assert.equal(search({error:{code,message:'unrecognized provider message'}}),false);
    assert.equal(search({...error,results:[],truncated:false}),false);
    assert.equal(search({error:{code,message,detail:'extra'}}),false);
  }
  assert.equal(search({error:{code:'unknown_error',message:'ordinary text'}}),false);
  assert.equal(family.schema.$defs.ErrorCode.enum.length,10);
});
test('local preparation keeps zero supplier HTTP and unchanged MCP budget',()=>{
  assert.equal(family.manifest.limits.maxResultBytes,65536);
  assert.equal(family.manifest.limits.maxResponseBytes,1048576);
  assert.equal(family.manifest.limits.httpTimeoutMs,15000);
  assert.equal(family.manifest.limits.searchTimeoutSeconds,10);
  assert.match(family.manifest.semantics.qualification,/no \/models, inference or Search\/Fetch call/);
  assert.match(family.manifest.semantics.qualification,/no pricing guarantee/);
  const provider=JSON.parse(readFileSync('compatibility/market-provider/transport.json'));
  const broker=JSON.parse(readFileSync('compatibility/market-broker-control/control.json'));
  for(const value of [provider,broker]) {
    assert.match(value.semantics.qualification,/kimi-web/);
    assert.match(value.semantics.qualification,/(?:no|without) \/models/);
    assert.match(value.semantics.qualification,/local/);
    assert.match(value.semantics.qualification,/selection, per-call ask/);
  }
  assert.match(broker.semantics.kimiModelCredential,/no HTTP/);
  assert.equal(broker.kimi_model_credential.maxKeyBytes,16384);
  assert.equal(broker.kimi_model_credential.terminator,'\n');
  assert.equal(provider.tool_profile.profile,'tushare-daily-v1');
  assert.equal(broker.generic_profile.maxResultBytes,65536);
  assert.equal(broker.generic_profile.permissionMode,'ask');
  const management=JSON.parse(readFileSync('openapi/market-connectors/market-connectors.yaml'));
  const policy=management['x-native-ipc'].builtinModelCredentialPolicy;
  assert.equal(policy.serviceId,'kimi-web');
  assert.equal(policy.defaultDesiredEnabled,true);
  assert.deepEqual(policy.requiredPermissions,['connector.manage','connector.credentials.manage']);
  assert.equal(policy.supplierHttpDuringPreparation,false);
  assert.equal(policy.respectDisableAndUninstall,true);
});
test('focused canonical generator check is synchronized without network or legacy fixtures',()=>{
  execFileSync(process.execPath,['scripts/generate-web-retrieval.mjs','--check'],{stdio:'pipe'});
});

test('frozen legacy descriptor and default output remain unchanged',()=>{
 for(const file of ['wire.schema.json','tools.json']){
  const before=execFileSync('git',['show',`61137174a25dc368e0006f27633fd4a9ad097aa6:compatibility/web-retrieval/${file}`]);
  assert.deepEqual(readFileSync(`compatibility/web-retrieval/legacy/0.2.0/${file}`),before);
 }
 const old=loadWebRetrievalSource({legacy:true});
 assert.equal(old.manifest.contract_version,'0.2.0');
 assert.deepEqual(old.tools.map(t=>t.name),['kimi_web_search','kimi_web_fetch']);
 for(const name of ['SearchResult','SearchSuccess','FetchArguments','FetchSuccess','FetchOutput','ErrorOutput'])assert.deepEqual(family.schema.$defs[name],old.schema.$defs[name]);
 const legacy=old.standalone('SearchArguments');
 assert.equal(ajv.compile(legacy)({query:'public docs',include_content:true}),false);
});
test('body and Pro sources retain separate typed content and drop status',()=>{
 const content=validator('ContentSuccess'),pro=validator('ProSuccess');
 for(const status of ['available','unavailable','truncated']){
  const base={title:'Example',url:'https://example.org/',snippet:'summary',content_status:status};
  assert.ok(content({results:[{...base,text:status==='available'?'body':''}],truncated:status==='truncated',dropped_results:0}));
  assert.ok(pro({results:[{...base,site_name:'Example',date:'2026-10-29',authority:'',chunks:[{text:status==='unavailable'?'':'body',score:0.25}]}],truncated:status==='truncated',dropped_results:0}));
 }
 assert.equal(content({results:[],truncated:false}),false);
 assert.equal(pro({results:[],truncated:false,dropped_results:-1}),false);
 assert.equal(validator('SearchSuccess')({results:[],truncated:false,dropped_results:0}),false);
});
test('Pro input accepts explicit constraints without inventing defaults',()=>{
 const valid=validator('ProArguments');
 assert.ok(valid({query:'public docs'}));
 assert.ok(valid({query:'public docs',sites:['example.org'],time_window:{start:'2026-01',end:'2026-10-29'}}));
 for(const input of [{query:'docs',sites:['']},{query:'docs',sites:['a b']},{query:'docs',sites:Array(6).fill('example.org')},{query:'docs',include_content:true},{query:'docs',time_window:null}])assert.equal(valid(input),false);
 assert.equal(family.manifest.limits.contentHttpTimeoutMs,35000);
});

test('content provenance cannot contradict body or top-level truncation',()=>{
 const valid=validator('ContentSuccess');
 const page={title:'',url:'https://example.org/',snippet:'',text:'body',content_status:'available'};
 for(const v of [
  {results:[{...page,text:''}],truncated:false,dropped_results:0},
  {results:[{...page,content_status:'unavailable'}],truncated:false,dropped_results:0},
  {results:[{...page,content_status:'truncated'}],truncated:false,dropped_results:0},
  {results:[page],truncated:false,dropped_results:1}
 ]) assert.equal(valid(v),false);
 assert.ok(valid({results:[{...page,text:'',content_status:'truncated'}],truncated:true,dropped_results:0}));
});
