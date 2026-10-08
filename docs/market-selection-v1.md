# FEAT-157 market-selection/1 本地候选

2026-10-07。Owner：段成威；producer：Desktop Native；当前 consumer：Desktop renderer、Native SQLCipher 出站队列；后续 Host/Connectors 必须各自先获得正式执行协议，不能将本源解释为已经存在的 Host 端点。新增源为 additive，整体 FEAT-157 按 breaking 管理，尤其 durable outbox 与兼容回滚。用户已授权按需求包实施；没有 tag、commit pin、发布或外部账户授权。

Wire 权威源是 `compatibility/market-selection/wire.schema.json`；独立私有 IPC manifest `compatibility/market-selection/native-ipc.json` 登记版本、Native command、摘要编码和非 wire 的生命周期语义。它们独立于已有 55defs/9IPC 的 market-connectors。新族没有 HTTP API，也不使用 OpenAPI 包装；一个 Native command `chat_market_submit_v1` 明确接受普通聊天目标、内容、模型意图与选集，不包装旧请求然后暗改其执行语义。

这里 `wire.schema.json` 是唯一 wire 源，尽管位于 `compatibility/`，并不是某个另存源的兼容快照。选择与私有 IPC manifest 共址，是因为本族不属于公共 HTTP/通用 SDK，且旧 pinned generator 只泛扫 `jsonschema/`。旧 OpenAPI 包装和临时 `jsonschema/chat/` 路径均已移除，不能保留 shadow source；`sdks/jsonschema/market-selection.schema.json` 仅为严格同源的生成投影。旧 `scripts/generate.mjs` 与其 pin 字节不变。Makefile 的 generate/lint/test/build 分别显式依赖本族 canonical generate/check/test/check，Desktop 的原生检查也显式执行本族同步检查。

## 源复用与生成

`SelectionRef/CanonicalId` 引用 market-connectors 源，`ProfileId/Revision` 引用 chat-models 源，文本 block 引用既有 ChatMessage 文本 block。旧 Native model submit 的 payload 只存在 Desktop 私有 Rust 实现，没有可引用的共享源；本源首次正式定义新命令的 Native payload。文件、图片仍只接受 attachmentId，并继续由 Native 验证作用域、大小、失效和实际附件内容，不接受路径或 renderer 元数据。

`market-selection-source.mjs` 严格验证 IPC manifest 的封闭字段、固定 transport/command、schema 引用、编码版本和摘要规则，只解析登记的本地源文件。`generate-market-selection.mjs` 从这些引用机械生成 bundled JSON Schema、Rust、TypeScript 和 Ajv standalone validator；Rust 直接复用旧 generated `SelectionRef` 与 `ProfileId`，不会生成另一套相同 DTO。Go 只生成可复用摘要函数，参数仍 alias 旧 generated SelectionRef。算法向量同源生成，Rust、Go、JS 均对照实际字节与 digest。仓库 JSON Schema lint 复用同一 loader，逐项编译新族全部定义；既有 HTTP lint 规则保持不变。

Ajv/TypeScript 描述结构；Native generated `validate` 另外强制唯一 installationId、最多 10 个附件、已排序 snapshot 和摘要相等。前端校验不代替 Native。所有 request 的未知字段拒绝；response 未知字段忽略且不得回显/持久化/记录。Rust Debug 不打印内容和正文。

显式同步命令：`node scripts/sync-market-selection.mjs --consumer=desktop`；`--check` 检查消费者字节。消费者 Rust 路径是 `src-tauri/src/chat/connectors/selection_generated.rs`。独立候选记录 base commit、真实 source/output SHA-256，`release=false`；dirty sibling 不是不可变可发布 pin。

## 提交与原子快照

新会话 payload 的 `operationId` 是 submission/create operation；Native 在同一事务创建首轮后才知道实际 `turnOperationId`。摘要必须使用后者，不可先在 renderer 计算。`SubmissionReceipt` 分别返回 `submissionOperationId`、`turnOperationId`、`sessionId`、`localTurnId`、`selectionDigest`；`outcome=local_durable_accepted` 只证明本地提交事务已完成，不能投影成 Runtime 已接受。事务提交后的 coordinator 唤醒失败不能把已接受事实改成失败。

Native 事务须同时冻结完整原意图（目标、完整有序内容、模型 profile/revision、选集 refs）、真实 turn operation、排序后的 `SelectionSnapshot`、原回执与 create/turn 两个操作索引。selectionDigest 只表达选集版本，不能代替全文/目标/模型的幂等身份。Native 可从当前目录添加私有安全名称快照，用于历史展示；renderer 不能指定显示名称作为权威，名称不参与权限或 selectionDigest。

同 scope、同 operation、同完整意图返回原回执；异参冲突。已有旧 outbox/turn/model 操作但没有 market snapshot 时必须冲突，不能先回放旧 helper 再补 market 身份。accepted replay 不做新的 prepare/bind/Runtime call；pending/unknown 不生成替代 operation，不自动再次提交原生 turn。

摘要：ASCII domain `yijie.market-selection/v1`、实际 turn operation canonical UUID、十进制 count，各占一行；随后按 installationId ASCII 升序写 `<id> <revision> <generation>`，每行含最终 LF。SHA-256 小写十六进制。UUID 非 nil、整数 1..9007199254740991、最多 51 个独立 installation；空集仍含前三行。它不是签名或能力凭证。

## 准入、回滚与后续步骤

首次实现的 Host versioned provider 未完成：**所有新命令请求，包括空选集，必须在写入 outbox 前返回 execution_unavailable**。可独立验证私有事务冻结 helper，但不能把测试 helper 暴露成可调用 provider，也不能回退旧 submit。非空选集以后还须逐项满足 Native scope/connector.use、当前安装 revision/generation、真实执行资格和可信授权控制面。

空集的最终语义是明确无 market 工具，不能继承上一轮/全局配置。legacy dispatcher 必须排除 market 操作索引；新旧 continuation、模型切换、resume 和 plan 入口不得绕过清空/隔离规则。回滚 reader 保留新表及记录且不执行；不删表、不重写旧记录、不把新记录降为旧请求。

后续先冻结 Host 接口和授权 carrier，再实现同一提交锁内的 accepted replay→prepare→idle cold resume→实际 turn bind；审批需要独立 market 投影和可信 pending-call 查询，不能扩大 Sorftime 单工具证明。当前源不包含 auth token、平台凭据、Gateway URL、broker lease 或有效审批。

## 验证范围

`make market-selection-test` 包含 7 项 JS、2 项 Go、5 项 Rust 和 Rust Clippy。仅使用普通合成 UUID、文本、正常附件引用和空/双项选集向量；不启动 Runtime，不读取用户数据库，不执行外部 MCP、OAuth 或模型。Rust 与 Go 消费既有 generated 类型；旧 family generation 仍须逐字节通过。迁移 Native 源格式前后，18defs 的所有 generated 类型、validator、bundled schema 和 digest 向量均保持逐字节相同，只有源位置和 provenance 更新。

新 family 没有已发布基线，明确 pre-feature fallback `1a213ac8383e95ac6ec69363937687904fa3591c`；已发布/保留支持基线继续为 `f16a497e1377f45747f8ff9292b4b60cf2027f88`、`6f632f155eacdaf93df0e0b00b5dab9e369c5442`、`811f38d6b104fa18477107e7ac91a85e19c445d1`。独立新源不改旧源，但整体发布仍须全部 source-first、consumer pin、兼容和实际执行资格证据。
