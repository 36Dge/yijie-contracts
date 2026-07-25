# Supported Contract Baselines

## 当前状态（2026-07-25）

### 已发布支持基线

- 版本：`0.2.0`
- 不可移动 tag：`contracts-v0.2.0`
- 完整 commit：`f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 状态：`supported`
- 远端可用性：本地 commit/tag 已创建；本轮未执行 push，推送后必须复核远端 tag
  provenance
- producer/Owner：`yijie-agent-host` / Agent Runtime Team
- 已验证 consumer：`yijie-agent-host`
  `34e94acf293f6daad61c4d42fa47028a2d1318e4`
- 支持范围：Agent Host Runtime Baseline 2 的本机 HTTP/SSE、Agent session event 和
  Codex Runtime `0.144.6` 稳定投影
- 尚未进入范围：Desktop 正式消费、cloud runner、平台身份、MCP、工具和审批
- 兼容窗口：在明确登记 deprecation/unsupported 条件前持续支持
- 回滚：回退 Host 的契约 snapshot 并禁用 Baseline 2 对外接口；这是首个支持版本，
  没有更早的已发布 contracts tag 可回退

### 当前候选

当前没有待晋升的 contracts candidate。

### `0.2.0` 首版登记的 fallback breaking 证据

`contracts-v0.2.0` 发布评审已相对
`c51c6d424a6706724ce6dfbbb7511e644694adb4` 执行并记录 breaking check。该 commit
是本政策建立时的 `origin/main`，只是为防止“零基线”检查真空而登记的 fallback，
不是已发布版本、生产支持声明或下游消费引用。结果为 OpenAPI、AsyncAPI 和 JSON
Schema 均无结构性 breaking change，并由 Agent Runtime/Contracts Owner 完成人工语义
复核：本次只更新精确 Runtime repository provenance，不改变 Runtime 方法、通知、
transport、schema、权限或失败语义。

从下一次契约变更开始，breaking check 必须至少包含
`contracts-v0.2.0^{commit}` 对应的完整 commit
`f16a497e1377f45747f8ff9292b4b60cf2027f88`；不得继续使用首版 fallback 代替已发布
支持基线。

## 发布后维护规则

tag 创建且下游验证其解析到已测试的同一 commit、digest 未变后，在后续 registry
变更中把候选移入“已发布支持基线”，并记录：

- version、不可移动 tag 和完整 commit；
- 支持状态：`supported | deprecating | unsupported`；
- 生产环境/consumer 范围；
- 兼容窗口结束条件与日期；
- migration、回滚和 release note。

breaking/semantic 评审必须覆盖表中所有 `supported` 和 `deprecating` 基线，以及任何
仍在生产兼容窗口的已登记历史/紧急例外 commit。只有观测证明无有效 consumer，且弃用
流程完成后，才能把基线改为 `unsupported` 并停止检查。未打 tag 的生产 commit 只允许
作为已登记的历史遗留或获批紧急例外，不能成为新发布的常规路径。
