# FEAT-132 Native Conversation v1 / SSE v7

2026-09-09，已固定真实提交的本地开发版本；未发布SDK版本或部署。Owner：段成威 / Agent Runtime Team；producer：yijie-agent-host；consumer：yijie-desktop。contract-impact=breaking。

最终按 breaking 管理，因为删除合成生命周期后不能继续承诺旧 Desktop 的语义兼容；必须版本化接入并完成消费者迁移。自动结构检查通过不降低该分类。

源：`openapi/native-conversation/native-conversation.yaml`；上游：`compatibility/agent-host-native-conversation-v1.json` 所固定的 Runtime 0.144.6 / FEAT-136 保留来源。新增 thread/read 安全快照和显式 v7 通知；旧 v1–v6 wire 不删除、不增加其 closed union。

Native ID/phase/status/最终内容是 Codex 事实。字段投影失败属于 availability，不能制造 failed。Host 原生读取只调用 thread/read(includeTurns=true)；不自行读 rollout。NativeEvent 是 text/event-stream 中 data 的 schema，未作为独立 JSON response 引用；Redocly 的 unused-component 提示为已知文档提示。

命令/路径/输出只允许安全 label/text；raw reasoning 继续遵循现有授权开关。未知类型保留 ID 并显示 unavailable。summaryIndex/contentIndex 映射至 index；command 输出 delta 暂只发 pending-final 通知，最终安全输出来自 completed。错误只保留安全消息和 allowlist 中的原生 codexErrorInfo。

序列仅用于传输去重。turn/completed 不提供完整 Item 集合；冷历史 partial。不同来源的 Item ID 不允许客户端猜测 join。HTTP 沿用 loopback bearer、no-store、关联验证和现有错误 envelope。

生成：`pnpm generate:native`。复核：`pnpm check-generated:native` 与 `node scripts/sync-native-conversation.mjs --check --require-committed`。两个consumer的native-conversation.lock.json已固定真实Contracts提交`6f632f155eacdaf93df0e0b00b5dab9e369c5442`及源摘要，provenance=git-commit、published=false。该不可变开发来源不冒充已发布SDK tag；后续仅文档提交无需改变字节完全一致的源契约pin。

兼容验证基线：published supported `f16a497e1377f45747f8ff9292b4b60cf2027f88`；本次工作区基线 `468aecec53cd708286988a221061a2e5ccd2479d`。两次自动 breaking check 通过，但不能据此宣称语义或端到端兼容。旧 Desktop 依赖客户端推断的行为必须与新 Host 分阶段迁移，禁止混用后声明兼容。

正式顺序：Contracts 固定来源 → Host 固定 pin / conformance → Desktop 固定 pin / migration → 正常生命周期与独立验收。退回旧版本不得让旧 Desktop 读写 schema 14 或旧 Host 读写 schema 5；禁止静默降级迁移和重启旧 reducer。FEAT-137 永久退役，FEAT-152 权限语义不变。

2026-09-09原生改造的真实local/demo_fast D4及后续日常入口验证均已通过；十项Must AC通过。用户独立授权累计25次文本、3次图片，实际19次文本、1次图片，日常入口复验未增加调用。安全定向验证与真实模型结果分别记录；未运行禁止的故障/攻击测试。完整来源、限制及证据位于元仓FEAT-132的02-verification.md、03-native-protocol-adjustment.md和05-daily-entry-verification-2026-09-09.md。

## 2026-09-09 来源固定前核验

使用标准 `generate:safe` 完整生成并通过 `check-generated:safe`，已将历史 FEAT-137 compatibility SDK 对齐既有源 schema。仅派生 TS 声明变化；retirement authority、源 schema、Runtime patch/binary、启用开关不变，FEAT-137 不重启。

原生同步脚本新增 `--commit <40位完整SHA>`：读取实际 Git 对象、校验工作树与固定源逐字节一致，生成两个 consumer 的 native-conversation.lock.json；已有 pin 后普通 `--check` 自动使用该 pin，不能静默退回工作树。未提交候选仍明确标为 candidate；canonical 启动强制 `--require-committed`。

最小跨仓集成使用 Host 真实投影 JSON（普通 mock Runtime 输入）→ Desktop 真实 SSE decoder / Native buffer / SQLCipher / 正常 reopen，原生 ID 不改写，已观察 failed 不被冷历史 completed 覆盖。它不调用模型，不代表真实 Runtime/D4。
