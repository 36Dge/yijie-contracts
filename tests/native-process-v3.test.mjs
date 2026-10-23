import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const load = version => JSON.parse(fs.readFileSync(`openapi/native-conversation-v${version}/native-conversation-v${version}.yaml`, "utf8"));
const current = load(3), previous = load(2);
const ajv = new Ajv({strict: false}); addFormats(ajv);
const validate = (spec, name) => ajv.compile({components: spec.components, $ref: `#/components/schemas/${name}`});

test("native process v3 uses new endpoints and preserves closed v2 and unrelated native semantics", () => {
  assert.deepEqual(Object.keys(current.paths), ["/v3/agent-sessions/{agent_session_id}/native-thread", "/v10/agent-sessions/{agent_session_id}/events"]);
  assert.deepEqual(current.security, previous.security);
  assert.deepEqual(previous.components.schemas.NativeEvent.properties.schema_version.enum, [8]);
  assert.deepEqual(current.components.schemas.NativeEvent.properties.schema_version.enum, [10]);
  assert.deepEqual(previous.components.schemas.NativeThreadSnapshot.properties.schema_version.enum, [2]);
  for (const name of ["NativeNotification","NativeTurn","NativeMcpDisplay","NativeError","NativePlanStep","NativeThreadStatusSnapshot"]) assert.deepEqual(current.components.schemas[name],previous.components.schemas[name]);
  assert.deepEqual(current.components.schemas.NativeItem.properties.phase,previous.components.schemas.NativeItem.properties.phase);
  assert.ok(!previous.components.schemas.NativeItem.properties.type.enum.includes("webSearch"));
  for (const operation of Object.values(current.paths)) {
    for (const response of Object.values(operation.get.responses)) assert.deepEqual(response.headers["Cache-Control"].schema.enum,["no-store"]);
  }
});

test("new WebSearch display carries only bounded native action facts, never a URL or fabricated lifecycle", () => {
  const check = validate(current, "NativeItem");
  const old = validate(previous, "NativeItem");
  for (const action of ["search","openPage","findInPage","other"]) {
    const item={id:"native-search",type:"webSearch",availability:"available",webSearch:{action,queries:["产业对比"],pageLabel:"example.org",pattern:"收入"}};
    assert.equal(check(item),true);
    assert.equal(old(item),false);
    assert.equal(check({...item,webSearch:{...item.webSearch,url:"https://example.org/report"}}),false);
    assert.equal(check({...item,webSearch:{...item.webSearch,queries:Array(9).fill("普通查询")}}),false);
  }
  const downgrade={id:"native-search",type:"unknown",availability:"unavailable"};
  assert.equal(old(downgrade),true);
});

test("fixed Codex Runtime already defines WebSearch and all supported native action types", () => {
  const item=fs.readFileSync("../yijie-codex/codex-rs/app-server-protocol/src/protocol/v2/item.rs","utf8");
  assert.match(item,/WebSearch\(WebSearchItem\)/);
  for(const action of ["Search", "OpenPage", "FindInPage", "Other"]) assert.match(item,new RegExp(`WebSearchAction::${action}`));
});
