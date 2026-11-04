# 原生公开消息适配：语义兼容记录

2026-11-05 Owner 明确批准限定候选，`contract-impact = semantic`。权威源为
yijie-codex 的 0016 canonical patch/build/schema；本仓通过既有生成器固定
完整 Runtime commit、补丁和构建源码 digest、binary/manifest/schema identity。
生产/签名发布不在批准范围，不推送。

普通用户回合可由模型在实际 assistant Message 首行声明 commentary/final_answer。
Runtime 消费声明，保持真实 ID、顺序和原生消息生命周期，使用现有执行循环
继续；简单任务允许直接最终答案。不在 Host/Native/UI 复制执行循环或分割正文。

**阶段来源必须分清**：原始 Provider ResponseItem.phase 缺失时仍为缺失，原始
正文连同声明保留并进入下一次模型请求。公开 AgentMessage.phase 可以是 Runtime
校验显式模型声明后的有效阶段；它不是“供应商已提供原生 phase”的证据。原生
phase 存在时优先保留，无有效声明的未知阶段不猜写。展示重开读取规范化公开
消息；原始事实追溯读取 Runtime ResponseItem，两者不能混为一份数据的改写。

只增加 opted-in 新轮的原生语义，不增加公共 Item 类型/字段/阶段枚举，不改变
Native6/SSE13/IPC6/SQL45 的数据形状。已有 reader 能消费相同的公开阶段和正文；
旧记录无声明继续原样读取。仍须实际 schema 对照、最保守适用基线兼容检查和
两个历史闭环验证，不能仅据字段未变宣称兼容。

已知消费者为 Host 原生映射、Desktop Native format6 保存/重开、IPC6/Store/UI。
顺序：Runtime 候选固定 → 本投影生成与不可变引用 → Host 同源消费 → Native/UI
离线与真实验收后正常激活。期间不得给旧 Runtime 注入只有新候选能消费的声明。
Host 只在精确 candidate 的普通用户路径注入，内部标题/结构化 draft 排除。

回退关闭新轮声明并恢复匹配的 Runtime/Host 策略；已保存的公开消息是原生既有
字段，保留可读，不回填原始 phase、不删库、不迁移。不把回退旧源码理解为回滚
数据库或回收模型用量。真实模型是否遵循声明、是否生成有意义的更新须单独验收，
当前源码/生成检查不是生成质量结论。

本地生成/同源检查、全仓 lint 及相对当前消费基线
`85020c2929aaddc19cd81e728c9a3d5f127146b8` 的完整结构兼容检查通过。
Runtime schema 269 份及其树摘要不变。所跑 14 项 Runtime 检查中 12 通过，
1 个已退役 FEAT-137 旧制品缺失项跳过，1 个该旧 family 的冻结检查因强求当前
Runtime HEAD 等于旧 `9ed24710…` 而失败。原检查不改、不记全仓测试通过；
当前 native input-only/公开消息依赖的定向检查实际通过。后续仍需 Host/Native
真实候选消费证明，不用旧 family 的状态替代本候选验证。
