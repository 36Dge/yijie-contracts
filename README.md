# yijie-contracts

多仓 API 契约中心，负责 OpenAPI、Protobuf、AsyncAPI、JSON Schema、Runtime 兼容矩阵和 SDK 生成。

当前 `0.2.0` 候选版本新增 Agent Host HTTP/SSE OpenAPI、严格的 8 类 Agent session 事件联合类型、Codex Runtime `0.144.6` 兼容清单，以及可消费的 Go/TypeScript/AsyncAPI 生成物。发布和回滚顺序见 [`docs/releases/contracts-v0.2.0.md`](docs/releases/contracts-v0.2.0.md)。

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
