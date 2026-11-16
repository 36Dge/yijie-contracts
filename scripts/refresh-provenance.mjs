// Canonical generators may refresh source identity without rewriting code or schemas.
// Validate every output before the first write; an ordinary source change remains
// a generation/build task, never a reason to bless an old Runtime artifact.
import assert from "node:assert/strict";
import { lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

export function provenanceOnly(before, after, fields) {
  const comparable = structuredClone(before);
  for (const field of fields) {
    let old = comparable, next = after, present = true;
    for (const key of field.slice(0, -1)) {
      if (!old || !next || !Object.hasOwn(old, key) || !Object.hasOwn(next, key)) { present = false; break; }
      old = old[key]; next = next[key];
    }
    const key = field.at(-1);
    if (present && old && next && Object.hasOwn(old, key) && Object.hasOwn(next, key)) old[key] = next[key];
  }
  return isDeepStrictEqual(comparable, after);
}

export function refreshProvenance(outputs, fields = [["runtime_source", "base_commit"]]) {
  const changes = [];
  for (const [target, value] of outputs) {
    assert(lstatSync(target).isFile(), `Generated output must be a regular file: ${target}`);
    const before = readFileSync(target), after = Buffer.from(value);
    if (before.equals(after)) continue;
    let compatible = false;
    try { compatible = provenanceOnly(JSON.parse(before), JSON.parse(after), fields); } catch { /* Code/schema drift. */ }
    assert(compatible, `Source or generated content changed; prepare it with its canonical generator before startup: ${target}`);
    changes.push({ target, before, after });
  }
  // A concurrent edit must not be overwritten by a provenance refresh.
  for (const change of changes) assert(readFileSync(change.target).equals(change.before), `Source changed during preflight: ${change.target}`);
  for (const { target, before, after } of changes) {
    assert(readFileSync(target).equals(before), `Source changed during preflight: ${target}`);
    const temporary = `${target}.provenance-${process.pid}.tmp`;
    writeFileSync(temporary, after, { flag: "wx", mode: lstatSync(target).mode & 0o777 });
    try { renameSync(temporary, target); } finally {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  console.log(`Startup provenance verified; refreshed ${changes.length} source records.`);
  return changes.map(change => change.target);
}
