import {execFileSync} from 'node:child_process';
import {workflowValidators} from './workflow-schema-validator.mjs';
execFileSync(process.execPath, ['scripts/generate.mjs', '--workflow-local-only', '--check'], {stdio: 'inherit'});
const {components} = workflowValidators();
console.log(`Verified deterministic workflow outputs and ${Object.keys(components).length} component validators plus editor bridge.`);
