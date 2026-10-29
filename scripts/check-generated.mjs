// Check and generate share exactly the same producers. The check never writes
// the checkout, even when a producer fails or an output is stale.
process.argv.push('--check');
await import('./generate.mjs');
