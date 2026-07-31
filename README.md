# yijie-contracts

多仓 API 契约中心，负责 OpenAPI、Protobuf、AsyncAPI、JSON Schema、Runtime 兼容矩阵和 SDK 生成。

当前 supported 版本 `contracts-v0.2.0` 提供 Agent Host HTTP/SSE OpenAPI、严格的 8 类
Agent session 事件联合类型、Codex Runtime `0.144.6` 兼容清单，以及可消费的
Go/TypeScript/AsyncAPI 生成物。发布和回滚顺序见
[`docs/releases/contracts-v0.2.0.md`](docs/releases/contracts-v0.2.0.md)。

当前 `0.3.0` candidate 在保持 `contracts-v0.2.0` 支持窗口与既有 Public operations
不变的前提下，新增 authenticated tenant discovery 与 capability projection。它尚未
tag、尚未通过 API/Desktop conformance，也不是 supported release；候选范围和门禁见
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
