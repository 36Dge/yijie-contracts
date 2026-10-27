import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const read = version => JSON.parse(fs.readFileSync(`openapi/native-conversation-v${version}/native-conversation-v${version}.yaml`, "utf8"));
const current = read(5), previous = read(4);
const ajv = new Ajv({strict:false}); addFormats(ajv);
const validate = spec => ajv.compile({components:spec.components,$ref:"#/components/schemas/NativeItem"});

test("activity v5 expands the existing native family and preserves closed v4", () => {
  assert.deepEqual(Object.keys(current.paths),["/v5/agent-sessions/{agent_session_id}/native-thread","/v12/agent-sessions/{agent_session_id}/events"]);
  assert.deepEqual(current.security,previous.security);
  assert.deepEqual(previous.components.schemas.NativeEvent.properties.schema_version.enum,[11]);
  for (const name of ["NativeNotification","NativeTurn","NativeMcpDisplay","NativeError","NativePlanStep","NativeWebSearchDisplay"]) assert.deepEqual(current.components.schemas[name],previous.components.schemas[name]);
  const check=validate(current), old=validate(previous);
  for (const item of [
    {id:"read",type:"commandExecution",availability:"available",commandPreview:"cat report.md",commandActions:[{index:0,type:"read",name:"report.md",pathLabel:"report.md"}]},
    {id:"edit",type:"fileChange",status:"completed",availability:"available",fileChange:{changes:[{index:0,kind:"add",pathLabel:"notes.md",addedLines:2,removedLines:0,diffText:"one\ntwo\n"}]}},
    {id:"app",type:"mcpToolCall",availability:"available",appContext:{connectorId:"example",appName:"Example App",actionName:"Read report"}},
  ]) { assert.equal(check(item),true,JSON.stringify(check.errors)); assert.equal(old(item),false); }
  assert.equal(old({id:"edit",type:"unknown",availability:"unavailable"}),true);
});

test("partial file records keep unknown statistics absent and limits remain explicit", () => {
  const check=validate(current);
  const item={id:"partial",type:"fileChange",status:"inProgress",availability:"partial",fileChange:{changes:[{index:0,kind:"update"}]}};
  assert.equal(check(item),true);
  assert.equal(check({...item,fileChange:{changes:[{index:0,kind:"update",addedLines:-1}]}}),false);
  assert.equal(check({...item,fileChange:{changes:Array(129).fill({index:0,kind:"add"})}}),false);
  assert.equal(check({...item,appContext:{resourceUri:"ordinary-resource"}}),false);
});

test("the fixed native authority already contains every consumed activity variant", () => {
  const source=fs.readFileSync("../yijie-codex/codex-rs/app-server-protocol/src/protocol/v2/item.rs","utf8");
  for(const field of ["pub enum CommandAction", "command_actions: Vec<CommandAction>", "changes: Vec<FileUpdateChange>", "app_context: Option<McpToolCallAppContext>", "pub enum PatchChangeKind"]) assert.ok(source.includes(field));
});
