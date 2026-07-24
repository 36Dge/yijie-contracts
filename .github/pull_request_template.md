# Contract Change

## 背景与业务语义

说明为什么需要变化、成功/失败行为以及非目标。

## Contract Impact

<!-- 按 breaking > semantic > additive > none 的最高风险只选一个；当前由 reviewer 审核，PR-body 自动校验尚未接通。 -->

- [ ] `contract-impact: none`
- [ ] `contract-impact: additive`
- [ ] `contract-impact: semantic`
- [ ] `contract-impact: breaking`

分类理由：

## 权威源与参与方

- Contract ID：
- 权威源路径：
- Owner：
- Producer：
- 已知/登记 Consumers（公开未知填 `unknown-public`）：
- Consumer Owner 逐项 review / 例外：
- 外部/Runtime 权威源及固定版本（不涉及填 `N/A`）：

## 语义与兼容方向

- [ ] request/input
- [ ] response/output
- [ ] event/stream
- [ ] auth/scope/approval/audit
- [ ] error/idempotency/retry/order
- [ ] SDK public surface

说明 required/null/default/enum、状态/错误、单位/时区、顺序/重复/重放/终态，以及
旧 producer/consumer 的 decoder/validator 行为。

## 生成与验证

- [ ] 所有受影响且适用的源契约、示例/fixture 和生成物在同一变更；N/A 已说明
- [ ] `make generate`
- [ ] 完整 generated diff 已审查
- [ ] `make lint`
- [ ] `make test`
- 所有适用 Breaking 基线；无已发布版本时的 fallback 完整 commit：
- 各基线 Breaking 结果：
- 人工语义兼容结论：

## 可消费引用与下游

- Contract PR：
- 计划 tag / 合并后完整 commit：
- 下游 version / commit / digest / generator pin：
- Producer conformance：
- Consumer conformance：
- 关联下游 PR：

未创建的 tag 必须标记为“候选”，不得填成已发布。契约 PR 合并前完整 commit 可写
`pending merge`；跨仓交付完成时必须补最终不可变引用。

## 合并、部署与回滚

- 合并顺序：
- 部署顺序：
- 兼容窗口：
- 迁移 / 双轨 / 弃用 / 清理：
- 灰度与观测：
- 回滚：
- 临时例外、批准证据、跟踪 Issue 及到期日（不涉及填 `N/A`）：
