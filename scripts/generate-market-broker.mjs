import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadBrokerSource} from './market-broker-source.mjs';
import {loadMarketSelectionSource} from './market-selection-source.mjs';
import {projectTypes} from './market-broker-codegen.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');assert.ok(args.every(a=>a==='--check'));
const read=p=>readFileSync(path.join(root,p),'utf8');
const {source,manifest,names,defs,documents,schema}=loadBrokerSource();
const selection=loadMarketSelectionSource();
for(const script of ['generate-market-connectors.mjs','generate-market-selection.mjs'])execFileSync(process.execPath,['scripts/'+script,'--check'],{cwd:root,stdio:'pipe'});
const banner='// Generated from market-broker-control source and declared borrowed authorities; DO NOT EDIT.\n';
const uuidPattern=defs.CanonicalId.pattern;
const patterns={
 [uuidPattern]:e=>`if !canonical_id(${e}){return Err("invalid broker UUID");}`,
 '^[0-9a-f]{64}$':e=>`if ${e}.len()!=64||!${e}.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("invalid broker digest");}`,
 '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$':e=>`if ${e}.is_empty()||!${e}.as_bytes()[0].is_ascii_alphanumeric()||!${e}.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-'){return Err("invalid broker service ID");}`,
 "^http://127\\.0\\.0\\.1:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])/mcp$":e=>`if !gateway_url(${e}){return Err("invalid broker gateway URL");}`,
};
const canonical='fn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36&&s!="00000000-0000-0000-0000-000000000000"&&b.iter().enumerate().all(|(i,c)|if [8,13,18,23].contains(&i){*c==b\'-\'}else{c.is_ascii_digit()||(*c>=b\'a\'&&*c<=b\'f\')})}\n';
const gateway='fn gateway_url(s:&str)->bool{s.strip_prefix("http://127.0.0.1:").and_then(|x|x.strip_suffix("/mcp")).is_some_and(|p|!p.is_empty()&&!p.starts_with("0")&&p.len()<=5&&p.bytes().all(|b|b.is_ascii_digit())&&p.parse::<u16>().is_ok_and(|v|v>0))}\n';
const selectionRules={patterns,rust:{SelectionSnapshot:'if self.selection.windows(2).any(|w|w[0].installation_id>=w[1].installation_id){return Err("selection snapshot is not canonical");}if selection_digest(&self.turn_operation_id,&self.selection)?!=self.selection_digest{return Err("selection snapshot digest mismatch");}'},go:{SelectionSnapshot:'for i:=1;i<len(v.Selection);i++{if v.Selection[i-1].InstallationId>=v.Selection[i].InstallationId{return errors.New("selection snapshot is not canonical")}};digest,err:=SelectionDigest(string(v.TurnOperationId),v.Selection);if err!=nil{return err};if digest!=string(v.SelectionDigest){return errors.New("selection snapshot digest mismatch")};'}};
// Borrow actual generated SelectionRef, and project only the pre-existing
// SelectionSnapshot authority for processes without Desktop's model modules.
const portableNames=['CanonicalId','SelectionRef','SelectionDigest','Selection','SelectionSnapshot'];
const portable=projectTypes(selection.defs,portableNames,{goPackage:'marketselection',goImports:'market "github.com/36Dge/yijie-contracts/sdks/go/market-connectors";',rustImports:'use sha2::{Digest,Sha256};',aliases:{CanonicalId:{rust:'pub type CanonicalId=String;',go:'type CanonicalId=market.CanonicalId'},SelectionRef:{rust:'pub use crate::generated::SelectionRef;',go:'',rustValidate:e=>e+'.validate()?;'}},rules:selectionRules});
// Canonical digest helpers are selected verbatim from the checked generated
// selection family. No second implementation or modified legacy generator.
const selectionRust=read('sdks/rust/market-selection/types.gen.rs');
const helperOffset=selectionRust.indexOf('pub fn validate_selection(');assert.ok(helperOffset>0);
const portableRust=banner+portable.rust+canonical+selectionRust.slice(helperOffset);
// The existing Go digest function uses SelectionDigest as its public name.
// Use a source-derived projection type name, never change the existing function.
const portableGo=portable.go.replaceAll('type SelectionDigest string','type SelectionDigestValue string').replaceAll('(v SelectionDigest)', '(v SelectionDigestValue)').replaceAll('SelectionDigest SelectionDigest ', 'SelectionDigest SelectionDigestValue ');
const aliases={
 CanonicalId:{rust:'pub use crate::generated::CanonicalId;',go:'type CanonicalId=market.CanonicalId'},
 SelectionRef:{rust:'pub use crate::generated::SelectionRef;',go:'type SelectionRef=market.SelectionRef',rustValidate:e=>e+'.validate()?;'},
 SelectionSnapshot:{rust:'pub use crate::selection_generated::SelectionSnapshot;',go:'type SelectionSnapshot=selection.SelectionSnapshot',rustValidate:e=>e+'.validate()?;'},
 SelectionDigest:{rust:'pub use crate::selection_generated::SelectionDigest;',go:'type SelectionDigest=selection.SelectionDigestValue'},
 ServiceId:{rust:'pub use crate::generated::ServiceId;',go:'type ServiceId=market.ServiceId'},
 Revision:{rust:'pub use crate::generated::Revision;',go:'type Revision=market.Revision'},
};
const rules={patterns,rust:{Lease:'if self.snapshot.turn_operation_id!=self.binding.turn_operation_id||self.snapshot.selection_digest!=self.binding.selection_digest{return Err("lease snapshot binding mismatch");}if self.native_turn_id.is_some()!=self.bound_native_thread_id.is_some()||(self.state==LeaseState::Prepared&&self.native_turn_id.is_some())||(self.state==LeaseState::Bound&&self.native_turn_id.is_none()){return Err("invalid lease turn binding");}if self.binding.context.native_thread_id.as_ref().zip(self.bound_native_thread_id.as_ref()).is_some_and(|(expected,actual)|expected!=actual){return Err("lease thread binding mismatch");}'},go:{Lease:'if v.Snapshot.TurnOperationId!=v.Binding.TurnOperationId||string(v.Snapshot.SelectionDigest)!=string(v.Binding.SelectionDigest){return errors.New("lease snapshot binding mismatch")};if (v.NativeTurnId==nil)!=(v.BoundNativeThreadId==nil)||(v.State==LeaseStatePrepared&&v.NativeTurnId!=nil)||(v.State==LeaseStateBound&&v.NativeTurnId==nil){return errors.New("invalid lease turn binding")};if v.Binding.Context.NativeThreadId!=nil&&v.BoundNativeThreadId!=nil&&*v.Binding.Context.NativeThreadId!=*v.BoundNativeThreadId{return errors.New("lease thread binding mismatch")};',GatewayUrl:'port:=strings.TrimSuffix(strings.TrimPrefix(string(v),"http://127.0.0.1:"),"/mcp");n,err:=strconv.ParseUint(port,10,16);if err!=nil||n==0{return errors.New("invalid broker gateway port")};'}};
const projection=projectTypes(defs,names,{aliases,rules,goPackage:'marketbrokercontrol',goImports:'market "github.com/36Dge/yijie-contracts/sdks/go/market-connectors";selection "github.com/36Dge/yijie-contracts/sdks/go/market-selection";"strconv";"strings";'});
let rust=banner+projection.rust+canonical+gateway;
rust+=`#[derive(Clone,Debug,Serialize,Deserialize)]#[serde(untagged)]pub enum Request{${manifest.commands.map(c=>c.request.replace('Request','')+'(Box<'+c.request+'>),').join('')}}\n`;
rust+='impl Request{pub fn request_id(&self)->&str{match self{'+manifest.commands.map(c=>'Self::'+c.request.replace('Request','')+'(v)=>&v.request_id,').join('')+'}}}\n';
let go=banner+projection.go;
go+='// DecodeRequest chooses only a declared method, then runs its closed generated decoder.\nfunc DecodeRequest(b []byte)(any,error){var h struct{Method string `json:"method"`};if err:=json.Unmarshal(b,&h);err!=nil{return nil,errors.New("invalid broker request")};switch h.Method{'+manifest.commands.map(c=>`case ${JSON.stringify(c.method)}:var v ${c.request};if err:=json.Unmarshal(b,&v);err!=nil{return nil,err};return v,nil;`).join('')+'default:return nil,errors.New("unknown broker method")}}\n';
for(const[key,v]of Object.entries(manifest.generic_profile))if(typeof v==='number'){rust+=`pub const GENERIC_${key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${v};\n`;go+=`const Generic${key[0].toUpperCase()+key.slice(1)}=${v}\n`;}
for(const[key,v]of Object.entries(manifest.limits)){rust+=`pub const ${key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${v};\n`;go+=`const ${key[0].toUpperCase()+key.slice(1)}=${v}\n`;}
for(const[group,projection]of Object.entries(manifest.gateway_errors))for(const field of ['outcome','code','message']){
 const name='GatewayError'+group[0].toUpperCase()+group.slice(1)+field[0].toUpperCase()+field.slice(1);
 rust+=`pub const ${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:&str=${JSON.stringify(projection[field])};\n`;
 go+=`const ${name}=${JSON.stringify(projection[field])}\n`;
}
const outputs=new Map([
 ['sdks/rust/market-selection/portable.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:portableRust})],
 ['sdks/go/market-selection/snapshot.gen.go',execFileSync('gofmt',[],{input:banner+portableGo})],
 ['sdks/rust/market-broker-control/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/go/market-broker-control/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/jsonschema/market-broker-control.schema.json',JSON.stringify(schema,null,2)+'\n'],
]);
const lockPath='compatibility/market-broker-control/source.lock.json',base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.match(base,/^[0-9a-f]{40}$/);execFileSync('git',['cat-file','-e',base+'^{commit}'],{cwd:root});
const sources=new Set([...documents.keys(),...selection.documents.keys(),'scripts/market-broker-source.mjs','scripts/market-broker-codegen.mjs','scripts/generate-market-broker.mjs','scripts/sync-market-broker.mjs','scripts/market-selection-source.mjs','scripts/generate-market-selection.mjs','sdks/rust/market-selection/types.gen.rs','sdks/go/market-selection/digest.gen.go','compatibility/market-selection/source.lock.json','compatibility/market-connectors/source.lock.json','pnpm-lock.yaml']);
const hash=b=>createHash('sha256').update(b).digest('hex');
outputs.set(lockPath,JSON.stringify({schema_version:1,contract_version:manifest.contract_version,feature:'FEAT-157',mode:'local_worktree_candidate',release:false,base_commit:base,sources:[...sources].map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Market Broker ${check?'checked':'generated'}: ${names.length} definitions / ${manifest.commands.length} private actions; external network capability is distinct from tool qualification.`);
