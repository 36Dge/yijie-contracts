// Offline source-preserving baseline comparison for FEAT-164. Canonical schema
// URLs are identifiers; never resolve them by contacting schemas.yijie.ai.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [base,...extra]=process.argv.slice(2);
assert.ok(/^[0-9a-f]{40}$/.test(base??'')&&extra.length===0,'Pass one full baseline commit');
assert.equal(execFileSync('git',['rev-parse','--verify',base+'^{commit}'],{cwd:root,encoding:'utf8'}).trim(),base);
const work=mkdtempSync(path.join(tmpdir(),'yijie-feat164-breaking-'));
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,stdio:'inherit'});
const sha=b=>createHash('sha256').update(b).digest('hex');
function files(dir){return readdirSync(dir,{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>path.join(x.parentPath,x.name)).sort();}
function normalize(tree){
  const docs=new Map();
  const ids=new Map();
  for(const area of ['openapi','jsonschema'])for(const file of files(path.join(tree,area))){
    if(!/\.(json|ya?ml)$/.test(file))continue;
    const raw=readFileSync(file);
    const value=YAML.parse(raw.toString());
    if(!value||typeof value!=='object')continue;
    docs.set(file,{value,sha256:sha(raw)});
    if(value.$id){assert.ok(!ids.has(value.$id),'Duplicate canonical ID: '+value.$id);ids.set(value.$id,file);}
  }
  const rewrites=[];
  function local(ref,file){
    if(!/^https?:/.test(ref))return ref;
    const [id,fragment]=ref.split('#');
    assert.ok(ids.has(id),'Unregistered remote reference: '+ref);
    let relative=path.relative(path.dirname(file),ids.get(id)).split(path.sep).join('/');
    if(!relative.startsWith('.'))relative='./'+relative;
    const result=relative+(fragment===undefined?'':'#'+fragment);
    rewrites.push({file:path.relative(tree,file),from:ref,to:result});
    return result;
  }
  function walk(value,file){
    if(!value||typeof value!=='object')return;
    if(typeof value.$ref==='string')value.$ref=local(value.$ref,file);
    if(value.discriminator?.mapping)for(const [key,ref] of Object.entries(value.discriminator.mapping))value.discriminator.mapping[key]=local(ref,file);
    for(const child of Object.values(value))walk(child,file);
  }
  for(const [file,{value}] of docs){walk(value,file);writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
  // All validation keywords and data values are preserved. Only reference
  // locations are translated, symmetrically, inside these owned temporary trees.
  console.log(JSON.stringify({tree:path.basename(tree),source_count:docs.size,canonical_reference_rewrites:rewrites.length,source_tree_sha256:sha(JSON.stringify([...docs].map(([file,d])=>[path.relative(tree,file),d.sha256])))}));
}
try {
  const old=path.join(work,'baseline'),current=path.join(work,'current');
  mkdirSync(old);mkdirSync(current);
  execFileSync('tar',['-xf','-','-C',old],{input:execFileSync('git',['archive',base,'openapi','jsonschema'],{cwd:root,maxBuffer:64*1024*1024})});
  for(const area of ['openapi','jsonschema'])cpSync(path.join(root,area),path.join(current,area),{recursive:true});
  normalize(old);normalize(current);
  const specs=files(path.join(old,'openapi')).filter(file=>/\.ya?ml$/.test(file)&&YAML.parse(readFileSync(file,'utf8')).openapi);
  assert.ok(specs.length>0,'No baseline OpenAPI specifications');
  for(const file of specs){
    const relative=path.relative(old,file),target=path.join(current,relative);
    assert.ok(existsSync(target),'Removed baseline API: '+relative);
    console.log('OpenAPI '+relative);
    run('go',['tool','oasdiff','breaking',file,target]);
  }
  run('pnpm',['exec','buf','breaking','protobuf','--against',`.git#commit=${base},subdir=protobuf`]);
  run(process.execPath,['scripts/check-asyncapi-breaking.mjs',base]);
  run(process.execPath,['scripts/check-jsonschema-breaking.mjs',base]);
  console.log(`FEAT-164 offline comparison passed: ${base}; ${specs.length} existing OpenAPI specs, Protobuf, AsyncAPI and JSON Schema.`);
} finally {rmSync(work,{recursive:true,force:true});}
