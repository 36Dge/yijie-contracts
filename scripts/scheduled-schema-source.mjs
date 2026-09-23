import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  draft: ['plan-draft-v1.schema.json', 'https://schemas.yijie.ai/scheduled-tasks/plan-draft/v1'],
  plan: ['plan-storage-v1.schema.json', 'https://schemas.yijie.ai/scheduled-tasks/storage/v1'],
  execution: ['execution-v1.schema.json', 'https://schemas.yijie.ai/scheduled-tasks/execution/v1'],
};

export function registerScheduledAnnotations(ajv) {
  ajv.addKeyword({
    keyword: 'x-family-version',
    schemaType: 'string',
    metaSchema: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
  });
}

export function loadScheduledSources(names = Object.keys(sources)) {
  return new Map(names.map(name => {
    assert.ok(Object.hasOwn(sources, name), 'Unknown scheduled source');
    const [file, id] = sources[name];
    const document = JSON.parse(readFileSync(path.join(root, 'jsonschema/scheduled-tasks', file)));
    assert.equal(document.$id, id, 'Canonical scheduled source ID changed');
    return [id, document];
  }));
}

// Resolve only the explicitly supplied in-repository source registry. No remote
// loading or source-name aliases: the canonical IDs must agree with JSON Schema.
export function projectScheduledSource(id, documents) {
  assert.ok(documents.has(id), 'Unknown scheduled projection source');
  function visit(value, context, stack = new Set()) {
    if (Array.isArray(value)) return value.map(child => visit(child, context, stack));
    if (!value || typeof value !== 'object') return value;
    if (value.$ref) {
      const reference = new URL(value.$ref, context);
      const fragment = reference.hash;
      reference.hash = '';
      const documentId = reference.href;
      assert.ok(documents.has(documentId), 'Unregistered scheduled reference');
      assert.ok(fragment.startsWith('#/'), 'Expected a scheduled JSON Pointer');
      let target = documents.get(documentId);
      for (const token of decodeURIComponent(fragment.slice(2)).split('/')) {
        const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
        assert.ok(target && Object.hasOwn(target, key), 'Missing scheduled reference fragment');
        target = target[key];
      }
      // Preserve target-local named references for generated Rust/TS identities.
      if (documentId === id) return { ...value, $ref: fragment };
      assert.deepEqual(Object.keys(value), ['$ref'], 'External reference siblings need explicit projection semantics');
      const key = documentId + fragment;
      assert.ok(!stack.has(key), 'Cyclic scheduled reference');
      const nested = new Set(stack); nested.add(key);
      // A fragment copied from draft keeps the draft root as its reference base.
      return visit(target, documentId, nested);
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child, context, stack)]));
  }
  const projection = visit(documents.get(id), id);
  delete projection['x-family-version'];
  return projection;
}
