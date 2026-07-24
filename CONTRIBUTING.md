# Contributing

## Contract First

所有变更先按 [`docs/contract-change-policy.md`](docs/contract-change-policy.md) 标记
`contract-impact = none | additive | semantic | breaking`。`none` 必须说明没有
跨进程、跨仓库、跨版本或持久化/重放边界的可观察变化。

涉及契约时必须：

1. 明确权威源、Owner、producer、全部已知/登记 consumers、输入/输出方向及安全/失败语义；
2. 先在本仓完成所有受影响且适用的源契约、示例、生成物、测试、版本和迁移/发布说明；
3. 执行 `make generate && make lint && make test`，并逐一检查所有适用 breaking 基线；尚无发布版本时使用 `docs/supported-baselines.md` 登记的 fallback 完整 commit；
4. 按影响级别取得代表性或全部受影响 consumer Owner 的评审/例外；
5. 契约先合并，形成干净且远端可获取的最终 candidate 完整 commit；
6. 受影响下游先从该 candidate commit 做非生产同步、生成和 conformance，相关实现保持 draft/未启用；
7. 上述验证通过后才创建指向同一 candidate commit 的不可移动 tag；下游验证 tag provenance 与 digest 后再切换为已发布引用；
8. 每个下游 PR 在自身合并前固定 version、tag、完整 commit 和可用时的 digest/generator 身份，并复跑 conformance；
9. 按请求、响应和事件的兼容方向分阶段发布。

下游实现可以在稳定契约草案后作为 draft 并行，但在契约可消费并完成精确 pin 前不得
合并或启用。禁止手改生成物、影子 DTO、dirty sibling 发布来源和跳过 breaking。

## PR 证据

PR 必须按模板填写 contract-impact、权威源、Owner/producer/已知 consumers、分级
consumer review/例外、全部适用 breaking 基线（尚无发布版本时为已登记 fallback 完整
commit）、生成物、计划/不可变引用、下游
pin、合并/部署顺序、迁移和回滚。
自动结构检查绿色不能替代语义与 consumer 兼容评审。
