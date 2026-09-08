import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--commit") { if (!args[++i]) throw new Error("--commit requires a full SHA"); }
  else if (!["--check", "--require-committed"].includes(args[i])) throw new Error(`Unsupported argument: ${args[i]}`);
}
const check = args.includes("--check");
const commitIndex = args.indexOf("--commit");
const explicitCommit = commitIndex < 0 ? null : args[commitIndex + 1];
const consumers = [
  {root: path.resolve(root, "../yijie-agent-host"), manifest: "api/native-conversation"},
  {root: path.resolve(root, "../yijie-desktop"), manifest: "contracts/native-conversation"},
];
const pairs = [
  ["openapi/native-conversation/native-conversation.yaml", 0, "api/openapi/native-conversation.yaml"],
  ["sdks/go/openapi/native-conversation/client.gen.go", 0, "internal/contracts/nativeconversation/types.gen.go"],
  ["sdks/typescript/src/openapi/native-conversation.gen.ts", 1, "src/api/generated/native-conversation.gen.ts"],
  ["openapi/native-conversation/native-conversation.yaml", 1, "src-tauri/contracts/native-conversation.json"],
];
const sourceNames = [...new Set([...pairs.map(([source]) => source),
  "compatibility/agent-host-native-conversation-v1.json", "scripts/generate.mjs",
  "scripts/sync-native-conversation.mjs", "package.json", "pnpm-lock.yaml", "go.mod", "go.sum",
  "openapi-typescript.redocly.yaml",
])];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
async function readLock(consumer) {
  try { return JSON.parse(await fs.readFile(path.join(consumer.root, `${consumer.manifest}.lock.json`), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
const existing = await Promise.all(consumers.map(readLock));
if (existing.some(Boolean) && !existing.every(Boolean) && !explicitCommit) throw new Error("Native conversation consumer pins are incomplete");
const commit = explicitCommit ?? existing[0]?.contracts?.full_commit ?? null;
if ((commitIndex >= 0 || commit !== null) && !/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error("An exact existing Contracts commit is required");
if (args.includes("--require-committed") && !commit) throw new Error("Native conversation requires an immutable Contracts source pin");
if (commit) {
  const {stdout} = await exec("git", ["rev-parse", "--verify", `${commit}^{commit}`], {cwd: root});
  if (stdout.trim() !== commit) throw new Error("Contracts commit cannot be resolved exactly");
}
const bytesBySource = new Map();
const sources = {};
for (const name of sourceNames) {
  const working = await fs.readFile(path.join(root, name));
  const bytes = commit ? (await exec("git", ["show", `${commit}:${name}`], {cwd: root, encoding: "buffer", maxBuffer: 16 * 1024 * 1024})).stdout : working;
  if (commit && !bytes.equals(working)) throw new Error(`Native source differs from committed pin: ${name}`);
  bytesBySource.set(name, bytes);
  sources[name] = digest(bytes);
}
const manifest = {
  schema_version: 1, feature: "FEAT-132", contract_family_version: "0.1.0",
  provenance: commit ? "git-commit" : "local-working-tree-candidate", published: false,
  ...(commit ? {contracts: {repository: "https://github.com/36Dge/yijie-contracts.git", full_commit: commit}} : {}),
  sources,
};
const suffix = commit ? ".lock.json" : ".candidate.json";
// Validate the complete source and every consumer before writing anything.
if (check) {
  for (const consumer of consumers) {
    const actual = JSON.parse(await fs.readFile(path.join(consumer.root, consumer.manifest + suffix), "utf8"));
    if (JSON.stringify(actual) !== JSON.stringify(manifest)) throw new Error(`Native manifest drift: ${consumer.manifest}`);
  }
  for (const [source, index, target] of pairs) {
    if (!(await fs.readFile(path.join(consumers[index].root, target))).equals(bytesBySource.get(source))) throw new Error(`Native consumer drift: ${target}`);
  }
} else {
  for (const [source, index, target] of pairs) {
    const output = path.join(consumers[index].root, target);
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, bytesBySource.get(source));
  }
  for (const consumer of consumers) {
    await fs.writeFile(path.join(consumer.root, consumer.manifest + suffix), JSON.stringify(manifest, null, 2) + "\n");
    if (commit) await fs.rm(path.join(consumer.root, consumer.manifest + ".candidate.json"), {force: true});
  }
}
console.log(`Native conversation ${check ? "verified" : "synchronized"}: ${commit ?? "uncommitted candidate"}; published=false`);
