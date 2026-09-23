import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema=JSON.parse(readFileSync('sdks/jsonschema/scheduled-draft.schema.json'));
const api=JSON.parse(readFileSync('openapi/scheduled-plan-draft/scheduled-plan-draft.yaml'));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
for(const name of Object.keys(schema.$defs))ajv.compile({$ref:schema.$id+'#/$defs/'+name});
ajv.compile(JSON.parse(readFileSync('sdks/jsonschema/scheduled-draft-output.schema.json')));
function localize(x){if(Array.isArray(x))return x.map(localize);if(!x||typeof x!=='object')return x;return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='$ref'?v.replace(schema.$id,'').replace('#/$defs/','#/components/schemas/'):localize(v)]));}
const used=new Set();
function collect(x){if(Array.isArray(x)){x.forEach(collect);return;}if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(k==='$ref'){const name=v.split('#/$defs/')[1];if(name&&!used.has(name)){used.add(name);collect(schema.$defs[name]);}}else collect(v);}}
collect(api);
const resolved=localize({...api,components:{...api.components,schemas:Object.fromEntries([...used].map(name=>[name,schema.$defs[name]]))}});
const tmp=mkdtempSync(path.join(tmpdir(),'feat155-draft-lint-'));
try{const file=path.join(tmp,'openapi.json');writeFileSync(file,JSON.stringify(resolved));execFileSync('pnpm',['exec','redocly','lint','--config',path.resolve('redocly.yaml'),file],{stdio:'inherit'});}finally{rmSync(tmp,{recursive:true});}
console.log('Fixed draft schemas and canonical OpenAPI references strictly linted.');
