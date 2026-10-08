# FEAT-157 Native → Host 私有授权与提交候选

2026-10-07，`market-host/1` 0.1.0，Owner：段成威。新 family 是 additive source；FEAT-157 整体及 Broker 候选升级按 breaking 管理。Native 是授权、提交和用户决定的 producer，Host 是 consumer；响应相反。renderer 仅消费两条 Native IPC 投影。源为 `compatibility/market-host/wire.schema.json`、`transport.json`、`native-ipc.json`，不是旧 Sorftime 或旧 selection18 的扩展。

Native 独占 Host stdin/stdout JSONL，hello 绑定真实 Host instance、Native epoch、owner/tenant。market 模式日志走 stderr。HTTP bearer 只证明本机访问；Trace、UI context ID、UUID 格式均不是授权。hello.ready 表示私有控制可用，不要求模型密钥、付费请求或虚构 Runtime generation。当前 Native 身份值由源借用的 ScopeBinding 校验，不能用合成身份遮盖不匹配。

`grant_register` 通过私有管道冻结完整 Submission：实际 PublicTask taskId、localSessionId、required-nullable agentSessionId、原 submissionOperationId、cwd、原 v2 contentBlocks、Profile/revision、permissionMode、原 SelectionSnapshot 和 ProviderBinding 列表。Native 在当前权限锁下核验 SQL31/32 原意图、授权 revision/mode 和安装代际。新建会话 agentSessionId 为 null，模型创建前 expectedRevision=0，Host 新模型 revision=1；taskId 不等于 localSessionId 或 submissionOperationId。ContentBlocks 直接引用旧 v2 源，不另造附件协议；Host 仍复用原附件总量与输入语义校验。

HTTP POST `/v1/market-chat/submissions` 仅接受 grantRef 和原 turnOperationId。Host 比较完整意图 HMAC，accepted replay 首先返回原 receipt，不再次 prepare、恢复线程或启动模型轮。新提交在一次既有模型操作锁内合并 model/selection 配置；首次 prepare(null) → thread/start → turn/start → bind 真实双 ID，续轮只做一次合并配置。空选集清除 market 工具，不能继承上轮或全局 MCP。pending/uncertain 先恢复原事实，不制造新 operation 自动重跑。

非空 market 只支持 ask；auto/full 返回 `permission_mode_unavailable`，引导改为请求批准。空集保持原三个权限模式。旧 selection18 不增加错误枚举，旧入口可映射既有 execution_unavailable，并在 UI 预检提供具体恢复提示。

只读 GET 分别提供原 operation receipt、审批快照和实际工具 item。三个 GET 都要求 canonical 非 nil UUID 的 `X-Yijie-Market-Request-Id` 并原样回显，只用于关联。`approval_decide` 和 `revoke_authority` 只能走私有管道；旧审批 HTTP 不能批准 market。审批必须指向真实 Broker CallIdentity；ToolObservation 来自实际 native item，callRef/service 可省略，只有明确可信关联才填写，不能按最近 item、工具名或参数猜测。结果只投影受限脱敏文字/状态，审批成功不是工具成功。

renderer 仅有 `chat_market_observe_v1` 和 `chat_market_approval_decide_v1`。前者输入 sessionId、可选 nativeTurnId，输出 managed、原 selectionDisplay 和可选审批/工具快照；未建立 Host session 时省略快照，不伪造 ID。后者只输入 sessionId、approvalId、decisionId、expectedRevision、decision；Native 从本地事实和权限派生 scope、Host IDs、真实 call。TS/AJV 只生成这两个请求/响应及错误的引用闭包，不暴露完整私有控制面。

限制由 transport 源生成：完整控制帧 16 MiB + 64 KiB，普通帧 64 KiB，HTTP trigger 4 KiB；最多 8 个 pending grant、64 MiB 总 grant 内容，TTL 不超过可信 Native 剩余授权或 300 秒，转换一次单调时钟且重放不续期。最多 1024 receipts、128 approvals、128 tool items。管道未知/EOF 必须停止准入、退役 generation，正常等待退出或保留 STOP_PENDING 所有权；不强杀、不自动换进程。权限/安装变化撤销旧授权，expiry 后减少授权的 revoke 仍须可用。

源复用 SelectionRef/Snapshot、Profile、v2 ContentBlocks、Broker Scope/CallIdentity 和 ProviderBinding。`services` 是 ProviderBinding 同源 alias，Native 从 SQL30 派生 opaque credentialRef；secret 始终留 worker/Keyring。五个 provider 控制 wrapper 使用同一源 DTO，转发至同一 Host-owned worker。

生成/验证入口为 `make market-host-generate`、`make market-host-check`、`make market-host-test`。`sync-market-host.mjs --consumer=desktop|agent-host` 只机械同步；Desktop TS 路径为 `src/domain/market-host-native.generated.ts` 和 `src/api/generated/market-host-native-validator.gen.js`。源锁记录实际工作树摘要、base commit、`release=false`，不冒充已发布 pin。验证、基线和未执行项见 [本轮记录](market-host-validation-2026-10-07.md)。

发布前须形成真实 immutable commit/tag、逐仓 pin 和实现符合性证据。当前无新 supported tag；沿用 FEAT-157 四个登记基线。回滚停止新 family 装配并保留隔离 outbox/任务记录，不能降级为 legacy submit 执行。
