import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMarketProviderSource,dailyOutputSchema} from './market-host-source.mjs';
import {projectTypes} from './market-broker-codegen.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>readFileSync(path.join(root,p),'utf8'),q=JSON.stringify;
const args=process.argv.slice(2),check=args.includes('--check');assert.ok(args.every(a=>a==='--check'));
const {manifest,names,defs,documents,schema}=loadMarketProviderSource();
const daily=manifest.tool_profile;
const outputSchema=dailyOutputSchema({manifest,defs});
assert.equal(daily.inputDefinition,'TushareDailyArguments');
const codePattern='^[0-9]{6}\\.(SH|SZ|BJ)$';
const year='(?:[0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]|[0-9][1-9][0-9]{2}|[1-9][0-9]{3})';
const leap='(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)';
const datePattern='^(?:'+year+'(?:(?:01|03|05|07|08|10|12)(?:0[1-9]|[12][0-9]|3[01])|(?:04|06|09|11)(?:0[1-9]|[12][0-9]|30)|02(?:0[1-9]|1[0-9]|2[0-8]))|'+leap+'0229)$';
assert.equal(defs.TushareDailyArguments.properties.ts_code.pattern,codePattern);
assert.equal(defs.TushareDailyArguments.properties.trade_date.pattern,datePattern);
const patterns={
 [defs.CanonicalId.pattern]:e=>`if !canonical_id(${e}){return Err("invalid provider UUID");}`,
 '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$':e=>`if ${e}.is_empty()||!${e}.as_bytes()[0].is_ascii_alphanumeric()||!${e}.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-'){return Err("invalid provider service ID");}`,
 [codePattern]:e=>`if !daily_code(${e}){return Err("invalid daily instrument code");}`,
 [datePattern]:e=>`if !daily_date(${e}){return Err("invalid daily date");}`,
};
const aliases={};for(const n of ['CanonicalId','SelectionRef','ServiceId'])aliases[n]={rust:`pub use crate::generated::${n};`,go:`type ${n}=market.${n}`,rustValidate:n==='SelectionRef'?e=>`${e}.validate()?;`:undefined};
aliases.ScopeBinding={rust:'pub use crate::broker_generated::ScopeBinding;',go:'type ScopeBinding=broker.ScopeBinding',rustValidate:e=>`${e}.validate()?;`};
const rules={patterns,rust:{ProviderStatus:'if self.authorization_url.is_some()&&self.operation_state!=OperationState::AwaitingUser{return Err("authorization URL outside pending state");}if self.execution_available&&(self.qualification!=Qualification::Qualified||self.authorization_status!=AuthorizationStatus::Authorized||self.connection_status!=ConnectionStatus::Connected){return Err("provider readiness lacks facts");}'},go:{ProviderStatus:'if v.AuthorizationUrl!=nil&&v.OperationState!=OperationStateAwaitingUser{return errors.New("authorization URL outside pending state")};if v.ExecutionAvailable&&(v.Qualification!=QualificationQualified||v.AuthorizationStatus!=AuthorizationStatusAuthorized||v.ConnectionStatus!=ConnectionStatusConnected){return errors.New("provider readiness lacks facts")};'}};
const projected=projectTypes(defs,names,{aliases,rules,goPackage:'marketprovider',goImports:'market "github.com/36Dge/yijie-contracts/sdks/go/market-connectors";broker "github.com/36Dge/yijie-contracts/sdks/go/market-broker-control";'});
const banner='// Generated from market-provider source; DO NOT EDIT.\n';
let rust=banner+projected.rust+'fn canonical_id(s:&str)->bool{let b=s.as_bytes();b.len()==36&&s!="00000000-0000-0000-0000-000000000000"&&b.iter().enumerate().all(|(i,c)|if [8,13,18,23].contains(&i){*c==b\'-\'}else{c.is_ascii_digit()||(*c>=b\'a\'&&*c<=b\'f\')})}\n';
rust+='fn daily_code(s:&str)->bool{let b=s.as_bytes();b.len()==9&&b[..6].iter().all(u8::is_ascii_digit)&&b[6]==b\'.\'&&matches!(&b[7..],b"SH"|b"SZ"|b"BJ")}\n';
rust+='fn daily_date(s:&str)->bool{let b=s.as_bytes();if b.len()!=8||!b.iter().all(u8::is_ascii_digit){return false;}let decimal=|v:&[u8]|v.iter().fold(0u32,|n,d|n*10+u32::from(d-b\'0\'));let year=decimal(&b[..4]);let month=decimal(&b[4..6]);let day=decimal(&b[6..]);let days=match month{1|3|5|7|8|10|12=>31,4|6|9|11=>30,2=>if year%4==0&&(year%100!=0||year%400==0){29}else{28},_=>0};year>0&&day>0&&day<=days}\n';
let go=banner+projected.go;
for(const[key,value]of Object.entries(manifest.limits)){rust+=`pub const ${key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${value};\n`;go+=`const ${key[0].toUpperCase()+key.slice(1)}=${value}\n`;}
for(const[name,value]of Object.entries({Profile:daily.profile,ToolName:daily.gatewayToolName,UpstreamToolName:daily.upstreamToolName,UpstreamInputSchemaSha256:daily.upstreamInputSchemaSha256,Risk:daily.risk,PermissionMode:daily.permissionMode,ResultRowsField:daily.resultRowsField,InputSchemaJson:q(defs.TushareDailyArguments),OutputSchemaJson:q(outputSchema)})){
 rust+=`pub const TUSHARE_DAILY_${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:&str=${q(value)};\n`;
 go+=`const TushareDaily${name}=${q(value)}\n`;
}
for(const[name,value]of Object.entries({MaxRows:daily.maxRows,MaxCallsPerApproval:daily.maxCallsPerApproval})){
 rust+=`pub const TUSHARE_DAILY_${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:usize=${value};\n`;
 go+=`const TushareDaily${name}=${value}\n`;
}
for(const[name,value]of Object.entries({ResultIdentityFields:daily.resultIdentityFields,ResultNumericFields:daily.resultNumericFields,ResultRequiredNumericFields:daily.resultRequiredNumericFields})){
 rust+=`pub const TUSHARE_DAILY_${name.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase()}:[&str;${value.length}]=[${value.map(q).join(',')}];\n`;
 go+=`var TushareDaily${name}=[...]string{${value.map(q).join(',')}}\n`;
}
const outputs=new Map([
 ['sdks/rust/market-provider/types.gen.rs',execFileSync('rustfmt',['--edition','2021'],{input:rust})],
 ['sdks/go/market-provider/types.gen.go',execFileSync('gofmt',[],{input:go})],
 ['sdks/jsonschema/market-provider.schema.json',q(schema,null,2)+'\n'],
 ['sdks/jsonschema/tushare-daily-output.schema.json',q({$schema:schema.$schema,...outputSchema},null,2)+'\n'],
]);
const lockPath='compatibility/market-provider/source.lock.json',base=existsSync(path.join(root,lockPath))?JSON.parse(read(lockPath)).base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[...documents.keys(),'scripts/market-host-source.mjs','scripts/generate-market-provider.mjs','scripts/market-broker-codegen.mjs','scripts/sync-market-provider.mjs','pnpm-lock.yaml'];
outputs.set(lockPath,q({schema_version:1,contract_version:manifest.contract_version,feature:'FEAT-157',mode:'local_worktree_candidate',release:false,base_commit:base,sources:sources.map(p=>({path:p,sha256:hash(read(p))})),generated:[...outputs].map(([p,b])=>({path:p,sha256:hash(b)}))},null,2)+'\n');
for(const[p,b]of outputs){const file=path.join(root,p);if(check)assert.deepEqual(readFileSync(file),Buffer.from(b),p);else{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,b);}}
console.log(`Market provider ${check?'checked':'generated'}: ${names.length} definitions; no secret fields.`);
