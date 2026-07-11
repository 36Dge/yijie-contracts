# SDK Generation

```bash
pnpm install --frozen-lockfile
pnpm generate
pnpm lint
pnpm test
pnpm breaking
```

- OpenAPI：`openapi-typescript` 生成 TypeScript 类型，`oapi-codegen` 生成 Go client 和类型；
- Protobuf：Buf 调用固定在仓库依赖中的 Go 与 TypeScript 插件；
- JSON Schema：Ajv 负责 Draft 2020-12 校验，`json-schema-to-typescript` 生成类型；
- Breaking check：oasdiff、Buf 和仓库内 JSON Schema 兼容性检查共同执行。

生成产物提交到仓库。CI 会重新生成并执行 `git diff --exit-code`，防止契约与 SDK 漂移。
