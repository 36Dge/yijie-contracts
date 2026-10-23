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
  for(const name of ["NativeItem","NativeNotification","NativeTurn","NativeMcpDisplay","NativeError","NativePlanStep"])
    assert.deepEqual(current.components.schemas[name],old.components.schemas[name]);
  assert.deepEqual(old.components.schemas.NativeEvent.properties.schema_version.enum,[10]);
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
