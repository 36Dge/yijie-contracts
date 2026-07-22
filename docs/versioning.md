# Versioning

契约发布使用 `contracts-vX.Y.Z`，SDK 包版本与 tag 中的 `X.Y.Z` 保持一致。

- `main` 或最新已发布 tag 是兼容性基线；
- 新增可选字段、端点、消息或生成物提升 minor 版本；
- 删除、重命名、增加 required 或收紧既有 Schema 约束必须发布新 major 版本，并提供兼容期；
- 第一个可消费的 Agent Host 契约版本为 `contracts-v0.2.0`；在 tag 创建前只视为候选版本；
- tag 只在源契约、生成物、breaking check、迁移/发布说明及下游同步检查全部通过后创建。

TypeScript registry 尚未确定前，CI 只构建并校验本地 SDK 产物，不自动发布到公共 registry。Go 消费者使用 Git tag 固定版本。
