import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import YAML from "yaml";

const spec = YAML.parse(readFileSync("openapi/runtime-approvals-v3/runtime-approvals-v3.yaml","utf8"));
const v2Path = "openapi/runtime-permissions-v2/runtime-permissions-v2.yaml";
const v2 = JSON.parse(readFileSync(v2Path));
test("v3 adds only native choices to the original v2 receipt and accepts no caller-authored rules", () => {
  const ajv = new Ajv({strict:false}); addFormats(ajv);
  const base = "https://contracts.invalid/openapi/";
  ajv.addSchema(v2, base+"runtime-permissions-v2/runtime-permissions-v2.yaml");
  const validate = name => ajv.compile({$id:base+"runtime-approvals-v3/"+name, ...spec.components.schemas[name], components:spec.components});
  const choices = validate("RuntimeApprovalChoices"), decision = validate("SimilarCommandDecision");
  const id="01440000-0000-4000-8000-000000000001";
  const request = {id,kind:"command",scope:"/workspace",reason:"查看状态",summary:"git status", status:"pending"};
  assert.equal(choices({requests:[request], commandPrefixes:{[id]:["git","status"]}}), true);
  assert.equal(choices({requests:[request], commandPrefixes:{[id]:[]}}), false);
  assert.equal(decision({decision:"approve_similar"}), true);
  assert.equal(decision({decision:"approve_similar",prefix:["git","status"]}), false);
  assert.equal(decision({decision:"approve_once"}), false);
  assert.deepEqual(v2.components.schemas.RuntimeApprovalDecision.properties.decision.enum,["approve_once","reject","cancel"]);
  for(const file of [v2Path,"sdks/go/openapi/runtime-permissions-v2/client.gen.go","sdks/typescript/src/openapi/runtime-permissions-v2.gen.ts"]){
    assert(readFileSync(file).equals(execFileSync("git",["show","5f305cb7e9746ef58827fe9195f9b493c1dd26df:"+file])));
  }
});
