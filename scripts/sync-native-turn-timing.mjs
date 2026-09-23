import { consumerSourceLock } from './scheduled-consumer-source.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);assert.ok(args.length===0 || (args.length===1&&args[0]==='--check'));
execFileSync(process.execPath,['scripts/generate-native-turn-timing.mjs','--check'],{cwd:root,stdio:'inherit'});
const lock='compatibility/native-turn-timing/source.lock.json';
const pairs=[
 ['yijie-agent-host','openapi/native-turn-timing/native-turn-timing.yaml','api/openapi/native-turn-timing.yaml'],
 ['yijie-agent-host','sdks/go/openapi/native-turn-timing/types.gen.go','internal/contracts/nativetiming/types.gen.go'],
 ['yijie-agent-host','sdks/jsonschema/native-turn-timing.schema.json','api/schemas/native-turn-timing.schema.json'],
 ['yijie-agent-host',lock,'api/native-turn-timing.candidate.json'],
 ['yijie-desktop','sdks/rust/native-turn-timing/types.gen.rs','src-tauri/src/chat/schedules/timing_generated.rs'],
 ['yijie-desktop','sdks/jsonschema/native-turn-timing.schema.json','contracts/native-turn-timing.schema.json'],
 ['yijie-desktop',lock,'contracts/native-turn-timing.candidate.json'],
];
for(const [repo,source,dest]of pairs){const target=path.join(root,'..',repo,dest),bytes=source===lock ? consumerSourceLock(root,lock,target,args.includes('--check')) : readFileSync(path.join(root,source));if(args.includes('--check'))assert.deepEqual(readFileSync(target),bytes,`Timing consumer drift: ${target}`);else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);}}
console.log('Native timing consumers '+(args.includes('--check')?'verified':'synchronized')+'; legacy pins untouched.');
