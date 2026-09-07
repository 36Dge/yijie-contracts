import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import YAML from "yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const spec=YAML.parse(fs.readFileSync(new URL("../openapi/runtime-permissions/runtime-permissions.yaml",import.meta.url),"utf8"));
const ajv=new Ajv({strict:false});addFormats(ajv);
const check=(name)=>ajv.compile({components:spec.components,$ref:`#/components/schemas/${name}`});

test("FEAT-152 modes and approve-once decision are closed to the selected native behavior",()=>{
  const mode=check("PermissionMode");
  for(const value of ["ask","auto","full"])assert.equal(mode(value),true);
  assert.equal(mode("custom"),false);
  const decision=check("RuntimeApprovalDecision");
  for(const value of ["approve_once","reject"])assert.equal(decision({decision:value}),true);
  assert.equal(decision({decision:"approve_session"}),false);
});

test("FEAT-152 Host snapshot is consumable and remains bounded",()=>{
  const snapshot=check("RuntimeApprovalSnapshot");
  assert.equal(snapshot({requests:[]}),true);
  const request={id:"019c1a00-0000-7000-8000-000000000001",kind:"command",summary:"printf hello",scope:"/workspace",reason:"Read sample output",status:"pending"};
  assert.equal(snapshot({requests:[request]}),true);
  assert.equal(snapshot({requests:[{...request,status:"unavailable"}]}),true);
  assert.equal(snapshot({requests:[{...request,status:"unknown"}]}),false);
});

test("FEAT-152 actual retained Runtime agrees with the contracts mapping",{skip:!process.env.YIJIE_PERMISSION_CONFIGURATION_EVIDENCE},()=>{
  const evidence=JSON.parse(fs.readFileSync(process.env.YIJIE_PERMISSION_CONFIGURATION_EVIDENCE,"utf8"));
  assert.equal(evidence.status,"PASS");
  assert.equal(evidence.provider_calls,0);
  assert.equal(evidence.tool_executions,0);
  assert.deepEqual(evidence.modes.map(({mode,approvalPolicy,approvalsReviewer,sandbox})=>[mode,approvalPolicy,approvalsReviewer,sandbox]),[
    ["ask","on-request","user","workspaceWrite"],
    ["auto","on-request","auto_review","workspaceWrite"],
    ["full","never","user","dangerFullAccess"],
  ]);
});
