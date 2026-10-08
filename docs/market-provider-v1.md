# FEAT-157 受管 Provider 生命周期候选

2026-10-07，`market-provider/1` 0.1.0；Owner：段成威。Host 是控制 producer，Connectors Rust worker 是 consumer，Native 经 market-host 私有管道转发可信用户意图。源为 `compatibility/market-provider/wire.schema.json` 和 `transport.json`。单一 Host-owned worker 同时拥有 OAuth actor 与 Gateway；不增加 Native auth worker，不将平台 secret 交给 Host。

五个动作是 `provider_auth_begin`、`provider_auth_poll`、`provider_auth_cancel`、`provider_forget`、`provider_probe`。payload 固定 operationId、hostInstanceId、可信 scope、ProviderBinding。binding 直接包含原 SelectionRef、serviceId、opaque credentialRef；同安装代际的真实 revision 推进可经 Native 权威刷新，不能倒退或把 UI ready 当授权。Keyring alias 基于稳定 owner/tenant、service、installation/generation/credentialRef，不含显示 revision 或 Native epoch。

begin/forget/probe 立即返回 starting 并由受管 actor 后台执行；poll 的 operationId 查询原三类操作，不创造或续期。cancel 可以取消待决授权/probe，完成操作只回读事实；forget 的 Keyring 删除已经发出后不可撤回，cancel 只读原状态，Native 将删除标记不可取消。OAuth 完成后的 cancel 不等于清除凭据，需明确 forget。

OAuth authorizationUrl 仅可在 awaiting_user 返回给 Native 打开系统浏览器；access/refresh token、client secret、credential-bearing endpoint 不入 wire、日志、Host、Native 或 renderer。取消/EOF 必须先阻止晚 callback 保存，再正常等待 owned actor/client 清理；不 detach 后保存、不明文降级、不强杀。授权剩余期限与 300 秒共同限制单调生命周期。Keyring 写入失败不得回成功，清理未确认不得假称已删除。

OAuth 授权、连接、工具资格与用户启用是不同事实。probe 只实际 initialize/tools/list；auth succeeded 不自动产生 executionAvailable。当前仅 Tushare 进入真实验证，保留完整 51 目录，其他真实服务未资格。Tushare 公共 OAuth 元数据核验由 Connectors 留证；本族不支持客户端自由 endpoint，也不引入 token-in-path 输入捷径。真实 OAuth metadata/DCR/token 请求是外部操作，不能记录成外网零调用。

本族在模型 Runtime 尚未启动时也可管理授权，Gateway 仍须 Broker initialize 与真实本轮 capability。Broker 候选 0.2.0 的 externalCallsEnabled 如实表达产品装配外部网络能力，不代表用户授权、ready 或工具已资格。旧管理 status-only/WorkerLibraryPolicy 的 no-network 语义保持。

## 2026-10-08 daily 专用受管 profile

本地候选增加 `TushareDailyArguments` 和同源 `transport.json.tool_profile`，复用已有 Qualification/ProviderStatus/CallIdentity/ReviewProjection，不新增审批协议或 renderer 输入。契约影响为 semantic（既有 qualified/true 在严格受管 profile 下实现），新增工具输入为 additive；整个 FEAT-157 仍按 breaking 管理，未发布状态及版本不伪装为生产 pin。新产品构建明确 `tushare-daily-v1`；旧 `tushare-oauth-v1` 继续仅 OAuth/metadata，不能按旧 profile 自动打开金融调用。

只暴露易界工具 `tushare_daily`，映射上游精确 `daily`。输入只允许必填字符串 `ts_code`、`trade_date`：六位数字加 `.SH/.SZ/.BJ`，一个 0001–9999 年范围内的合法公历 YYYYMMDD（含闰年），额外字段和日期范围不允许。代码格式不证明该证券当前上市。`000001.SZ` / `20260105` 是首次验证样本，不是产品写死参数。Rust/Go 的 `TushareDailyArguments` 严格 validator、JSON Schema 和 `TUSHARE_DAILY_*` / `TushareDaily*` 常量都由同源生成；Gateway 应直接使用生成的 INPUT_SCHEMA_JSON，不能手写另一套输入规则。

Probe 只实际 initialize/tools/list，并要求恰好一个 `daily`，其完整 inputSchema 在固定 serde_json 的排序对象序列化下 SHA-256 等于 `ec10409543d1ae690de2b5da5893a0e69387cdd5a398f976fb04d187fc632ae1`，且上游形状接受两字符串、不要求其他输入。剥离描述后的摘要不能代替完整摘要，名字/annotations/历史文件不能代替当前核验。其余已发现 253 工具均不暴露；摘要变动先关闭该资格，再进行新的源评审，不能自动跟随供应商变化。

`qualified` 与 `executionAvailable=true` 只描述当前 owned actor 中、精确 ProviderBinding 的该窄 profile 能力。Probe 不是 Enable 意图；OAuth 自动 discovery 不登记执行 backend，历史回执不复活 live 能力。Native 显式 Enable、当前用户权限/选集/grant 和每次 ask 审批仍独立必需。重启、当前授权到期、撤销或代际变化后不能从 SQL 历史恢复 effectiveEnabled。

必须区分三个生命周期：尚未完成的 OAuth/Probe attempt 受原 Native 权限及 300 秒上限约束，poll 不延长；已经完成且仍存活的认证 client/schema 属于 owner 持有的资源，可在同 owner/tenant、Host instance、Native epoch、authorization revision 与精确 ref/credentialRef 下保留；每个已建立 turn/call 的原单调 TTL 永不延长。新鲜 Native scope 只读 poll 原操作可重新观察仍 live 的 client，不发网络、不创建新 Probe/授权、不复活失败或到期 attempt。Native 短期证据仍须每次重取，不能把一份回执永久当执行许可。Backend 关闭、凭据/代际/revision 更替、撤权或 owner 退出使资格立即失效。这样正常当前连接无需仅因旧 Enable scope 的五分钟期限重复授权或启用，而每次新的业务准入仍重新核验当前权限。

Broker prepare 查找同 owner/tenant、Host instance、Native epoch 和原 snapshot installation/revision/generation 的唯一 live 映射，并使用映射中已冻结的 credentialRef。credentialRef 改变必须推进 generation 并撤销旧映射，不能在同代际替换。Host 仍对完整 Submission.services 做意图比较，但不为每一轮制造新的 Probe 操作。此约束不要求 probe 自身是用户 Enable；Native 的 Enable/grant 边界独立核验。

每次实际 tools/call 使用生成输入校验后冻结原参数/摘要，安全摘要展示股票代码、交易日和只读用途，必须同时收到当前 callRef 的 owner approve_once 与原生 elicitation 同意，临发送前消耗一次批准。返回最多一行同请求身份的公开行情白名单数值（字段由 tool_profile 声明）；空结果如实返回空，不造数据。未知 MCP 封装、身份不符或多行返回安全错误，不向模型转发上游原文、不自动重发。源码校验与 schema 核验不等于首次真实业务验收已完成。

归一化结果是封闭对象 `{rows: [...]}`，rows 必有且最多一行。非空行必须包含同请求的 ts_code/trade_date 和有限数值 close；其余数值白名单字段可省略，出现时必须是有限数值，不接受 null 或数字字符串替代。仅身份字段的行是结果错误，不能静默改成空数组；真正 rows=[] 是成功的空数据。`resultRequiredNumericFields:["close"]`、rows 字段名及其余白名单由 tool_profile 唯一定义；生成器直接复用输入身份规则投影 `TUSHARE_DAILY_OUTPUT_SCHEMA_JSON` / `TushareDailyOutputSchemaJson` 和独立生成 JSON Schema，Gateway metadata 不再手写结果 schema。静态 Schema 不证明行身份等于这一次请求，backend 仍须显式比对。

`generate-market-provider.mjs` 从源生成 Go/Rust/schema，`sync-market-provider.mjs --consumer=desktop|agent-host|connectors` 同步本地候选；`make market-host-{generate,check,test}` 覆盖该族。source.lock 记录实际源/产物摘要、base commit、release=false。不修改旧管理55/selection18/Sorftime；不创建发布 tag 或虚构 pin。Owner/consumer 确認、下游生命周期与真实工具资格证据仍须分别完成，源码编译不能代替端到端验收。验证见 [本轮记录](market-host-validation-2026-10-07.md)。
