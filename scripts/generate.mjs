import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { compile } from "json-schema-to-typescript";

const exec = promisify(execFile);
const root = process.cwd();

async function run(command, args) {
  const { stdout, stderr } = await exec(command, args, { cwd: root });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function collectJsonSchemas(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const schemas = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      schemas.push(...(await collectJsonSchemas(fullPath)));
    } else if (entry.name.endsWith(".json")) {
      schemas.push({
        fullPath,
        relativePath: path.relative(path.join(root, "jsonschema"), fullPath),
        schema: JSON.parse(await readFile(fullPath, "utf8")),
      });
    }
  }
  return schemas.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

for (const dir of [
  "sdks/go/openapi",
  "sdks/go/protobuf",
  "sdks/typescript/src/openapi",
  "sdks/typescript/src/protobuf",
  "sdks/typescript/src/jsonschema",
]) {
  await rm(path.join(root, dir), { recursive: true, force: true });
}

const openapiSpecs = [
  ["public", "publicapi", "openapi/public/public.yaml"],
  ["admin", "adminapi", "openapi/admin/admin.yaml"],
  ["internal", "internalapi", "openapi/internal/internal.yaml"],
];

for (const [name, goPackage, spec] of openapiSpecs) {
  const tsOutput = `sdks/typescript/src/openapi/${name}.gen.ts`;
  const goOutput = `sdks/go/openapi/${name}/client.gen.go`;
  await mkdir(path.dirname(path.join(root, tsOutput)), { recursive: true });
  await mkdir(path.dirname(path.join(root, goOutput)), { recursive: true });
  await run("pnpm", [
    "exec",
    "openapi-typescript",
    spec,
    "--redocly",
    "openapi-typescript.redocly.yaml",
    "-o",
    tsOutput,
  ]);
  await run("go", [
    "tool",
    "oapi-codegen",
    "-generate",
    "types,client",
    "-package",
    goPackage,
    "-o",
    goOutput,
    spec,
  ]);
}

await run("pnpm", ["exec", "buf", "generate"]);

const schemas = await collectJsonSchemas(path.join(root, "jsonschema"));
const schemaExports = [];
for (const { relativePath, schema } of schemas) {
  const outputName = relativePath.replace(/\.schema\.json$/, "").replaceAll(path.sep, "-");
  const outputPath = path.join(root, "sdks/typescript/src/jsonschema", `${outputName}.gen.ts`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    await compile(schema, schema.title, {
      bannerComment: "/* Generated from JSON Schema. Do not edit by hand. */",
      additionalProperties: false,
      format: false,
    }),
  );
  schemaExports.push(`export * from "./jsonschema/${outputName}.gen";`);
}

await writeFile(
  path.join(root, "sdks/typescript/src/index.ts"),
  [
    "/* Generated SDK entrypoint. Do not edit by hand. */",
    'export * as PublicApi from "./openapi/public.gen";',
    'export * as AdminApi from "./openapi/admin.gen";',
    'export * as InternalApi from "./openapi/internal.gen";',
    ...schemaExports,
    "",
  ].join("\n"),
);

console.log(`Generated OpenAPI, Protobuf, and ${schemas.length} JSON Schema SDK sources.`);
