# AGENTS.md

## 仓库职责

`yijie-contracts` 是 OpenAPI、Protobuf、AsyncAPI、JSON Schema 和 SDK 生成中心。

## 禁止事项

- 不实现业务逻辑；
- 不访问数据库；
- 不放真实 token 或商家数据；
- 不在下游仓库手写重复 DTO。

## 开发命令

```bash
pnpm generate
pnpm lint
pnpm test
```
