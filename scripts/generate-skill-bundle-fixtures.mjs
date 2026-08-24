import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = "tests/fixtures/skills/bundle-v1";
const DOS_DATE_1980_01_01 = 0x0021;
const UTF8_FLAG = 0x0800;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, content) {
  const nameBytes = Buffer.from(name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(DOS_DATE_1980_01_01, 12);
  header.writeUInt32LE(crc32(content), 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBytes, content]);
}

function centralHeader(name, content, offset) {
  const nameBytes = Buffer.from(name, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(DOS_DATE_1980_01_01, 14);
  header.writeUInt32LE(crc32(content), 16);
  header.writeUInt32LE(content.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0x81a40000, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBytes]);
}

function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

export function createStoredZip(entries) {
  const normalized = [...entries]
    .map(({ name, content }) => ({ name, content: Buffer.from(content) }))
    .sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of normalized) {
    const local = localHeader(entry.name, entry.content);
    localParts.push(local);
    centralParts.push(centralHeader(entry.name, entry.content, offset));
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    endOfCentralDirectory(normalized.length, central.length, offset),
  ]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function treeSha256(entries) {
  const digest = createHash("sha256");
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const name = Buffer.from(entry.name, "utf8");
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(name.length));
    digest.update(size);
    digest.update(name);
    digest.update(createHash("sha256").update(entry.content).digest());
  }
  return digest.digest("hex");
}

function skillEntry({ archiveName, archive, entries, archiveSha256 = sha256(archive) }) {
  return {
    id: "yijie.fixture.model-only",
    runtime_name: "yijie-fixture-model-only",
    category: "content-marketing",
    order: 0,
    display_name: "合成模型技能",
    description: "仅用于验证 Desktop 本地 Skill Bundle 契约与归档安全边界。",
    version: "0.1.0",
    entrypoint: "SKILL.md",
    icon: { registry: "yj-icon-v1", key: "edit" },
    risk: { level: "low", reasons: ["合成 fixture，不访问网络、文件系统或外部工具。"] },
    provenance: {
      source_type: "internal",
      source_reference: "tests/fixtures/skills/bundle-v1/source/model-only",
      source_version: "0.1.0",
      source_sha256: treeSha256(entries),
      review_status: "verified",
      reviewed_by: "FEAT-129 contract fixture owner",
      reviewed_at: "2026-08-25T00:00:00Z",
    },
    license: {
      expression: "CC0-1.0",
      redistribution_status: "verified",
      authorization_scope: "desktop-distribution",
      evidence_reference: "tests/fixtures/skills/bundle-v1/source/LICENSE",
      reviewed_by: "FEAT-129 contract fixture owner",
      reviewed_at: "2026-08-25T00:00:00Z",
    },
    capabilities: {
      execution_mode: "model-only",
      network: "none",
      filesystem: "none",
      required_tools: [],
    },
    archive: {
      path: `packages/${archiveName}`,
      sha256: archiveSha256,
      compressed_size_bytes: archive.length,
      uncompressed_size_bytes: entries.reduce((total, entry) => total + entry.content.length, 0),
      file_count: entries.length,
    },
    release: { catalog_status: "installable", maintenance_status: "maintained" },
  };
}

function manifest(skill) {
  return {
    schema_version: 1,
    bundle_id: "yijie.desktop.skill-packages",
    bundle_version: "0.1.0",
    distribution_channel: "desktop-release",
    source: {
      repository: "https://github.com/36Dge/yijie-contracts.git",
      revision_kind: "git-commit",
      revision: "1111111111111111111111111111111111111111",
      tree_sha256: skill.provenance.source_sha256,
    },
    skills: [skill],
  };
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function generateFixtures(outputDirectory = DEFAULT_OUTPUT) {
  const safeEntries = [
    {
      name: "SKILL.md",
      content: Buffer.from(
        "---\nname: yijie-fixture-model-only\ndescription: Synthetic contract fixture.\n---\n\n# Synthetic fixture\n\nReturn the supplied text unchanged.\n",
      ),
    },
    {
      name: "LICENSE",
      content: Buffer.from("CC0 1.0 Universal - synthetic test fixture only.\n"),
    },
  ];
  const zipSlipEntries = [{ name: "../escape.txt", content: Buffer.from("must not escape\n") }];
  const validArchive = createStoredZip(safeEntries);
  const checksumMismatchArchive = Buffer.concat([validArchive, Buffer.from([0])]);
  const zipSlipArchive = createStoredZip(zipSlipEntries);
  const packagesDirectory = path.join(outputDirectory, "packages");
  await mkdir(packagesDirectory, { recursive: true });

  await Promise.all([
    writeFile(path.join(packagesDirectory, "fixture-model-only-0.1.0.zip"), validArchive),
    writeFile(
      path.join(packagesDirectory, "fixture-model-only-checksum-mismatch.zip"),
      checksumMismatchArchive,
    ),
    writeFile(path.join(packagesDirectory, "fixture-zip-slip.zip"), zipSlipArchive),
  ]);

  await Promise.all([
    writeJson(
      path.join(outputDirectory, "manifest-valid.json"),
      manifest(
        skillEntry({
          archiveName: "fixture-model-only-0.1.0.zip",
          archive: validArchive,
          entries: safeEntries,
        }),
      ),
    ),
    writeJson(
      path.join(outputDirectory, "manifest-checksum-mismatch.json"),
      manifest(
        skillEntry({
          archiveName: "fixture-model-only-checksum-mismatch.zip",
          archive: checksumMismatchArchive,
          archiveSha256: sha256(validArchive),
          entries: safeEntries,
        }),
      ),
    ),
    writeJson(
      path.join(outputDirectory, "manifest-zip-slip.json"),
      manifest(
        skillEntry({
          archiveName: "fixture-zip-slip.zip",
          archive: zipSlipArchive,
          entries: zipSlipEntries,
        }),
      ),
    ),
  ]);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT;
  if (!outputDirectory) throw new Error("--output requires a directory");
  await generateFixtures(outputDirectory);
  console.log(`Generated deterministic Skill bundle fixtures in ${outputDirectory}.`);
}
