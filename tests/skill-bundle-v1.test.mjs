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
const catalogFixtureRoot = "tests/fixtures/skills/bundle-v2";
const schemaPath = "jsonschema/skills/skill-bundle-manifest-v1.schema.json";
const catalogSchemaPath = "jsonschema/skills/skill-bundle-manifest-v2.schema.json";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readManifest(name) {
  return JSON.parse(await readFile(path.join(fixtureRoot, name), "utf8"));
}

async function readCatalogManifest(name) {
  return JSON.parse(await readFile(path.join(catalogFixtureRoot, name), "utf8"));
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

test("38-Skill catalog fixture is complete, deterministic, and keeps blocked entries metadata-only", async () => {
  const schema = JSON.parse(await readFile(catalogSchemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const catalog = await readCatalogManifest("manifest-catalog-38.json");
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
  assert.equal(catalog.schema_version, 2);
  assert.equal(catalog.bundle_version, "0.5.1");
  assert.equal(catalog.skills.length, 38);

  const counts = Object.fromEntries(
    [
      "sourcing-selection",
      "market-research",
      "content-marketing",
      "traffic-advertising",
      "store-operations",
    ].map((category) => [
      category,
      catalog.skills.filter((skill) => skill.category === category).length,
    ]),
  );
  assert.deepEqual(counts, {
    "sourcing-selection": 5,
    "market-research": 9,
    "content-marketing": 7,
    "traffic-advertising": 9,
    "store-operations": 8,
  });
  assert.equal(new Set(catalog.skills.map(({ id }) => id)).size, 38);
  assert.equal(new Set(catalog.skills.map(({ runtime_name }) => runtime_name)).size, 38);

  const installable = catalog.skills.filter(
    ({ release }) => release.catalog_status === "installable",
  );
  const blocked = catalog.skills.filter(({ release }) => release.catalog_status === "blocked");
  assert.equal(installable.length, 1);
  assert.equal(blocked.length, 37);
  assert.equal(installable[0].id, "yijie.content-marketing.copywriting");
  assert.equal(installable[0].catalog_entry_mode, "bundled");
  assert.equal(installable[0].entrypoint, "SKILL.md");
  assert.ok(installable[0].archive.sha256);
  assert.equal(installable[0].provenance.review_status, "verified");
  assert.equal(installable[0].license.redistribution_status, "verified");
  assert.equal(installable[0].license.authorization_scope, "desktop-distribution");

  for (const skill of blocked) {
    assert.equal(skill.catalog_entry_mode, "catalog-only", skill.id);
    assert.equal(skill.entrypoint, undefined, skill.id);
    assert.equal(skill.archive, undefined, skill.id);
    assert.equal(skill.release.blocked_reason, "license_unverified", skill.id);
    assert.equal(skill.license.authorization_scope, "none", skill.id);
    assert.notEqual(skill.license.redistribution_status, "verified", skill.id);
    assert.ok(skill.provenance.source_reference, skill.id);
    assert.ok(skill.risk.reasons.length > 0, skill.id);
    assert.ok(skill.icon.key, skill.id);
    assert.ok(Array.isArray(skill.capabilities.required_tools), skill.id);
  }

  const missingReason = structuredClone(catalog);
  delete missingReason.skills.find(({ release }) => release.catalog_status === "blocked").release
    .blocked_reason;
  assert.equal(validate(missingReason), false, "catalog-only blocked entry requires a reason");

  const smuggledArchive = structuredClone(catalog);
  const blockedWithArchive = smuggledArchive.skills.find(
    ({ release }) => release.catalog_status === "blocked",
  );
  blockedWithArchive.entrypoint = "SKILL.md";
  blockedWithArchive.archive = structuredClone(installable[0].archive);
  assert.equal(validate(smuggledArchive), false, "catalog-only entry cannot carry an archive");

  const promotedWithoutArchive = structuredClone(catalog);
  const promoted = promotedWithoutArchive.skills.find(
    ({ release }) => release.catalog_status === "blocked",
  );
  promoted.catalog_entry_mode = "bundled";
  promoted.release.catalog_status = "installable";
  delete promoted.release.blocked_reason;
  promoted.provenance.review_status = "verified";
  promoted.license.redistribution_status = "verified";
  promoted.license.authorization_scope = "desktop-distribution";
  assert.equal(validate(promotedWithoutArchive), false, "installable entry requires an archive");
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
    const temporaryV1Root = path.join(temporaryRoot, "bundle-v1");
    const temporaryV2Root = path.join(temporaryRoot, "bundle-v2");
    const temporaryHostRoot = path.join(temporaryRoot, "host-skills-v1");
    await generateFixtures(temporaryV1Root, temporaryHostRoot, temporaryV2Root);
    for (const [expectedRoot, actualRoot] of [
      [fixtureRoot, temporaryV1Root],
      [catalogFixtureRoot, temporaryV2Root],
    ]) {
      const expectedFiles = await collectRelativeFiles(expectedRoot);
      const actualFiles = await collectRelativeFiles(actualRoot);
      assert.deepEqual(actualFiles, expectedFiles);
      for (const relative of expectedFiles) {
        assert.deepEqual(
          await readFile(path.join(actualRoot, relative)),
          await readFile(path.join(expectedRoot, relative)),
          `${expectedRoot}/${relative}`,
        );
      }
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
