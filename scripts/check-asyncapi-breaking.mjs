import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import { compareAsyncApi } from "./asyncapi-compatibility.mjs";

const exec = promisify(execFile);
const baseRef = process.argv[2] ?? "main";
const asyncApiFile = process.argv[3] ?? "asyncapi/events.yaml";

await exec("git", ["rev-parse", "--verify", baseRef]);

let previousSource = null;
try {
  const { stdout } = await exec("git", ["show", `${baseRef}:${asyncApiFile}`], {
    maxBuffer: 10_000_000,
  });
  previousSource = stdout;
} catch (error) {
  const missingPath = await exec("git", ["cat-file", "-e", `${baseRef}:${asyncApiFile}`])
    .then(() => false)
    .catch(() => true);
  if (!missingPath) throw error;
}

const currentApi = parseYaml(await readFile(asyncApiFile, "utf8"));
const previousApi = previousSource === null ? null : parseYaml(previousSource);
const errors = compareAsyncApi(previousApi, currentApi);

if (errors.length > 0) {
  throw new Error(`Breaking AsyncAPI changes detected:\n${errors.join("\n")}`);
}

if (previousApi === null) {
  console.log(
    `No AsyncAPI document exists at ${baseRef}:${asyncApiFile}; the current document is an additive change.`,
  );
} else {
  console.log(`No breaking AsyncAPI changes relative to ${baseRef}.`);
}
