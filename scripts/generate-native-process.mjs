// Same OpenAPI code generators and options as the frozen native family.
// A scoped entry avoids changing legacy generator pins or unrelated fixtures.
import {execFileSync} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),"yijie-native-process-codegen-"));
try {
 for (const version of [3, 4]) {
  const spec=`openapi/native-conversation-v${version}/native-conversation-v${version}.yaml`;
  const outputs=[[`sdks/typescript/src/openapi/native-conversation-v${version}.gen.ts`,"types.ts"],[`sdks/go/openapi/native-conversation-v${version}/client.gen.go`,"types.go"]];
  execFileSync("pnpm",["exec","openapi-typescript",spec,"--redocly","openapi-typescript.redocly.yaml","-o",path.join(scratch,"types.ts")],{cwd:root,stdio:"inherit"});
  execFileSync("go",["tool","oapi-codegen","-generate","types,client,skip-prune","-package",`nativeconversationv${version}`,"-o",path.join(scratch,"types.go"),spec],{cwd:root,stdio:"inherit"});
  for(const [output, temporary] of outputs) {
    const bytes=await fs.readFile(path.join(scratch,temporary));
    if(process.argv.includes("--check")) {
      if(!(await fs.readFile(path.join(root,output))).equals(bytes)) throw Error(`Native process generation drift: ${output}`);
    } else { await fs.mkdir(path.dirname(path.join(root,output)),{recursive:true});await fs.writeFile(path.join(root,output),bytes); }
  }
 }
} finally { await fs.rm(scratch,{recursive:true,force:true}); }
