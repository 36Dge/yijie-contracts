# ADR-0001: Contract First Development

## 状态

Accepted

## 日期

2026-07-04

## 决策

所有 API、事件和 schema 先在 `yijie-contracts` 定义，再由下游仓库实现。

## 后续执行规范

本 ADR 保留最初的仓库决策记录。当前的触发边界、权威源特例、方向性兼容、不可变
引用、下游合并门禁和例外流程以
[`docs/contract-change-policy.md`](../contract-change-policy.md) 为准。

“先定义”允许在契约草案稳定后并行编写下游 draft，但契约必须先通过评审和门禁、
形成可消费的不可变引用；每个下游 PR 在自身合并前完成精确 pin 和符合性测试，功能
启用顺序再按输入/输出/事件方向决定。
