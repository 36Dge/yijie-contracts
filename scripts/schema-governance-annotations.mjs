// Existing source metadata, not payload-validation exceptions. Keep strict
// compilation and reject unknown keywords and incorrect annotation types.
export function registerGovernanceAnnotations(ajv) {
  ajv.addKeyword({keyword: 'x-feature', schemaType: 'string', metaSchema: {type: 'string', pattern: '^FEAT-[0-9]+$'}});
  // Existing media/document authorities are structured; skill-market-v2 uses
  // a nonempty textual authority statement. Both remain source-owned metadata.
  ajv.addKeyword({keyword: 'x-authority', schemaType: ['object', 'string'], metaSchema: {oneOf: [{type: 'object'}, {type: 'string', minLength: 1}]}});
  for (const keyword of ['x-semantics', 'x-constants']) ajv.addKeyword({keyword, schemaType: 'object'});
}
