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
