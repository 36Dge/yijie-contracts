import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { generateFixtures } from "../scripts/generate-skill-bundle-fixtures.mjs";

const fixtureRoot = "tests/fixtures/skills/bundle-v1";
const schemaPath = "jsonschema/skills/skill-bundle-manifest-v1.schema.json";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readManifest(name) {
  return JSON.parse(await readFile(path.join(fixtureRoot, name), "utf8"));
}

function readLocalEntries(archive) {
  const entries = [];
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const flags = archive.readUInt16LE(offset + 6);
    const method = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const uncompressedSize = archive.readUInt32LE(offset + 22);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    assert.equal(flags & 0x0008, 0, "fixture must not use a data descriptor");
    assert.equal(method, 0, "fixture must use deterministic stored entries");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    assert.ok(dataEnd <= archive.length, "entry exceeds archive boundary");
    entries.push({
      name: archive.subarray(nameStart, nameStart + nameLength).toString("utf8"),
      compressedSize,
      uncompressedSize,
    });
    offset = dataEnd;
  }
  assert.ok(entries.length > 0, "archive has no local entries");
  return entries;
}

function isSafeEntry(name) {
  if (name.length === 0 || name.startsWith("/") || name.includes("\\") || name.includes("\0")) {
    return false;
  }
  const segments = name.split("/");
  return !segments.some((segment) => segment === "" || segment === "." || segment === "..");
}

async function collectRelativeFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await collectRelativeFiles(directory, child)));
    else files.push(child);
  }
  return files.sort();
}

test("Skill bundle v1 manifests are closed and release eligibility fails closed", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = await readManifest("manifest-valid.json");
  const checksumMismatch = await readManifest("manifest-checksum-mismatch.json");
  const zipSlip = await readManifest("manifest-zip-slip.json");

  for (const [name, fixture] of [
    ["valid", valid],
    ["checksum", checksumMismatch],
    ["zip-slip", zipSlip],
  ]) {
    assert.equal(validate(fixture), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }

  const unverified = structuredClone(valid);
  unverified.skills[0].license.redistribution_status = "unverified";
  assert.equal(validate(unverified), false, "installable entry cannot have unverified redistribution");
  unverified.skills[0].release.catalog_status = "blocked";
  assert.equal(validate(unverified), true, JSON.stringify(validate.errors));

  const toolDrift = structuredClone(valid);
  toolDrift.skills[0].capabilities.required_tools = ["browser.open"];
  assert.equal(validate(toolDrift), false, "model-only entry cannot silently acquire a tool");
  const exactDuplicate = structuredClone(valid);
  exactDuplicate.skills.push(structuredClone(exactDuplicate.skills[0]));
  assert.equal(validate(exactDuplicate), false, "manifest cannot repeat the same Skill entry");
  assert.equal(validate({ ...valid, extra: true }), false, "manifest must reject unknown fields");
});

test("valid, checksum-mismatch, and Zip Slip archives exercise distinct semantic outcomes", async () => {
  const cases = [
    ["manifest-valid.json", true, true],
    ["manifest-checksum-mismatch.json", false, true],
    ["manifest-zip-slip.json", true, false],
  ];

  for (const [manifestName, digestExpected, safetyExpected] of cases) {
    const manifest = await readManifest(manifestName);
    const skill = manifest.skills[0];
    const archive = await readFile(path.join(fixtureRoot, skill.archive.path));
    const entries = readLocalEntries(archive);
    assert.equal(sha256(archive) === skill.archive.sha256, digestExpected, manifestName);
    assert.equal(entries.every(({ name }) => isSafeEntry(name)), safetyExpected, manifestName);
    assert.equal(entries.length, skill.archive.file_count, manifestName);
    assert.equal(
      entries.reduce((total, entry) => total + entry.uncompressedSize, 0),
      skill.archive.uncompressed_size_bytes,
      manifestName,
    );
  }

  const valid = await readManifest("manifest-valid.json");
  const validArchive = await readFile(path.join(fixtureRoot, valid.skills[0].archive.path));
  assert.ok(readLocalEntries(validArchive).some(({ name }) => name === valid.skills[0].entrypoint));
});

test("checked Skill bundle fixtures are reproducible byte-for-byte", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "yijie-skill-contract-fixtures-"));
  try {
    await generateFixtures(temporaryRoot);
    const expectedFiles = await collectRelativeFiles(fixtureRoot);
    const actualFiles = await collectRelativeFiles(temporaryRoot);
    assert.deepEqual(actualFiles, expectedFiles);
    for (const relative of expectedFiles) {
      assert.deepEqual(
        await readFile(path.join(temporaryRoot, relative)),
        await readFile(path.join(fixtureRoot, relative)),
        relative,
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
