import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { provenanceOnly, refreshProvenance } from "../scripts/refresh-provenance.mjs";

const old = { runtime_source: { base_commit: "a".repeat(40), sources: { "module.rs": "1".repeat(64) } }, release: false };
const next = { ...old, runtime_source: { ...old.runtime_source, base_commit: "b".repeat(40) } };

test("a newer commit with exactly the same sources is a provenance-only update", () => {
  assert(provenanceOnly(old, next, [["runtime_source", "base_commit"]]));
  assert(!provenanceOnly(old, { ...next, release: true }, [["runtime_source", "base_commit"]]));
  assert(!provenanceOnly(old, { ...next, runtime_source: { ...next.runtime_source, sources: { "module.rs": "2".repeat(64) } } }, [["runtime_source", "base_commit"]]));
});

test("a missing nested field does not authorize a similarly named root field", () => {
  assert(!provenanceOnly({ base_commit: "old" }, { base_commit: "new" }, [["runtime_source", "base_commit"]]));
});

test("an ordinary schema edit prevents all provenance writes in that generation", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yijie-provenance-"));
  try {
    const lock = path.join(dir, "source.json"), schema = path.join(dir, "schema.json");
    writeFileSync(lock, JSON.stringify(old));
    writeFileSync(schema, JSON.stringify({ description: "current" }));
    assert.throws(() => refreshProvenance([[lock, JSON.stringify(next)], [schema, JSON.stringify({ description: "new wording" })]]), /Source or generated content changed/u);
    assert.deepEqual(JSON.parse(readFileSync(lock)), old);
    assert.deepEqual(JSON.parse(readFileSync(schema)), { description: "current" });
    assert.deepEqual(refreshProvenance([[lock, JSON.stringify(next)], [schema, readFileSync(schema)]]), [lock]);
    assert.deepEqual(refreshProvenance([[lock, JSON.stringify(next)]]), []);
  } finally { rmSync(dir, { recursive: true }); }
});

test("dependent provenance updates retain generated definitions and other source hashes", () => {
  const before = { sources: { "compatibility/runtime-interaction-tools/source.lock.json": "old", "api.yaml": "stable" }, generated: { "types.rs": "stable" } };
  const after = { ...before, sources: { ...before.sources, "compatibility/runtime-interaction-tools/source.lock.json": "new" } };
  const fields = [["sources", "compatibility/runtime-interaction-tools/source.lock.json"]];
  assert(provenanceOnly(before, after, fields));
  assert(!provenanceOnly(before, { ...after, generated: { "types.rs": "different" } }, fields));
});
