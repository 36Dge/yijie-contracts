import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
const read=p=>JSON.parse(readFileSync(p));
for(const family of ['market-selection','market-host','experts']){
 test(family+' v2 preserves old shape/digests and adds the new known profile',()=>{
  const old=read(`sdks/jsonschema/${family}.schema.json`),current=read(`sdks/jsonschema/${family}-v2.schema.json`);
  const make=s=>{const a=new Ajv({strict:true,allErrors:true});addFormats(a);a.addSchema(s);return n=>a.compile({$ref:s.$id+'#/$defs/'+n});};
  const v1=make(old),v2=make(current);for(const n of Object.keys(current.$defs))v2(n);
  const field=family==='market-host'?'profile_id':'profileId';
  const model=family==='experts'?current.$defs.ModelIntent:current.$defs.ModelIntent;
  const actualField=Object.keys(model.properties).find(k=>/profile/i.test(k))??field;
  const revision=Object.keys(model.properties).find(k=>/revision/i.test(k));
  for(const id of ['kimi-k3-max-v1','kimi-k3-1-pro-max-v1','minimax-m3-high-v1']){
   const input={[actualField]:id,[revision]:1};assert.equal(v2('ModelIntent')(input),true,JSON.stringify(v2('ModelIntent').errors));assert.equal(v1('ModelIntent')(input),id!=='kimi-k3-1-pro-max-v1');
  }
  assert.equal(v2('ModelIntent')({[actualField]:'future-model',[revision]:1}),false);
  assert.equal(v2('ModelIntent')({[actualField]:null,[revision]:1}),false);
  const expand=(v,defs)=>{
   if(Array.isArray(v))return v.map(x=>expand(x,defs));
   if(!v||typeof v!=='object')return v;
   if(v.$ref)return expand(defs[v.$ref.split('/').at(-1)],defs);
   return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='description').map(([k,x])=>[k,k==='enum'?x.filter(y=>y!=='kimi-k3-1-pro-max-v1'&&(!(x.includes('application/pdf')&&x.includes('text/plain'))||!['image/svg+xml','video/mp4'].includes(y))):expand(x,defs)]));
  };
  for(const [name,value] of Object.entries(old.$defs)){
   if(name==='ProfileId')continue;
   assert.deepEqual(expand(current.$defs[name],current.$defs),expand(value,old.$defs),`${family}.${name} unrelated shape drift`);
  }
 });
}
test('selection and expert snapshot/knowledge digest vectors remain byte-identical',()=>{
 for(const file of ['market-selection/digest-vectors.json','experts/digest-vectors.json','experts/knowledge-digest-vectors.json']){
  const [family,name]=file.split('/');assert.deepEqual(readFileSync('fixtures/'+file),readFileSync(`fixtures/${family}-v2/${name}`));
 }
});
test('K3.1 market reader preserves the shared missing-credential error',()=>{
  const schema=read('sdks/jsonschema/market-host-v2.schema.json');
  const ajv=new Ajv({strict:true});addFormats(ajv);ajv.addSchema(schema);
  const valid=ajv.compile({$ref:schema.$id+'#/$defs/ErrorCode'});
  assert.equal(valid('not_configured'),true);
  assert.equal(valid('unknown_credential_error'),false);
 assert.equal(read('compatibility/market-host-v2/transport.json').contract_version,'0.6.0');
 assert.equal(read('compatibility/experts-v2/transport.json').contract_version,'0.2.0');
});
