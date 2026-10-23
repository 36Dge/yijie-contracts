import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const candidate = args.includes("--candidate");
const commitIndex = args.indexOf("--commit");
const commit = commitIndex < 0 ? null : args[commitIndex + 1];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--commit") i++;
  else if (!["--check", "--candidate"].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
}
if (candidate === Boolean(commit)) throw new Error("Select either explicit local candidate or exact source commit");
if (commit && (!/^[a-f0-9]{40}$/.test(commit) || execFileSync("git", ["rev-parse", `${commit}^{commit}`], {cwd: root, encoding: "utf8"}).trim() !== commit)) throw new Error("Exact source commit required");
const spec = "openapi/native-conversation-v4/native-conversation-v4.yaml";
const pairs = [
  ["openapi/native-conversation-v3/native-conversation-v3.yaml", "yijie-agent-host/api/openapi/native-conversation-v3.yaml"],
  ["sdks/go/openapi/native-conversation-v3/client.gen.go", "yijie-agent-host/internal/contracts/nativeconversationv3/types.gen.go"],
  ["openapi/native-conversation-v3/native-conversation-v3.yaml", "yijie-desktop/src-tauri/contracts/native-conversation-v3.json"],
  ["sdks/typescript/src/openapi/native-conversation-v3.gen.ts", "yijie-desktop/src/api/generated/native-conversation-v3.gen.ts"],
  [spec, "yijie-agent-host/api/openapi/native-conversation-v4.yaml"],
  ["sdks/go/openapi/native-conversation-v4/client.gen.go", "yijie-agent-host/internal/contracts/nativeconversationv4/types.gen.go"],
  [spec, "yijie-desktop/src-tauri/contracts/native-conversation-v4.json"],
  ["sdks/typescript/src/openapi/native-conversation-v4.gen.ts", "yijie-desktop/src/api/generated/native-conversation-v4.gen.ts"],
];
const sources = {};
for (const source of [...new Set([...pairs.map(([file]) => file), "scripts/generate-native-process.mjs", "scripts/sync-native-process.mjs"])]) {
  const bytes = await fs.readFile(path.join(root, source));
  if (commit && !bytes.equals(execFileSync("git", ["show", `${commit}:${source}`], {cwd: root, maxBuffer: 16 << 20}))) throw new Error(`Uncommitted source: ${source}`);
  sources[source] = createHash("sha256").update(bytes).digest("hex");
}
const manifest = {schema_version: 1, contract_family_version: "0.4.0", published: false,
  provenance: candidate ? "local-working-tree-candidate" : "git-commit", ...(commit ? {contracts: {full_commit: commit}} : {}), sources};
const outputs = [];
for (const [source, destination] of pairs) outputs.push([destination, await fs.readFile(path.join(root, source))]);
for (const target of ["yijie-agent-host/api", "yijie-desktop/contracts"]) outputs.push([`${target}/native-process.${candidate ? "candidate" : "lock"}.json`, Buffer.from(JSON.stringify(manifest, null, 2) + "\n")]);
for (const [destination, bytes] of outputs) {
  const file = path.resolve(root, "..", destination);
  if (check) { if (!(await fs.readFile(file)).equals(bytes)) throw new Error(`Native process source drift: ${destination}`); }
  else { await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, bytes); }
}
console.log(`Native process ${check ? "verified" : "synchronized"}: ${commit ?? "local candidate, not a release pin"}`);
