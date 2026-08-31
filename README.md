# yijie-contracts

多仓 API 契约中心，负责 OpenAPI、Protobuf、AsyncAPI、JSON Schema、Runtime 兼容矩阵和 SDK 生成。

当前 supported 版本 `contracts-v0.2.0` 提供 Agent Host HTTP/SSE OpenAPI、严格的 8 类
Agent session 事件联合类型、Codex Runtime `0.144.6` 兼容清单，以及可消费的
Go/TypeScript/AsyncAPI 生成物。发布和回滚顺序见
[`docs/releases/contracts-v0.2.0.md`](docs/releases/contracts-v0.2.0.md)。

当前 `0.3.0` candidate 在保持 `contracts-v0.2.0` 支持窗口与既有 Public operations
不变的前提下，包含 FEAT-125 authenticated tenant/capability projection、FEAT-126
versioned content-free control plane，以及 FEAT-127 ordered multimodal turn。FEAT-127 以
`POST /v2/agent-sessions/{agent_session_id}/turns` 增加 Host 输入表面，并为 `ChatMessage`
增加 optional ordered `contentBlocks`，同时保留 required legacy `content`；其最高影响分类为
`semantic`。FEAT-127 的 source/generated implementation checkpoint 为完整 commit
`ebdd30f076614ebc7f5149aebf70e851b81ff32b`；后续 candidate reconciliation 修正 canonical
fixture 并补齐 consumer provenance。为避免上游文档与下游 commit 形成循环引用，最终
Contracts/Host/Desktop 完整 SHA、consumer pin 和 conformance 结果统一由 FEAT-127 交付包或 PR
登记。Desktop 的 Rust wire DTO 暂以显式 adapter、同源 fixture/schema conformance 和有期限例外
治理，不冒充已批准的 Rust generator。

`contracts-v0.3.0` 尚未创建；完整 commit 可用于本地/非生产验证，但 candidate 不等于
supported/release-ready。FEAT-127 本地 candidate 的 semantic Owner/consumer review 已于
2026-08-19 批准，但不构成 tag、publish 或生产批准；本轮 reconciliation 的最终完整 SHA 在
提交形成后由外部交付包或 PR 登记，避免文档自引用。不可移动 tag 延至正式发布阶段创建；tag
创建并核对 digest 后，下游才能按评审结论切换 provenance 并声明 supported。候选范围和门禁见
[`docs/releases/contracts-v0.3.0.md`](docs/releases/contracts-v0.3.0.md)。

当前 `0.4.0` candidate 在 `0.3.0` candidate 上增加 FEAT-128 structured chat artifacts：
显式协商的 AgentSessionEventV3、四类 closed Artifact 生命周期、owner-only
content/poster GET/HEAD、幂等 Desktop commit ACK，以及 closed ReportDocumentV1。
本候选只授权 exact-local synthetic fixture；真实 provider/tool producer、Host/Desktop
业务实现、tag、publish、supported 晋升和生产激活均未获授权。S1/S2 权威源、生成物和
双基线检查完成后，最终不可变 commit 由 FEAT-128 交付包登记；下游 exact pin 未完成前
G2A 保持 Pending。范围和证据要求见
[`docs/releases/contracts-v0.4.0.md`](docs/releases/contracts-v0.4.0.md)。

当前 `0.5.1` local candidate 在 FEAT-129 `0.5.0` 基础上增加 Catalog First 语义：
`catalog-only + blocked` 条目可只携带合规元数据和稳定阻断原因，不能携带归档或入口；
installable 条目的来源、许可、摘要和归档要求保持不变。38 项合成 fixture 固定五类
`5/9/7/9/8` 目录与 Host 查询投影，但不授权打包许可未核实的产品 Skill，也不授权
tag、publish 或生产启用。范围与顺序见
[`docs/releases/contracts-v0.5.1.md`](docs/releases/contracts-v0.5.1.md) 和
[`docs/agent-host-skills-v1.md`](docs/agent-host-skills-v1.md)。

当前 `0.6.0` local candidate 为 FEAT-134 增加显式协商的 AgentSessionEventV4：
AgentMessage lifecycle 携带 closed `commentary | final_answer | null` phase，稳定
`turn/plan/updated` 以完整有序快照表达计划，v3 的 reasoning/artifact 表面原样保留。
候选只允许 exact `demo_fast/local` Feature gate；Runtime 仍固定 `0.144.6`、
`experimentalApi=false`，不修改/升级/重编译 Runtime，不增加推理强度 UI，也不影响
public/production。范围、顺序和语义见
[`docs/releases/contracts-v0.6.0.md`](docs/releases/contracts-v0.6.0.md) 与
[`docs/agent-session-events-v4.md`](docs/agent-session-events-v4.md)。

当前 `0.7.0` local candidate 为 FEAT-136 增加显式协商的 AgentSessionEventV5：复用
`item.started`/`item.completed` 承载 closed Command/Tool typed snapshots，并新增 bounded
`item.command_output.delta` 与 `item.tool.progress`。V5 只允许 safe summary、结构化
relative/redacted cwd、stable status/error/truncation 和 completed authoritative snapshot；缺失
Command aggregate 显式映射为 unavailable，unknown Tool identity 使用固定 sentinel，generic Item
使用 closed stable allowlist，并按 `event_id` 而非字符串内容去重。Raw command、absolute cwd、
Tool arguments/result/meta、token、secret 和 Runtime wire 均不进入 Desktop contract。Contracts
冻结的是字段/形状与脱敏顺序；Host/Desktop 已有 reviewed draft，但仍需按本次新 provenance
精确 repin 和复跑 conformance。JSON Schema 是
validity authority；Proto3 仅是 typed transport，adapter 必须拒绝所有不符合 JSON 语义的可解码
message。V1-v4 保持不变；Runtime 固定为
`yijie-codex@b2b20e2fc4a0c94834f34d8cc459e488a1b56277`、`0.144.6`、267 schemas、
`experimentalApi=false`，并按 `0001` → `0002` 补齐 early sandbox-denial 的 canonical Command
started/failed lifecycle。隔离 release build、Schema 零差异比较和 Runtime→Contracts 双向检查已通过。
本候选不注册 MCP/Connector、不建立真实 Tool producer、不把 Host/Desktop 或 D4 冒充为 Contracts
自身能力，也不包含已排除的
FileChange/Diff/approval。范围与语义见
[`docs/releases/contracts-v0.7.0.md`](docs/releases/contracts-v0.7.0.md) 与
[`docs/agent-session-events-v5.md`](docs/agent-session-events-v5.md)。

同一未发布 `0.7.0` candidate 的 FEAT-137 source-first 修订新增独立协商的
AgentSessionEventV6、owner-only pending snapshot 与 one-shot decision API。V6 完整保留 v1-v5，
只增加固定 `git_repository_check` 的 `approval.requested/resolved`、Host opaque identity、
`accept_once/cancel_current_turn`、120 秒 TTL 与 closed stable errors；Runtime RequestId、command、
cwd、reason、permission/amendment、`availableDecisions` 和 raw wire 不进入 Yijie contract。当前
Runtime v1 compatibility manifest 仍逐字节保持 `read-only/never`。独立的
`compatibility/agent-host-runtime-approval-v6-v2.json` 冻结一个不提升权限的 Runtime-owned
exec-policy `Prompt` producer、pinned `/bin/zsh -lc` transport wrapper、唯一 allowlisted
`commandAction` business authority、bounded validate-then-discard `reason`、generation-scoped
replay、120 秒 Host-monotonic TTL、accept/cancel 与
`serverRequest/resolved` 语义，不改变当前实现 manifest。见
[`docs/agent-session-events-v6.md`](docs/agent-session-events-v6.md)。

跨仓契约变更必须遵循
[`docs/contract-change-policy.md`](docs/contract-change-policy.md)：先分类影响、修改权威
源并完成生成/兼容评审，形成不可变引用；每个下游 PR 在自身合并前完成精确 pin 和
符合性测试，功能启用顺序再按输入/输出/事件方向决定。
当前候选与生产支持基线见
[`docs/supported-baselines.md`](docs/supported-baselines.md)。

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm generate
pnpm lint
pnpm test
pnpm breaking
pnpm pack:sdk
```

## 质量门禁

`pnpm generate` 从 OpenAPI、Protobuf 和 JSON Schema 生成 TypeScript/Go SDK，并把 AsyncAPI 打包为单文件产物。`pnpm lint` 使用 Redocly、Ajv、Buf、TypeScript 和 Go Vet 校验契约与生成代码；`pnpm breaking` 相对 `main` 检查 OpenAPI、Protobuf、JSON Schema 和 AsyncAPI 的结构性破坏。`pnpm pack:sdk` 只生成本地 tarball；registry 尚未确定，不会发布外部包。

结构性 breaking check 绿色不等于语义、实现或端到端兼容。请求字段、响应字段、enum
和事件必须按 producer/consumer 方向评审并测试。
