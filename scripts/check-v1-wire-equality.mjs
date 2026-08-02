import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

const baseRef = process.argv[2] ?? "f16a497e1377f45747f8ff9292b4b60cf2027f88";

const surfaces = [
  {
    file: "openapi/public/public.yaml",
    paths: ["/v1/tasks", "/v1/tasks/{task_id}"],
  },
  {
    file: "openapi/agent-host/agent-host.yaml",
    paths: [
      "/v1/status",
      "/v1/tasks/{task_id}/agent-sessions",
      "/v1/agent-sessions/{agent_session_id}/resume",
      "/v1/agent-sessions/{agent_session_id}",
      "/v1/agent-sessions/{agent_session_id}/turns",
      "/v1/agent-sessions/{agent_session_id}/turns/{turn_id}/interrupt",
      "/v1/agent-sessions/{agent_session_id}/events",
    ],
  },
];

function readBaseline(file) {
  return parseYaml(execFileSync("git", ["show", `${baseRef}:${file}`], { encoding: "utf8" }));
}

function decodePointerToken(token) {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveLocalReference(spec, reference) {
  assert.ok(reference.startsWith("#/"), `external reference is outside equality scope: ${reference}`);
  return reference
    .slice(2)
    .split("/")
    .map(decodePointerToken)
    .reduce((value, token) => {
      assert.notEqual(value, undefined, `missing local reference ${reference}`);
      return value[token];
    }, spec);
}

function collectReferenceClosure(spec, value, references = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferenceClosure(spec, item, references));
    return references;
  }
  if (value === null || typeof value !== "object") return references;

  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    if (!references.has(value.$ref)) {
      const resolved = resolveLocalReference(spec, value.$ref);
      references.set(value.$ref, resolved);
      collectReferenceClosure(spec, resolved, references);
    }
  }

  Object.values(value).forEach((item) => collectReferenceClosure(spec, item, references));
  return references;
}

function extractWire(spec, paths) {
  const selectedPaths = Object.fromEntries(
    paths.map((path) => {
      assert.ok(spec.paths?.[path], `missing legacy path ${path}`);
      return [path, spec.paths[path]];
    }),
  );
  const references = collectReferenceClosure(spec, selectedPaths);

  return {
    security: spec.security ?? null,
    servers: spec.servers ?? null,
    paths: selectedPaths,
    references: Object.fromEntries([...references.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

for (const surface of surfaces) {
  const baseline = readBaseline(surface.file);
  const current = parseYaml(readFileSync(surface.file, "utf8"));
  assert.deepEqual(
    extractWire(current, surface.paths),
    extractWire(baseline, surface.paths),
    `${surface.file} legacy v1 wire differs from ${baseRef}`,
  );
  console.log(`${surface.file}: ${surface.paths.length} legacy v1 paths and reference closure are equal`);
}

console.log(`Legacy v1 wire equality PASS against ${baseRef}.`);
