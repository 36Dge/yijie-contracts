# yijie-contracts

多仓 API 契约中心，负责 OpenAPI、Protobuf、AsyncAPI、JSON Schema 和 SDK 生成。

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm generate
pnpm lint
pnpm test
pnpm breaking
```

## 质量门禁

`pnpm generate` 从 OpenAPI、Protobuf 和 JSON Schema 生成 TypeScript/Go SDK。`pnpm lint` 使用 Redocly、Ajv、Buf、TypeScript 和 Go Vet 校验契约与生成代码，`pnpm breaking` 相对 `main` 检查破坏性变更。
