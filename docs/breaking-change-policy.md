# Breaking Change Policy

Breaking change 必须：

- 增加新字段或新版本接口；
- 保留旧字段兼容期；
- 更新 SDK；
- 更新迁移文档；
- 通知依赖仓库。

提交 PR 前运行 `pnpm breaking`。CI 会相对 `origin/main` 使用 oasdiff、Buf 和 JSON Schema 兼容性检查阻止未迁移的破坏性变更。
