// Read-only source projection for oasdiff. Never fetch a schema URI or borrow
// a working-tree dependency for a historical baseline.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

export const openApiChecks = [
  'openapi/public/public.yaml', 'openapi/admin/admin.yaml',
  'openapi/internal/internal.yaml', 'openapi/agent-host/agent-host.yaml',
  'openapi/native-turn-timing/native-turn-timing.yaml',
  'openapi/native-conversation/native-conversation.yaml',
  'openapi/runtime-permissions/runtime-permissions.yaml',
  'openapi/native-conversation-v2/native-conversation-v2.yaml',
  'openapi/runtime-permissions-v2/runtime-permissions-v2.yaml',
  'openapi/workflow-local/workflow-local.yaml',
  'openapi/scheduled-plan-draft/scheduled-plan-draft.yaml',
];
const roots = ['openapi', 'jsonschema'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const literalKeys = new Set(['example', 'examples', 'default', 'const', 'enum']);
const dictionaryKeys = new Set(['properties', 'patternProperties', '$defs', 'definitions',
  'dependentSchemas', 'schemas', 'responses', 'paths', 'headers', 'content', 'callbacks',
  'securitySchemes', 'links', 'requestBodies']);
const pointerKey = key => key.replaceAll('~', '~0').replaceAll('/', '~1');

// Both adapters are read-only. No checkout, index, refs, commits or archives.
export function sourceSnapshot(root, revision = null) {
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const files = (revision
    ? git(['ls-tree', '-r', '-z', '--name-only', revision, '--', ...roots])
    : git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots]))
    .toString().split('\0').filter(file => /\.(json|ya?ml)$/.test(file));
  return new Map([...new Set(files)].map(file => [file,
    revision ? git(['show', `${revision}:${file}`]) : readFileSync(path.join(root, file)),
  ]));
}

function pointerTarget(document, fragment, context) {
  const pointer = decodeURIComponent(fragment);
  assert.ok(pointer === '' || pointer.startsWith('/'), `Unsupported schema anchor: ${context}`);
  let value = document;
  for (const segment of pointer ? pointer.slice(1).split('/') : []) {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    assert.ok(value !== null && typeof value === 'object' && Object.hasOwn(value, key),
      `Unresolved schema pointer: ${context}`);
    value = value[key];
  }
}

export function projectSnapshot(files, outputRoot, entrypoints) {
  assert.ok(path.isAbsolute(outputRoot), 'Absolute temporary output required');
  const parsed = new Map([...files].map(([file, bytes]) => [file, YAML.parse(bytes.toString())]));
  const ids = new Map();
  for (const [file, document] of parsed) {
    if (typeof document?.$id !== 'string') continue;
    assert.ok(!ids.has(document.$id), `Ambiguous schema ID: ${document.$id}`);
    ids.set(document.$id, file);
  }
  const visited = new Set(), receipts = [], rewrites = [];
  function resolveRef(origin, ref) {
    const separator = ref.indexOf('#');
    const location = separator < 0 ? ref : ref.slice(0, separator);
    const fragment = separator < 0 ? '' : ref.slice(separator + 1);
    let target;
    if (!location) target = origin;
    else if (ids.has(location)) target = ids.get(location);
    else {
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(location) && !location.startsWith('/') && !location.includes('?'),
        `No local schema authority for ${ref} in ${origin}`);
      target = path.posix.normalize(path.posix.join(path.posix.dirname(origin), location));
    }
    assert.ok(parsed.has(target), `Missing source-local schema ${target} referenced by ${origin}`);
    pointerTarget(parsed.get(target), fragment, `${origin} -> ${ref}`);
    return { target, fragment };
  }
  function visit(file) {
    if (visited.has(file)) return;
    assert.ok(parsed.has(file), `Missing OpenAPI source: ${file}`);
    visited.add(file); // Cyclic local references stay references, never inlined.
    function walk(value, pointer = '', dictionary = false) {
      if (Array.isArray(value)) return value.map((item, i) => walk(item, `${pointer}/${i}`));
      if (!value || typeof value !== 'object') return value;
      // The checked source subset uses root IDs and JSON pointers. Fail rather
      // than silently interpreting a future nested resource or dynamic anchor.
      assert.ok(dictionary || !pointer || typeof value.$id !== 'string', `Nested schema ID requires explicit support: ${file}${pointer}`);
      assert.ok(dictionary || value.$dynamicRef === undefined, `Dynamic schema reference requires explicit support: ${file}${pointer}`);
      assert.ok(dictionary || value.$recursiveRef === undefined, `Recursive schema reference requires explicit support: ${file}${pointer}`);
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        const at = `${pointer}/${pointerKey(key)}`;
        if (!dictionary && key === '$ref' && typeof child === 'string') {
          const { target, fragment } = resolveRef(file, child);
          visit(target);
          // Keep logical ref identities identical on the two sides. Absolute
          // temp paths cause false oneOf add/remove reports in oasdiff.
          const location = target === file ? '' : path.posix.relative(path.posix.dirname(file), target);
          const localized = `${location}${fragment ? '#' + fragment : location ? '' : '#'}`;
          rewrites.push({ document: file, pointer: at, from: child, target, fragment, to: localized });
          return [key, localized];
        }
        return [key, !dictionary && literalKeys.has(key) ? child : walk(child, at, !dictionary && dictionaryKeys.has(key))];
      }));
    }
    const projected = walk(parsed.get(file));
    // Prove every non-reference value is unchanged, including OAS 3.1 keywords
    // not recognized by the comparator. Only the recorded ref strings differ.
    const restored = structuredClone(projected);
    for (const change of rewrites.filter(r => r.document === file)) {
      const parts = change.pointer.slice(1).split('/').map(s => s.replaceAll('~1', '/').replaceAll('~0', '~'));
      const key = parts.pop();
      const parent = parts.reduce((v, part) => v[part], restored);
      parent[key] = change.from;
    }
    assert.deepEqual(restored, parsed.get(file), `Projection changed schema meaning: ${file}`);
    const bytes = JSON.stringify(projected, null, 2) + '\n';
    const destination = path.join(outputRoot, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes, { flag: 'wx' });
    receipts.push({ path: file, source_sha256: hash(files.get(file)), projected_sha256: hash(bytes) });
  }
  for (const file of entrypoints) visit(file);
  return { files: receipts.sort((a, b) => a.path.localeCompare(b.path)), references: rewrites };
}

function main() {
  const [base, outputRoot, ...extra] = process.argv.slice(2);
  assert.ok(base && outputRoot && !extra.length, 'Usage: prepare-breaking-inputs.mjs FULL_COMMIT NEW_OUTPUT_ROOT');
  assert.match(base, /^[0-9a-f]{40}$/);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const previous = sourceSnapshot(root, base), current = sourceSnapshot(root);
  const specs = openApiChecks.filter(file => previous.has(file));
  assert.ok(specs.length > 0, 'Baseline has no checked OpenAPI sources');
  const receipt = {
    schema_version: 1, base_commit: base, network_resolution: false,
    projection: 'reference-location-only; non-reference values verified identical',
    specs,
    base: projectSnapshot(previous, path.join(outputRoot, 'base'), specs),
    current: projectSnapshot(current, path.join(outputRoot, 'current'), specs),
  };
  writeFileSync(path.join(outputRoot, 'projection.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(path.join(outputRoot, 'specs.txt'), specs.join('\n') + '\n', { flag: 'wx' });
  console.log(`Prepared ${specs.length} source-local OpenAPI comparisons; ${receipt.base.files.length}/${receipt.current.files.length} old/current sources; no URI fetch.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
