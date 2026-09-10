import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--commit") { if (!/^[a-f0-9]{40}$/.test(args[++i] ?? "")) throw new Error("Exact commit required"); }
  else if (!["--candidate", "--check", "--require-committed"].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
}
if (args.includes("--candidate") && (args.includes("--commit") || args.includes("--require-committed"))) throw new Error("Candidate is never a committed source");
const check = args.includes("--check");
const hosts = [path.resolve(root, "../yijie-agent-host"), path.resolve(root, "../yijie-desktop")];
const locks = ["api/native-mcp", "contracts/native-mcp"];
const pairs = [["compatibility/sorftime-product-detail.input.schema.json", 0, "internal/codex/sorftime-product-detail.input.schema.json"]];
for (const [family, pkg] of [["native-conversation-v2", "nativeconversationv2"], ["runtime-permissions-v2", "runtimepermissionsv2"]]) {
  pairs.push([`openapi/${family}/${family}.yaml`, 0, `api/openapi/${family}.yaml`],
    [`sdks/go/openapi/${family}/client.gen.go`, 0, `internal/contracts/${pkg}/types.gen.go`],
    [`sdks/typescript/src/openapi/${family}.gen.ts`, 1, `src/api/generated/${family}.gen.ts`],
    [`openapi/${family}/${family}.yaml`, 1, `src-tauri/contracts/${family}.json`]);
}
let commit = null;
if (args.includes("--commit")) commit = args[args.indexOf("--commit") + 1];
else if (!args.includes("--candidate")) {
  const lock = JSON.parse(await fs.readFile(path.join(hosts[0], locks[0] + ".lock.json"), "utf8"));
  commit = lock.contracts.full_commit;
}
if (args.includes("--require-committed") && !commit) throw new Error("Native MCP source must be committed before activation");
if (commit && execFileSync("git", ["rev-parse", "--verify", `${commit}^{commit}`], {cwd: root, encoding: "utf8"}).trim() !== commit) throw new Error("Unresolved source commit");
const names = [...new Set([...pairs.map(([name]) => name), "compatibility/agent-host-native-mcp-v2.json", "scripts/generate.mjs", "scripts/sync-native-mcp.mjs", "go.mod", "go.sum", "package.json", "pnpm-lock.yaml", "openapi-typescript.redocly.yaml"])];
const content = new Map(); const sources = {};
for (const name of names) {
  const bytes = await fs.readFile(path.join(root, name));
  if (commit && !bytes.equals(execFileSync("git", ["show", `${commit}:${name}`], {cwd: root, maxBuffer: 16 << 20}))) throw new Error(`Uncommitted native MCP source: ${name}`);
  content.set(name, bytes); sources[name] = createHash("sha256").update(bytes).digest("hex");
}
const manifest = {schema_version: 1, feature: "FEAT-144", contract_family_version: "0.2.0", provenance: commit ? "git-commit" : "local-working-tree-candidate", published: false,
  ...(commit ? {contracts: {repository: "https://github.com/36Dge/yijie-contracts.git", full_commit: commit}} : {}), sources};
const suffix = commit ? ".lock.json" : ".candidate.json";
if (check) {
  for (let i = 0; i < hosts.length; i++) if (JSON.stringify(JSON.parse(await fs.readFile(path.join(hosts[i], locks[i] + suffix), "utf8"))) !== JSON.stringify(manifest)) throw new Error(`Native MCP manifest drift: ${locks[i]}`);
  for (const [name, i, target] of pairs) if (!(await fs.readFile(path.join(hosts[i], target))).equals(content.get(name))) throw new Error(`Native MCP consumer drift: ${target}`);
} else {
  for (const [name, i, target] of pairs) {await fs.mkdir(path.dirname(path.join(hosts[i], target)), {recursive: true}); await fs.writeFile(path.join(hosts[i], target), content.get(name));}
  for (let i = 0; i < hosts.length; i++) {await fs.writeFile(path.join(hosts[i], locks[i] + suffix), JSON.stringify(manifest, null, 2) + "\n"); if (commit) await fs.rm(path.join(hosts[i], locks[i] + ".candidate.json"), {force: true});}
}
console.log(`Native MCP ${check ? "verified" : "synchronized"}: ${commit ?? "uncommitted candidate; activation prohibited"}`);
