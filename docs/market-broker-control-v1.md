# FEAT-157 私有 Broker 控制本地候选

2026-10-07。Owner：段成威；Host 是控制请求的唯一 producer，Connectors Rust worker 是唯一 consumer；响应方向相反。新增独立源是 additive，整体 FEAT-157 按 breaking 管理。用户已授权按需求包逐步实现；本地可审查候选不是生产发布、真实供应商资格或外部账户授权。

唯一 wire 权威源为 `compatibility/market-broker-control/wire.schema.json`；共址 `control.json` 声明私有 transport、8 个动作、有界资源、生命周期与参数摘要语义。没有 HTTP 控制端点。`sdks/jsonschema/market-broker-control.schema.json` 只是机械生成的 bundled 投影，不是第二份源。原 market-connectors 的 55 个定义/9 个 Native IPC、market-selection 的 18 个定义和旧 pinned generator 保持原样。

## 进程和信任边界

Host 直接拥有 Connectors Rust worker，独占其 JSONL stdin/stdout；不增加仅转发的 Go Broker 进程。启动文件由 canonical build 的 content-addressed manifest 确定，不能由 renderer 指定。Runtime 的 MCP 数据面与控制面分离：没有控制管道继承、没有从 MCP 调用 prepare/decision 的入口。

初始化固定 Host instance、Runtime generation 和 worker instance。数据面 bearer 仅通过独立启动环境交给 worker 与该 Runtime generation，并复用工具环境精确清除；它不进入本源、回执、日志、聊天或参数。初始化只返回 `http://127.0.0.1:<port>/mcp`，派生 `/mcp/<capabilityRef>` 定位单租期。非秘密 capabilityRef 不是认证；数据请求仍须满足 bearer、真实 thread/turn、scope、租期、当前安装代际、已资格工具和审批。

ScopeBinding 的 owner/tenant/nativeProcessEpoch/authorizationRevision/authorizationExpiresAtUnixMs 必须来自可信 Native adapter 和 Host 核验。UUID 格式、独占管道、API bearer 或任意 JSON 本身都不证明产品授权。Native→Host 的授权 carrier 由独立 [market-host/1](market-host-v1.md) 定义；provider 生命周期由 [market-provider/1](market-provider-v1.md) 定义。实际产品准入仍须两端装配、可信授权、真实安装状态和逐工具资格，普通合成资格不能代替用户授权。

本地未发布候选由 0.1.0 显式同步升级到 **0.2.0**：`InitializeResult.externalCallsEnabled` 从固定 false 改为 boolean。这是 breaking 候选变更，Desktop、Host、worker 生成物必须一起升级。该值只说明装配是否允许受管外部 provider 网络能力；Tushare 产品装配为 true，qualification/旧只读模式为 false。它不表示已授权、连接就绪、某工具已资格或可执行本轮。真实 OAuth metadata/DCR/token 请求均计为外部操作；旧管理 55 定义中的 status-only/WorkerLibraryPolicy 不改义。部署 manifest 的 schemaVersion2 由部署实现负责，不能把新产物声明成原 schemaVersion1 的 false 语义。

## 动作与失败语义

| method | 请求核心信息 | 成功事实 |
|---|---|---|
| initialize | mutation operationId + ProcessBinding | 固定 worker/process identity、无 token 的 Gateway URL；如实返回装配的 externalCallsEnabled 网络能力 |
| prepare | operationId、ContextBinding、原 SelectionSnapshot、ttlMs | 冻结单原始 turn operation 的选集；prepared 尚无业务准入 |
| bind_turn | operationId、CapabilityBinding、expectedRevision、真实 nativeThreadId/nativeTurnId | 只绑定一次真实 Turn；不续租、不自动认领 metadata |
| revoke | operationId、CapabilityBinding、expectedRevision、reason | 先停止准入，再正常清理；不承诺撤销外部已发请求 |
| status | CapabilityBinding | 读取原租期观察；不创建或延长能力 |
| pending_call | CapabilityBinding、真实 thread/Turn、callRef | 查询 Broker 实际 tools/call 登记；不创造记录 |
| decide_call | operationId、完整 CallIdentity、expectedRevision、approvalRef、decisionId、decision | 记录原调用单次批准/拒绝/取消；不伪造工具执行完成 |
| shutdown | operationId、ProcessBinding、reason | 停止新准入、撤销并唤醒待决请求；stopping 不是外部完成 |

请求封闭、required/null 严格。响应允许未来字段，但消费者解码后丢弃，不回显、保存或记录。错误只返回安全 code 和 `retryable=false`；没有可辨认 requestId 时省略，不制造 UUID。超时或 response 丢失时先查询原租期/调用/Host Turn；不自动制造新的 mutation/Turn 或再次执行业务。

Mutation operationId 比较完整 typed payload，传输 requestId 不参与意图。相同请求只读原事实，不延长权限。另以稳定 `(ownerUserId, tenantId, nativeProcessEpoch, agentSessionId, turnOperationId)` 保留原 Turn 的 reservation。authorization revision/expiry 续期不会改变这个身份；新 scope 或新 mutation UUID 都不能复活撤销/过期的原 capability。活跃 prepare 重读原租期，失效 prepare 返回失效事实，不能重建。

## 首次 thread 的实际依赖与候选同步升级

实际 Runtime 验证发现尚无 Turn 的新 thread 没有可供 cold-resume 的 rollout；不能用“先建空 thread 再恢复”解决 Gateway URL 依赖，也不能编造 thread ID 或偷偷发送 bootstrap 模型轮。因此本地未发布候选现在显式区分原始线程意图：ContextBinding.nativeThreadId 为 **required nullable**，null 是尚未创建的新线程，字符串是已有真实线程，省略仍非法。

新会话先 prepare(null) 取得 capabilityRef，再带完整 Gateway config 调用 thread/start，随后真实 turn/start，最后 bind_turn 同时冻结实际 thread/turn ID。已有会话 prepare(实际 thread ID) 后只进行一次合并 model/selection 的 cold-resume，再启动并绑定真实 Turn。原 CapabilityBinding/Context 不被回写；Lease 的 boundNativeThreadId/nativeTurnId 成对表示实际绑定，prepared 两者均无，bound 两者必有；已有 context 的真实 thread 必须相同。

CallIdentity 和 PendingCallPayload 也携带实际 nativeThreadId。Host 对 nullable 字段比较值而不是 Go 指针地址。stable turn reservation 不包含待确定的 thread，也不包含可续期的授权 revision/expiry；worker 另外确保同一个真实 native thread 最多一个 live bound lease。此变更仅在本地候选进行，两端生成同步升级，没有发布后兼容承诺变化，旧55/18源不受影响。

## 租期、容量和正常关闭

首次接收把请求 TTL、可信授权剩余墙钟时长和 300000 ms 取最小，拒绝非正/不确定时钟，再用 worker 单调时钟执行到期。Host 在发送前还应扣除排队耗时。重放、绑定、刷新 scope 和审批都不得延长原期限。新一轮必须使用真实新的 turn operation；不得静默续权。

限制来自 control.json 并生成两种语言常量：frame 65536 bytes、lease 300000 ms、未绑定等待 5000 ms、审批最多 60000 ms 且不得超过父 lease、64 个保留 lease、128 个 pending call、1024 个 mutation receipt、参数 32768 bytes/16 层。保留的 mutation/turn reservation 不因满容量被逐出以接受新执行；容量满时失败关闭。需要新 generation 时走正常所有者关闭和退出确认。

若 Revoke 或 Shutdown 返回同源解码后的 `capacity_exceeded`，Host 必须在仍持有串行控制 gate 时正常关闭该 owner 的 stdin，永久退役本 generation，再把原 typed capacity 错误交还调用方。随后必须调用 Close 确认正常退出；未确认则保留 STOP_PENDING/原 owner。不能为处理此边界额外增加 receipt、自动重试/换进程或声称外部业务已停止；只有退出确认后才可装配另一 generation。此行为是控制契约要求，不能只返回错误并让原 lease 保持运行。

shutdown/EOF 先停止准入并撤销，随后正常清理。Host 关闭 stdin 并等待真实退出；超时保留 STOP_PENDING/原 owner，不强杀、不在后台换一个进程复活。已经发往外部且结果不确定的调用仍为 unknown；撤销回执不能被当作 rollback。

## 调用和审批关联

`ElicitationMetadata` 是固定上游 MCP `_meta` 中 Gateway 自有的最小片段：`yijieMarketCallRef` 与固定 `yijieKind=gateway_call_approval`。这里不复制或改写上游 elicitation envelope。metadata 只提供 query 线索；Host 必须使用实际 native thread/turn 查询 Broker 的真实记录，并匹配 service、原 SelectionRef、toolName、argsDigest 与完整绑定。不能从 metadata、最近 Tool Item、模型文字或工具标题构造记录。

Host 复用已有审批生命周期验证 approvalRef/decisionId，不能只检查 UUID 格式。ReviewProjection 是经工具支持策略产生、足够支持知情批准的安全摘要，不能只显示 hash 或原样显示上游描述。worker 再独立核验原记录/revision/lease，并要求 owner decision 与原生 elicitation 一致；一份 approve_once 只能为一个真实 callRef 消耗一次。同参数的另一 tools/call 是新身份。

2026-10-08 的 `tushare-daily-v1` 只实现 [Provider 源工具策略](market-provider-v1.md) 中的 `tushare_daily`。prepare 不再把所有真实服务写死为未资格，而是查找当前 owned actor 的唯一 live 精确 scope/epoch/installation/revision/generation 映射（含冻结的 credentialRef）。缺失或失效仍为 not_qualified；不从历史重建、不每轮启动 Probe。Probe 观察能力、Native 显式 Enable 与本轮 grant、实际单调用审批分别成立。旧 OAuth-only profile 不获得金融执行能力。

同 owner/Host/Native epoch、authorization revision 与精确 ref/credentialRef 下已完成且存活的 client/schema 可由新鲜 Native scope 只读 poll 观察，不产生新网络或授权。它是受管资源，不是旧权限的续租：pending OAuth attempt 和全部旧 turn/call TTL 保持原期限；每次 prepare/new call 独立核验当前授权。Backend 关闭、凭据/绑定改变、撤权或 owner 退出立即失效，不能从 SQL 历史重建。

`worker-json-v1` 只标识同一 worker 冻结的 parsed argument 值：domain bytes + 固定 serde_json 对 `Option<Map<String, Value>>` 的序列化后 SHA-256。省略为 null，显式空对象为 `{}`，Host 不重算。先完成参数 schema 校验与已资格默认值，再冻结；最终调用使用同一份值，登记后变更需要新调用/审批。它不是签名，也不宣称跨语言通用 JSON canonicalization。

## 源复用、生成与同步

CanonicalId、Revision、ServiceId、SelectionRef 直接引用已有 market-connectors 源；SelectionSnapshot/SelectionDigest 引用原 market-selection 源。Rust/Go 控制 DTO alias 借用生成类型。原 Rust selection 文件含 Desktop model 模块路径，因此新增仅含原 Snapshot 的 portable 同源投影，不复制完整提交 DTO；SelectionRef 仍直接 alias 原生成类型。摘要 helper 从已校验的旧 Rust 生成文件机械选取；Go 使用原 digest.gen.go，仅追加原 Snapshot 的同源类型。没有新的模型 Profile 或影子 wire DTO。

`market-broker-source.mjs` 只解析明确登记的本地源，并验证 manifest 的封闭字段、方法和 limits。`market-broker-codegen.mjs` 复用现有 market generator 的有限 schema 投影方式与已装依赖，独立生成严格 Go/Rust types；没有新增第三方 generator 或修改旧 pin。Makefile 和完整 schema lint 显式登记本族。

```sh
make market-broker-generate
make market-broker-check
make market-broker-test
node scripts/sync-market-broker.mjs --consumer=connectors
node scripts/sync-market-broker.mjs --consumer=agent-host
```

Rust 消费文件为 Connectors `worker/src/broker_generated.rs` 和 `selection_generated.rs`；Go 为 Host `internal/contracts/marketbrokercontrol`、`marketselection` 与原 `marketconnectors`。Go import 只做声明的机械路径替换，consumer candidate 另外记录转换后 hash；Rust 字节不改。source.lock 使用实际 base commit 和源/输出 SHA-256、`local_worktree_candidate`、`release=false`，不发明尚不存在的 commit/tag。

## 验证和发布限制

专项包含 7 个 JS、5 个 Go、6 个 Rust conformance，另复用旧 Go selection 2 项和 Rust digest 向量；Rust Clippy 与完整 make lint 通过。正常合成数据测试 required/closed/null、合法域、TTL 上限、metadata 片段、portable Snapshot 摘要、response 丢弃未知字段和安全错误。没有真实外部 MCP/模型/账户/Keyring、攻击 fixture、权限破坏或强杀。状态机和实际 Gateway transport 的行为由两端单独验证，编译不构成 D4。

全量 `make generate`/`make test` 会包含已有危险归档 fixture 生成和 injection fixture 测试；本轮按用户安全条款跳过这部分，使用仓库既有 safe generation/check 及其余正常测试。不能宣称这些未运行步骤通过。完整命令与 baseline 结果记录在 `market-broker-control-validation-2026-10-07.md`。

本族无已发布 baseline，明确 fallback 为 `1a213ac8383e95ac6ec69363937687904fa3591c`，并保留旧支持基线 `f16a497e1377f45747f8ff9292b4b60cf2027f88`、`6f632f155eacdaf93df0e0b00b5dab9e369c5442`、`811f38d6b104fa18477107e7ac91a85e19c445d1`。本地 draft 可以并行；生产前仍需契约 Owner/consumer 确认、不可变源 commit/tag、逐仓 pin 和真实资格。回滚关闭新 worker/Host 装配，保留 Native 选集记录隔离，不降级到旧 submit 或以历史记录重建能力。
