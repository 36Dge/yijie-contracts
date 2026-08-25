import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = "tests/fixtures/skills/bundle-v1";
const DEFAULT_CATALOG_OUTPUT = "tests/fixtures/skills/bundle-v2";
const DEFAULT_HOST_OUTPUT = "tests/fixtures/agent/host-skills-v1";
const DOS_DATE_1980_01_01 = 0x0021;
const UTF8_FLAG = 0x0800;

const CATALOG_GROUPS = [
  {
    category: "sourcing-selection",
    iconKey: "skillSourcing",
    skills: [
      ["aliexpress-supplier-evaluator", "AliExpress 供应商评估", ["browser.search", "supplier.data"]],
      ["dropshipping-supplier-integrator", "代发货供应商集成", ["supplier.data", "store.write"]],
      ["product-supplier-sourcing", "产品供应商寻源", ["browser.search", "supplier.data"]],
      ["sales-negotiator", "销售谈判专家", []],
      ["supplier-performance-manager", "供应商绩效管理", ["supplier.data"]],
    ],
  },
  {
    category: "market-research",
    iconKey: "skillResearch",
    skills: [
      ["alibaba-amazon-market-intel", "阿里巴巴与亚马逊市场洞察", ["marketplace.data"]],
      ["competitor-deep-analysis", "竞品深度分析", ["browser.search", "marketplace.data"]],
      ["cross-border-selection", "跨境选品", ["marketplace.data"]],
      ["jungle-scout-deep-dive-analyzer", "Jungle Scout 深度分析", ["jungle_scout.data"]],
      ["market-insight-product-selection", "市场洞察选品", ["marketplace.data"]],
      ["product-attribute-analyzer", "产品属性分析", []],
      ["product-selection", "产品选品", ["marketplace.data"]],
      ["review-analyst-agent", "评论分析助手", ["marketplace.reviews"]],
      ["scenario-driven-product-scout", "场景驱动选品", ["browser.search"]],
    ],
  },
  {
    category: "content-marketing",
    iconKey: "skillContent",
    skills: [
      ["content-breakdown", "内容拆解", []],
      ["content-strategy", "内容策略", []],
      ["copywriting", "文案创作", []],
      ["product-marketing-context", "产品营销上下文", []],
      ["social-media-content-creator", "社交媒体内容创作", ["social.publish"]],
      ["vibe-marketing", "氛围营销", []],
      ["xiaohongshu-content-creator", "小红书内容创作", ["xiaohongshu.publish"]],
    ],
  },
  {
    category: "traffic-advertising",
    iconKey: "skillTraffic",
    skills: [
      ["amazon-listing-expert", "亚马逊 Listing 专家", ["amazon.listing"]],
      ["amazon-ppc-campaign-manager", "亚马逊 PPC 广告管理", ["amazon.ads"]],
      ["amz-hot-keywords", "亚马逊热门关键词", ["amazon.keywords"]],
      ["amz-product-optimizer", "亚马逊产品优化", ["amazon.listing"]],
      ["ecommerce-seo-optimizer", "电商 SEO 优化", ["browser.search"]],
      ["etsy-seo-optimizer", "Etsy SEO 优化", ["etsy.listing"]],
      ["product-description-generator", "产品描述生成", []],
      ["seo-keyword-research", "SEO 关键词研究", ["browser.search"]],
      ["tiktok-ads-strategy", "TikTok 广告策略", ["tiktok.ads"]],
    ],
  },
  {
    category: "store-operations",
    iconKey: "skillOperations",
    skills: [
      ["amazon-brand-protection", "亚马逊品牌保护", ["amazon.brand"]],
      ["buy-now-pay-later-setup", "先买后付配置", ["payments.configure"]],
      ["ecommerce-gdpr-compliance", "电商 GDPR 合规", ["store.data"]],
      ["invoice-generator", "发票生成", ["store.orders"]],
      ["multichannel-inventory-sync", "多渠道库存同步", ["inventory.read", "inventory.write"]],
      ["payment-fraud-detector", "支付欺诈检测", ["payments.risk"]],
      ["tiktok-shop-setup", "TikTok Shop 配置", ["tiktok.shop"]],
      ["warehouse-fulfillment-workflow", "仓储履约工作流", ["warehouse.fulfillment"]],
    ],
  },
];

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

function skillEntry({
  archiveName,
  archive,
  entries,
  archiveSha256 = sha256(archive),
  id = "yijie.fixture.model-only",
  runtimeName = "yijie-fixture-model-only",
  category = "content-marketing",
  order = 0,
  displayName = "合成模型技能",
  description = "仅用于验证 Desktop 本地 Skill Bundle 契约与归档安全边界。",
  iconKey = "edit",
}) {
  return {
    id,
    runtime_name: runtimeName,
    category,
    order,
    display_name: displayName,
    description,
    version: "0.1.0",
    entrypoint: "SKILL.md",
    icon: { registry: "yj-icon-v1", key: iconKey },
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

function manifest(skills, bundleVersion = "0.1.0", schemaVersion = 1) {
  return {
    schema_version: schemaVersion,
    bundle_id: "yijie.desktop.skill-packages",
    bundle_version: bundleVersion,
    distribution_channel: "desktop-release",
    source: {
      repository: "https://github.com/36Dge/yijie-contracts.git",
      revision_kind: "git-commit",
      revision: "1111111111111111111111111111111111111111",
      tree_sha256:
        schemaVersion === 1
          ? skills[0].provenance.source_sha256
          : sha256(Buffer.from(JSON.stringify(skills))),
    },
    skills,
  };
}

function blockedCatalogEntry({ category, iconKey, slug, displayName, requiredTools, order }) {
  const toolAssisted = requiredTools.length > 0;
  const sourceIdentity = Buffer.from(`synthetic-catalog-only:${category}:${slug}`, "utf8");
  return {
    id: `yijie.${category}.${slug}`,
    runtime_name: slug,
    category,
    order,
    display_name: displayName,
    description: `合成目录 fixture：${displayName}；不包含观测源码或操作指令。`,
    version: "0.0.0",
    catalog_entry_mode: "catalog-only",
    icon: { registry: "yj-icon-v1", key: iconKey },
    risk: {
      level: toolAssisted ? "medium" : "low",
      reasons: [
        toolAssisted
          ? "合成目录条目声明外部能力依赖，未连接或调用任何真实服务。"
          : "合成目录条目不包含源码、归档或可执行指令。",
      ],
    },
    provenance: {
      source_type: "third-party",
      source_reference: `tests/fixtures/skills/catalog-v1/${slug}/SOURCE.txt`,
      source_version: "0.0.0",
      source_sha256: sha256(sourceIdentity),
      review_status: "blocked",
      reviewed_by: "FEAT-129 synthetic catalog owner",
      reviewed_at: "2026-08-25T00:00:00Z",
    },
    license: {
      expression: "NOASSERTION",
      redistribution_status: "blocked",
      authorization_scope: "none",
      evidence_reference: `tests/fixtures/skills/catalog-v1/${slug}/LICENSE-REVIEW.txt`,
      reviewed_by: "FEAT-129 synthetic catalog owner",
      reviewed_at: "2026-08-25T00:00:00Z",
    },
    capabilities: {
      execution_mode: toolAssisted ? "tool-assisted" : "model-only",
      network: toolAssisted ? "required" : "none",
      filesystem: "none",
      required_tools: requiredTools,
    },
    release: {
      catalog_status: "blocked",
      maintenance_status: "maintained",
      blocked_reason: "license_unverified",
    },
  };
}

function catalogManifest(copywritingArchive, copywritingEntries) {
  const skills = CATALOG_GROUPS.flatMap(({ category, iconKey, skills: definitions }) =>
    definitions.map(([slug, displayName, requiredTools], order) => {
      if (slug !== "copywriting") {
        return blockedCatalogEntry({ category, iconKey, slug, displayName, requiredTools, order });
      }
      return {
        ...skillEntry({
          archiveName: "fixture-copywriting-0.1.0.zip",
          archive: copywritingArchive,
          entries: copywritingEntries,
          id: "yijie.content-marketing.copywriting",
          runtimeName: "copywriting",
          category,
          order,
          displayName,
          description: "合成可安装文案 Skill，用于固定 38 项目录中的正常安装投影。",
          iconKey: "edit",
        }),
        catalog_entry_mode: "bundled",
      };
    }),
  );
  return manifest(skills, "0.5.1", 2);
}

function hostCatalogProjection(manifestBytes, value) {
  return {
    schema_version: 1,
    catalog_revision: sha256(manifestBytes),
    scanned_at: "2026-08-25T00:00:00Z",
    skills: value.skills.map((skill) => ({
      id: skill.id,
      runtime_name: skill.runtime_name,
      version: skill.version,
      catalog_status: skill.release.catalog_status,
      ...(skill.release.blocked_reason
        ? { catalog_blocked_reason: skill.release.blocked_reason }
        : {}),
      maintenance_status: skill.release.maintenance_status,
      capability_readiness:
        skill.capabilities.required_tools.length === 0 ? "ready" : "blocked",
      installation_status: "not_installed",
      enabled: false,
      runtime_visible: false,
      failure_code: "",
    })),
  };
}

async function writeJson(file, value) {
  await writeFile(file, jsonBytes(value));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function generateFixtures(
  outputDirectory = DEFAULT_OUTPUT,
  hostOutputDirectory = null,
  catalogOutputDirectory = null,
) {
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
  const copywritingEntries = [
    {
      name: "SKILL.md",
      content: Buffer.from(
        "---\nname: copywriting\ndescription: Synthetic catalog contract fixture.\n---\n\n# Synthetic copywriting fixture\n\nReturn one short product sentence from supplied facts.\n",
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
  const copywritingArchive = createStoredZip(copywritingEntries);
  const fullCatalog = catalogManifest(copywritingArchive, copywritingEntries);
  const fullCatalogBytes = jsonBytes(fullCatalog);
  const projectedCatalog = hostCatalogProjection(fullCatalogBytes, fullCatalog);
  const copywriting = fullCatalog.skills.find(
    ({ id }) => id === "yijie.content-marketing.copywriting",
  );
  if (!copywriting?.archive) throw new Error("synthetic copywriting archive is missing");
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
      manifest([
        skillEntry({
          archiveName: "fixture-model-only-0.1.0.zip",
          archive: validArchive,
          entries: safeEntries,
        }),
      ]),
    ),
    writeJson(
      path.join(outputDirectory, "manifest-checksum-mismatch.json"),
      manifest([
        skillEntry({
          archiveName: "fixture-model-only-checksum-mismatch.zip",
          archive: checksumMismatchArchive,
          archiveSha256: sha256(validArchive),
          entries: safeEntries,
        }),
      ]),
    ),
    writeJson(
      path.join(outputDirectory, "manifest-zip-slip.json"),
      manifest([
        skillEntry({
          archiveName: "fixture-zip-slip.zip",
          archive: zipSlipArchive,
          entries: zipSlipEntries,
        }),
      ]),
    ),
  ]);

  if (catalogOutputDirectory !== null) {
    const catalogPackagesDirectory = path.join(catalogOutputDirectory, "packages");
    await mkdir(catalogPackagesDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        path.join(catalogPackagesDirectory, "fixture-copywriting-0.1.0.zip"),
        copywritingArchive,
      ),
      writeFile(path.join(catalogOutputDirectory, "manifest-catalog-38.json"), fullCatalogBytes),
    ]);
  }

  if (hostOutputDirectory !== null) {
    await mkdir(hostOutputDirectory, { recursive: true });
    await Promise.all([
      writeJson(path.join(hostOutputDirectory, "list-response.json"), projectedCatalog),
      writeJson(path.join(hostOutputDirectory, "install-request.json"), {
        operation_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f71",
        expected_version: copywriting.version,
        expected_archive_sha256: copywriting.archive.sha256,
        catalog_revision: projectedCatalog.catalog_revision,
      }),
      writeJson(path.join(hostOutputDirectory, "mutation-response.json"), {
        operation_id: "019fbd88-cbc3-7bf1-934d-7b05cd693f71",
        outcome: "complete",
        skill: {
          id: copywriting.id,
          runtime_name: copywriting.runtime_name,
          version: copywriting.version,
          catalog_status: copywriting.release.catalog_status,
          maintenance_status: copywriting.release.maintenance_status,
          capability_readiness: "ready",
          installation_status: "installed",
          enabled: true,
          runtime_visible: true,
          failure_code: "",
        },
      }),
      writeJson(path.join(hostOutputDirectory, "error-skill-not-installable.json"), {
        error: {
          code: "skill_not_installable",
          message: "The catalog-only Skill has no installable archive.",
        },
      }),
    ]);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT;
  const hostOutputIndex = process.argv.indexOf("--host-output");
  const hostOutputDirectory =
    hostOutputIndex >= 0 ? process.argv[hostOutputIndex + 1] : DEFAULT_HOST_OUTPUT;
  const catalogOutputIndex = process.argv.indexOf("--catalog-output");
  const catalogOutputDirectory =
    catalogOutputIndex >= 0 ? process.argv[catalogOutputIndex + 1] : DEFAULT_CATALOG_OUTPUT;
  if (!outputDirectory) throw new Error("--output requires a directory");
  if (!hostOutputDirectory) throw new Error("--host-output requires a directory");
  if (!catalogOutputDirectory) throw new Error("--catalog-output requires a directory");
  await generateFixtures(outputDirectory, hostOutputDirectory, catalogOutputDirectory);
  console.log(
    `Generated deterministic Skill bundle fixtures in ${outputDirectory}, Catalog First fixtures in ${catalogOutputDirectory}, and Host projection fixtures in ${hostOutputDirectory}.`,
  );
}
