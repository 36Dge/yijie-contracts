# Supported Contract Baselines

## 当前状态（2026-07-24）

### 已发布支持基线

当前没有已发布、可用于生产的 contracts tag，因此也没有 `supported` 或
`deprecating` 基线。

### 当前候选

- 计划版本：`0.2.0`
- 计划 tag：`contracts-v0.2.0`（尚未创建）
- 最终候选完整 commit：待本次候选变更合并后记录；不得在同一 commit 中自引用
- 状态：`candidate`
- 用途：仅允许从干净、可获取的远端完整 commit 做非生产跨仓集成

### 首版 fallback breaking 基线

在没有已发布基线期间，所有发布评审必须相对
`c51c6d424a6706724ce6dfbbb7511e644694adb4` 执行并记录 breaking check。该 commit
是本政策建立时的 `origin/main`，只是为防止“零基线”检查真空而登记的 fallback，
不是已发布版本、生产支持声明或下游消费引用。fallback 变更必须由契约 Owner 在 PR
中说明理由并更新本文件，不能静默跟随浮动 `origin/main`。

因此在 `contracts-v0.2.0` 创建前：

- breaking check 使用上面的完整 fallback commit，而不是只写 `origin/main`；
- 下游只能把最终候选完整 commit 标为非生产集成引用；
- 不得声称已有生产支持窗口或把计划 tag 写成已发布；
- Agent Host、Desktop 和其它 consumers 不能据此宣称 supported/release-ready。

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
