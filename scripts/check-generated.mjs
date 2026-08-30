import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const roots = ["sdks/go", "sdks/typescript/src", "sdks/asyncapi"];

async function snapshot(dir) {
  const result = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [file, content] of await snapshot(fullPath)) result.set(file, content);
    } else {
      result.set(fullPath, await readFile(fullPath, "utf8"));
    }
  }
  return result;
}

async function snapshotAll() {
  const result = new Map();
  for (const root of roots) {
    for (const [file, content] of await snapshot(root)) result.set(file, content);
  }
  return result;
}

const before = await snapshotAll();
const generateArgs = ["scripts/generate.mjs"];
if (process.argv.includes("--skip-skill-fixture-generation")) {
  generateArgs.push("--skip-skill-fixture-generation");
}
await exec("node", generateArgs, { maxBuffer: 20_000_000 });
const after = await snapshotAll();
const changed = new Set([...before.keys(), ...after.keys()]);
for (const file of changed) {
  if (before.get(file) === after.get(file)) changed.delete(file);
}
if (changed.size > 0) {
  throw new Error(`Generated SDK files were stale:\n${[...changed].sort().join("\n")}`);
}

console.log(`Verified ${after.size} generated SDK files are current.`);
