// Generate the typed projection of native choices; no local policy defaults.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const args=process.argv.slice(2); assert(args.every(a=>a==="--check"));
const spec="openapi/runtime-approvals-v4/runtime-approvals-v4.yaml";
const temporary=mkdtempSync(path.join(tmpdir(),"yijie-approval-types-"));
try {
  const ts=path.join(temporary,"types.ts");
  execFileSync(path.join(root,"node_modules/.bin/openapi-typescript"),[path.join(root,spec),"--output",ts],{cwd:temporary});
  const go=execFileSync("go",["tool","oapi-codegen","-generate","types","-package","runtimeapprovalsv4","-import-mapping","../runtime-permissions-v2/runtime-permissions-v2.yaml:github.com/36Dge/yijie-agent-host/internal/contracts/runtimepermissionsv2",spec],{cwd:root});
  const outputs=new Map([["../yijie-agent-host/internal/contracts/runtimeapprovalsv4/types.gen.go",go],["../yijie-desktop/src/api/generated/runtime-approvals-v4.gen.ts",readFileSync(ts)]]);
  for (const [dest,bytes] of outputs) {
    const file=path.resolve(root,dest);
    if(args.includes("--check")) assert.deepEqual(readFileSync(file),bytes,dest);
    else {mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);}
  }
} finally {rmSync(temporary,{recursive:true,force:true});}
