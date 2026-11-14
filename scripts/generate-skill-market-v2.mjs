// FEAT-174 source-first local skill marketplace consumer projection.
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'json-schema-to-typescript';
import {projectTypes} from './market-broker-codegen.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
const consumer=args.find(x=>x.startsWith('--consumer='))?.split('=')[1];
assert(args.every(x=>['--check','--consumer=host','--consumer=desktop','--consumer=skills'].includes(x)));
const source='jsonschema/skills/market-v2.schema.json';
const read=p=>readFileSync(path.join(root,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const schema=JSON.parse(read(source));
const rules={patterns:{
 '^[0-9a-f]{64}$':e=>`if ${e}.len()!=64||!${e}.bytes().all(|b| b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid digest");}`,
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$':e=>`if ${e}.len()!=36||!${e}.bytes().enumerate().all(|(i,b)|if [8,13,18,23].contains(&i){b==b'-'}else{b.is_ascii_digit()||(b'a'..=b'f').contains(&b)}){return Err("invalid operation identity");}`,
}};
const projection=projectTypes(schema.$defs,Object.keys(schema.$defs),{goPackage:'skillmarketv2',rules});
const catalogBudget=schema['x-constants'].maxCatalogResponseBytes;assert(Number.isSafeInteger(catalogBudget)&&catalogBudget>0);
const banner='// Generated from skills/market-v2; DO NOT EDIT.\n';
const outputs=new Map([
 ['sdks/go/skillmarketv2/types.gen.go',execFileSync('gofmt',[],{input:banner+projection.go+`\nconst MaxCatalogResponseBytes = ${catalogBudget}\n`})],
 ['sdks/rust/skillmarketv2/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:banner+projection.rust+`\npub const MAX_CATALOG_RESPONSE_BYTES: usize = ${catalogBudget};\n`})],
 ['sdks/typescript/src/jsonschema/skill-market-v2.gen.ts',await compile({...schema,anyOf:Object.keys(schema.$defs).map(n=>({$ref:'#/$defs/'+n}))},'SkillMarketV2',{bannerComment:banner.trim(),additionalProperties:false,unknownAny:true})],
]);
const ajv=new Ajv({strict:false,code:{source:true,esm:true}});ajv.addSchema(schema);
const validators='// Generated native Skill validators. DO NOT EDIT.\nimport ucs2lengthModule from "ajv/dist/runtime/ucs2length.js";\nconst ucs2length=typeof ucs2lengthModule==="function"?ucs2lengthModule:ucs2lengthModule.default;\n'+standalone(ajv,{validateSkillMarketCatalog:schema.$id+'#/$defs/Catalog',validateSkillMarketOperation:schema.$id+'#/$defs/Operation'}).replaceAll('require("ajv/dist/runtime/ucs2length").default','ucs2length');
outputs.set('sdks/typescript/src/jsonschema/skill-market-v2.validator.gen.js',validators);
outputs.set('sdks/typescript/src/jsonschema/skill-market-v2.validator.gen.d.ts','import type {Catalog,Operation} from "./skill-market-v2.gen";\nexport declare function validateSkillMarketCatalog(value:unknown):value is Catalog;\nexport declare function validateSkillMarketOperation(value:unknown):value is Operation;\n');
const lockPath='compatibility/skill-market-v2/source.lock.json';
const base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
outputs.set(lockPath,JSON.stringify({schema_version:1,feature:'FEAT-174',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[source,'openapi/agent-host/skill-market-v2.yaml','scripts/generate-skill-market-v2.mjs','scripts/market-broker-codegen.mjs'].map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
function put(p,b){if(check)assert.deepEqual(readFileSync(p),Buffer.from(b),p);else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,b);}}
for(const[p,b]of outputs)put(path.join(root,p),b);
if(consumer){
 const destinations={
  host:[[source,'api/schemas/skill-market-v2.schema.json'],['sdks/go/skillmarketv2/types.gen.go','internal/contracts/skillmarketv2/types.gen.go'],[lockPath,'api/skill-market-v2.candidate.json']],
  desktop:[[source,'contracts/skill-market-v2.schema.json'],['sdks/rust/skillmarketv2/types.gen.rs','src-tauri/src/skills/market_v2_generated.rs'],['sdks/typescript/src/jsonschema/skill-market-v2.gen.ts','src/domain/skill-market-v2.generated.ts'],['sdks/typescript/src/jsonschema/skill-market-v2.validator.gen.js','src/api/generated/skill-market-v2-validator.gen.js'],[lockPath,'contracts/skill-market-v2.candidate.json']],
  skills:[[source,'contracts/skill-market-v2.schema.json'],[lockPath,'contracts/skill-market-v2.candidate.json']],
 };
 for(const[src,dst]of destinations[consumer])put(path.join(root,'../yijie-'+(consumer==='host'?'agent-host':consumer),dst),read(src));
 if(consumer==='desktop')put(path.join(root,'../yijie-desktop/src/api/generated/skill-market-v2-validator.gen.d.ts'),read('sdks/typescript/src/jsonschema/skill-market-v2.validator.gen.d.ts').toString().replace('./skill-market-v2.gen','../../domain/skill-market-v2.generated'));
}
console.log('FEAT-174 skill-v2 projection '+(check?'verified':'generated')+'; local candidate only.');
