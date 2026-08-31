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

function splitAgentHostGoV6Interface(source, legacyName, extensionName) {
  const declaration = `type ${legacyName} interface {`;
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`missing generated ${legacyName}`);
  const bodyStart = start + declaration.length;
  const end = source.indexOf("\n}\n", bodyStart);
  if (end < 0) throw new Error(`unterminated generated ${legacyName}`);
  const groups = source
    .slice(bodyStart, end)
    .split("\n\n")
    .map((group) => group.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean);
  const v6Groups = groups.filter((group) => group.includes("V6"));
  const legacyGroups = groups.filter((group) => !group.includes("V6"));
  const v6MethodCount = v6Groups
    .flatMap((group) => group.split("\n"))
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]/.test(line) && line.includes("(")).length;
  if (v6MethodCount !== 4) {
    throw new Error(`expected four FEAT-137 methods in generated ${legacyName}, found ${v6MethodCount}`);
  }
  const replacement = [
    declaration,
    legacyGroups.join("\n\n"),
    "}",
    "",
    `// ${extensionName} is the opt-in FEAT-137 v6 extension. The legacy ${legacyName}`,
    "// intentionally remains source-compatible for existing mocks and adapters.",
    `type ${extensionName} interface {`,
    `\t${legacyName}`,
    "",
    v6Groups.join("\n\n"),
    "}",
    "",
  ].join("\n");
  return source.slice(0, start) + replacement + source.slice(end + 3);
}

function addAgentHostGoV6ResponseClient(source) {
  const marker = "\n// WithBaseURL overrides the baseURL.";
  if (!source.includes(marker)) throw new Error("missing Agent Host response-client insertion point");
  const responseClient = `
// ClientWithResponsesV6 is the opt-in FEAT-137 response wrapper. It promotes
// every legacy response method without widening ClientWithResponses.
type ClientWithResponsesV6 struct {
\t*ClientWithResponses
\tv6 ClientV6Interface
}

// NewClientWithResponsesV6 creates the opt-in FEAT-137 response wrapper.
func NewClientWithResponsesV6(server string, opts ...ClientOption) (*ClientWithResponsesV6, error) {
\tclient, err := NewClient(server, opts...)
\tif err != nil {
\t\treturn nil, err
\t}
\treturn WithResponsesV6(client), nil
}

// WithResponsesV6 wraps an implementation of the opt-in FEAT-137 client interface.
func WithResponsesV6(client ClientV6Interface) *ClientWithResponsesV6 {
\treturn &ClientWithResponsesV6{
\t\tClientWithResponses: &ClientWithResponses{ClientInterface: client},
\t\tv6:                  client,
\t}
}
`;
  let compatible = source.replace(marker, `\n${responseClient}${marker}`);
  const methods = [
    ["GetPendingAgentApprovalsV6WithResponse", "GetPendingAgentApprovalsV6"],
    ["DecideAgentApprovalV6WithBodyWithResponse", "DecideAgentApprovalV6WithBody"],
    ["DecideAgentApprovalV6WithResponse", "DecideAgentApprovalV6"],
    ["StreamAgentSessionEventsV6WithResponse", "StreamAgentSessionEventsV6"],
  ];
  for (const [responseMethod, rawMethod] of methods) {
    const receiver = `func (c *ClientWithResponses) ${responseMethod}(`;
    const v6Receiver = `func (c *ClientWithResponsesV6) ${responseMethod}(`;
    const call = `\trsp, err := c.${rawMethod}(`;
    const v6Call = `\trsp, err := c.v6.${rawMethod}(`;
    if (!compatible.includes(receiver) || !compatible.includes(call)) {
      throw new Error(`missing generated FEAT-137 response method ${responseMethod}`);
    }
    compatible = compatible.replace(receiver, v6Receiver).replace(call, v6Call);
  }
  return `${compatible}
var (
\t_ ClientInterface                = (*Client)(nil)
\t_ ClientV6Interface              = (*Client)(nil)
\t_ ClientWithResponsesInterface   = (*ClientWithResponses)(nil)
\t_ ClientWithResponsesV6Interface = (*ClientWithResponsesV6)(nil)
)
`;
}

async function preserveAgentHostGoCompatibility(goOutput) {
  const generated = await readFile(goOutput, "utf8");
  const typeName = "StreamAgentSessionEventsV2ParamsEventSchemaVersion";
  const stableName = `${typeName}N2`;
  const unstableDeclaration = `\tN2 ${typeName} = 2`;
  const stableDeclaration = `\t${stableName} ${typeName} = 2`;
  let compatible = generated;
  if (compatible.includes(unstableDeclaration) && compatible.includes("\tcase N2:")) {
    compatible = compatible
      .replace(unstableDeclaration, stableDeclaration)
      .replace("\tcase N2:", `\tcase ${stableName}:`);
  } else if (!compatible.includes(stableDeclaration)) {
    throw new Error(`cannot preserve the published Agent Host Go enum symbol in ${goOutput}`);
  }
  compatible = splitAgentHostGoV6Interface(
    compatible,
    "ClientInterface",
    "ClientV6Interface",
  );
  compatible = splitAgentHostGoV6Interface(
    compatible,
    "ClientWithResponsesInterface",
    "ClientWithResponsesV6Interface",
  );
  compatible = addAgentHostGoV6ResponseClient(compatible);
  await writeFile(goOutput, compatible);
}

if (!process.argv.includes("--skip-skill-fixture-generation")) {
  await run("node", ["scripts/generate-skill-bundle-fixtures.mjs"]);
}

for (const dir of [
  "sdks/go/openapi",
  "sdks/go/protobuf",
  "sdks/asyncapi",
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
  ["agent-host", "agenthostapi", "openapi/agent-host/agent-host.yaml"],
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
  if (name === "agent-host") {
    // Preserve the published v2 enum identifier and keep legacy client interfaces
    // source-compatible while exposing v6 through explicit extension interfaces.
    await preserveAgentHostGoCompatibility(path.join(root, goOutput));
    await run("gofmt", ["-w", goOutput]);
  }
}

await run("pnpm", ["exec", "buf", "generate"]);

await mkdir(path.join(root, "sdks/asyncapi"), { recursive: true });
await run("pnpm", [
  "exec",
  "redocly",
  "bundle",
  "asyncapi/events.yaml",
  "--output",
  "sdks/asyncapi/events.bundle.json",
]);

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
  if (
    outputName === "agent-session-event-v2" ||
    outputName === "agent-session-event-v3" ||
    outputName === "agent-session-event-v4" ||
    outputName === "agent-session-event-v5" ||
    outputName === "agent-session-event-v6" ||
    outputName === "report-report-document-v1" ||
    outputName === "skills-skill-bundle-manifest-v2" ||
    outputName === "compatibility-agent-host-runtime-approval-v6-v2" ||
    outputName === "compatibility-agent-host-runtime-approval-v6-v3"
  ) {
    // Versioned event/report/compatibility schemas intentionally reuse protocol concept names.
    // Namespace exports keep additions from making the existing root SDK
    // exports ambiguous or forcing wire concepts to be renamed for TypeScript.
    const namespace = {
      "agent-session-event-v2": "AgentSessionEventSchemaV2",
      "agent-session-event-v3": "AgentSessionEventSchemaV3",
      "agent-session-event-v4": "AgentSessionEventSchemaV4",
      "agent-session-event-v5": "AgentSessionEventSchemaV5",
      "agent-session-event-v6": "AgentSessionEventSchemaV6",
      "report-report-document-v1": "ReportDocumentSchemaV1",
      "skills-skill-bundle-manifest-v2": "SkillBundleManifestSchemaV2",
      "compatibility-agent-host-runtime-approval-v6-v2":
        "AgentHostRuntimeApprovalCompatibilityV6V2",
      "compatibility-agent-host-runtime-approval-v6-v3":
        "AgentHostRuntimeApprovalCompatibilityV6V3",
    }[outputName];
    schemaExports.push(
      `export * as ${namespace} from "./jsonschema/${outputName}.gen.js";`,
    );
  } else {
    schemaExports.push(`export * from "./jsonschema/${outputName}.gen.js";`);
  }
}

await writeFile(
  path.join(root, "sdks/typescript/src/index.ts"),
  [
    "/* Generated SDK entrypoint. Do not edit by hand. */",
    'export * as PublicApi from "./openapi/public.gen.js";',
    'export * as AdminApi from "./openapi/admin.gen.js";',
    'export * as InternalApi from "./openapi/internal.gen.js";',
    'export * as AgentHostApi from "./openapi/agent-host.gen.js";',
    'export * as CommonV1 from "./protobuf/yijie/common/v1/common_pb.js";',
    'export * as AgentSessionEventsV1 from "./protobuf/yijie/events/v1/agent_session_pb.js";',
    'export * as AgentSessionEventsV2 from "./protobuf/yijie/events/v2/agent_session_pb.js";',
    'export * as AgentSessionEventsV3 from "./protobuf/yijie/events/v3/agent_session_pb.js";',
    'export * as AgentSessionEventsV4 from "./protobuf/yijie/events/v4/agent_session_pb.js";',
    'export * as AgentSessionEventsV5 from "./protobuf/yijie/events/v5/agent_session_pb.js";',
    'export * as AgentSessionEventsV6 from "./protobuf/yijie/events/v6/agent_session_pb.js";',
    'export * as TaskEventsV1 from "./protobuf/yijie/events/v1/task_pb.js";',
    'export * as AgentHostV1 from "./protobuf/yijie/services/agent_host/v1/agent_host_pb.js";',
    ...schemaExports,
    "",
  ].join("\n"),
);

console.log(`Generated OpenAPI, Protobuf, and ${schemas.length} JSON Schema SDK sources.`);
