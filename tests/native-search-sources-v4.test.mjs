import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const load=v=>JSON.parse(fs.readFileSync(`openapi/native-conversation-v${v}/native-conversation-v${v}.yaml`,"utf8"));
const current=load(4), old=load(3);
const ajv=new Ajv({strict:false});addFormats(ajv);
const validate=spec=>ajv.compile({components:spec.components,$ref:"#/components/schemas/NativeItem"});

test("source metadata uses new closed boundaries and retains unrelated semantics",()=>{
  assert.deepEqual(Object.keys(current.paths),["/v4/agent-sessions/{agent_session_id}/native-thread","/v11/agent-sessions/{agent_session_id}/events"]);
  assert.deepEqual(current.security,old.security);
  assert.deepEqual(current.components.schemas.NativeEvent.properties.schema_version.enum,[11]);
  assert.deepEqual(current.components.schemas.NativeThreadSnapshot.properties.schema_version.enum,[4]);
  for(const name of ["NativeItem","NativeNotification","NativeTurn","NativeError","NativePlanStep"])
    assert.deepEqual(current.components.schemas[name],old.components.schemas[name]);
  // Only v4's documented discovery display policy changes; its closed wire,
  // limits and previous readers remain byte-for-byte structurally equivalent.
  const {description: currentDescription, ...display} = current.components.schemas.NativeMcpDisplay;
  const {description: previousDescription, ...previousDisplay} = old.components.schemas.NativeMcpDisplay;
  assert.deepEqual(display,previousDisplay);
  assert.match(currentDescription,/list_mcp_resources\/list_mcp_resource_templates/);
  assert.match(currentDescription,/never resource URIs, cursors or metadata/);
  assert.match(previousDescription,/No raw arguments\/error\/meta\/resources\/structuredContent/);
  assert.deepEqual(old.components.schemas.NativeEvent.properties.schema_version.enum,[10]);
});

test("resource discovery results use the existing indexed text shape for both readers",()=>{
  const item={id:"resource-check",type:"mcpToolCall",status:"completed",availability:"available",argumentsSummary:"查询所有已连接服务的可用资源",mcp:{server:"codex",tool:"list_mcp_resources",resultKind:"text",texts:[{index:0,text:"未发现可用资源"}],diagnostics:[]}};
  assert.equal(validate(current)(item),true);
  assert.equal(validate(old)(item),true);
  assert.equal(validate(current)({...item,availability:"partial",mcp:{...item.mcp,resultKind:"omitted",texts:[],diagnostics:["result_unavailable"]}}),true);
});

test("actual optional sources survive new validation and are absent from old readers",()=>{
  const item={id:"search-record",type:"webSearch",availability:"available",webSearch:{action:"search",queries:["annual statistics"]}};
  const check=validate(current),previous=validate(old);
  assert.equal(check(item),true);assert.equal(previous(item),true);
  const extended={...item,webSearch:{...item.webSearch,sources:[{url:"https://example.org/statistics/2025",title:"Annual statistics"}]}};
  assert.equal(check(extended),true);assert.equal(previous(extended),false);
  assert.equal(check({...extended,webSearch:{...extended.webSearch,sources:Array(33).fill(extended.webSearch.sources[0])}}),false);
  assert.equal(check({...extended,webSearch:{...extended.webSearch,sources:[]}}),true);
});
