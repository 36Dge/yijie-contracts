# FEAT-172 应用内置图片 MCP（本地候选）

整体迁移 `contract-impact=breaking`：旧原生入口停用、内置凭据改为运营方预置。固定 Runtime 协议不变，无产品过渡/历史迁移。Owner 为 Agent Runtime Team；用户已接受实施，并追加选定专家不可用不使用内置兜底。

`jsonschema/media-generation/v1.schema.json` 是 MCP 输入、封闭结果与私有 Host 桥接的源。Host 生成图片，应用自带 MCP 转接，Runtime 通过原生工具发现/执行；Host native display 消费同源 Go DTO。没有 Desktop 新 IPC 或专家提交变更。

`document-runtime/v1` 的 AdapterStartup 增加可选 `media` 对象，包含 MCP capability 和独立 Host bridge token；已有未带 media 的消息仍被新 adapter 接受。新消息只能发给同次构建的新 adapter。旧 tool/status DTO 保持，Artifact status 可在文档功能关闭时查询。

本地 generation/consumer checks：

```sh
node scripts/generate-media-generation.mjs --consumer=host --check
node scripts/generate-document-runtime.mjs --consumer=host --check
node scripts/generate-document-runtime.mjs --consumer=desktop --check
node --test tests/media-generation.test.mjs tests/document-runtime.test.mjs
```

锁记录 `local_worktree_candidate`、release=false，未发布 tag。实施前完整基线为 `d658a2bd5dd6ebd5ae5c79a547489eca205d6ede`，原支持窗口保持。该基线结构比较通过不等同于新应用对旧应用的行为兼容；当前直接切换由用户明确授权。

Host、adapter、launcher 按同源检查一起构建/激活；回退应整体回退该应用源码/构建，不能重新打开旧原生 producer。重复调用/未知结果不会授权重新派单，只有用户改变/移除专家后的新请求可恢复内置路由。

2026-11-12实现复审修订为 `contract-impact=semantic`：MCP HTTP与原生通知是独立连接，仅对Host已经准备的根轮次等待原生身份绑定，最多5000ms；未绑定超时返回既有`state_pending`，未占用本轮生成名额，供应商调用为0。取消或绑定不符仍拒绝。原生终态只能关闭匹配轮次；已发布的成功回执不因稍后的取消改写。字段、枚举、固定Runtime及专家选择协议不变，现有adapter无需新响应解析；新Host可直接使用现有adapter。上述语义修复复用同一未发布候选与比较基线，不新增发布版本。
