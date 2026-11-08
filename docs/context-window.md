# 当前上下文用量与整理状态

2026-11-08，`demo_fast + local`，未发布候选。0.1.0 为 `additive`；当前 0.2.0
重开恢复修复为 `contract-impact = semantic`，JSON/IPC 形状与 schema_version 1 不变。
Owner：Agent Runtime Team / Client Team；producer：Agent Host；consumers：Desktop Native / Vue。

原生依据：固定 `yijie-codex` 的 `core/src/tools/handlers/get_context_remaining.rs` 返回
`tokens_until_compaction`，包含自动压缩阈值/BodyAfterPrefix 口径，不能作为总窗口剩余容量。
`thread/tokenUsage/updated` 的 `last.totalTokens` 与同一事件的 `modelContextWindow` 才用于展示；
`total` 为累计计量，不用于窗口用量。`TurnContext::model_context_window` 已应用有效容量比例。
`recompute_token_usage` 在压缩/换窗后由 Runtime 自身重算；Host/Desktop 不另算 Token。
`thread/read` 没有完整用量快照；resume/fork 可能重放旧统计。无法证明当前模型/窗口归属时不显示。

独立只读 API 与 IPC 保留旧 Native6/SSE13/IPC6/format6 的全部字节与解释。
统计缓存仅在 Host 内存，绑定 thread、Runtime session、model profile/revision 和观察到的 turn。
模型切换、原生 contextCompaction 开始时失效；原生模型 Item 完成之后才接纳请求统计，
整理期间只接纳原生重算样本，避免 rate-limit 通知重新发布旧值。
Host 重启后，首次读取可从同一线程的原生持久统计恢复最近一次样本，保留原生统计时间；
同一模型 revision、轮次与窗口归属必须可证明。无法证明或原生没有样本时仍显示未知，
不从费用、目录容量或聊天文字推算。具体来源与兼容边界见 [重开恢复](context-window-restore.md)。

只读快照每秒读取当前选中的聊天；首次打开额外读取已有原生历史中的整理 Item。
没有模型调用、额外模型轮次、压缩命令、执行策略修改或数据库迁移。统计只存于原生文件；
Host 原有 TurnOperation 仅增加私有可选模型 revision 戳，用于恢复时校验归属。
本机凭据仍仅在 Native/Host，复用原 read_sessions 与 owner-only bearer 边界。
错误、断连、模型切换与会话切换立即撤掉用量；迟到响应不得进入另一聊天。

整理生命周期以原生 Item ID/Turn ID 关联现有 Native Item，不伪造 agentMessage/phase。
公开消息区显示“正在整理上下文 · 可能需要几分钟”→“上下文已更新”。用户已确认中性文案，
因为原生 contextCompaction 不区分自动摘要与 new_context。未观察到完成时绝不显示成功。
开始/完成更新同一条消息；历史读取不能把只有 started 的事件当作完成。
已核对固定 `thread_history::handle_context_compacted`：冷读的 contextCompaction 仅由
`ContextCompacted` 完成事件产生，忽略 started Item，因此该类冷读项可标记完成。
冷读重建 ID 与此前 live ID 可能不同，无法精确匹配的既有未知 Item 保持未知，不按顺序拼接。

兼容顺序：新只读 Host provider → Desktop consumer；旧端不调用新路径、不收到新字段。
回滚只移除新展示和只读 API，保留所有历史及原执行行为。
即时 fallback：`c24d73fde83a01b5dd2a9ded8defb5bbef34e311`；历史基线见 supported-baselines.md。
本族在旧基线不存在，现有源契约不改变。本地 source.lock 记录源和生成物摘要，不能冒充发布 pin。

验收覆盖：最近一次而非累计；容量未知/无样本；0 真值；模型/聊天切换与迟到响应；原生压缩重算；
整理开始/完成/中断、重复事件与历史；悬停、键盘焦点、Escape；亮暗主题与 1180×760。
仅执行正常非破坏性定向验证，不调用真实付费模型、不制造崩溃/权限故障/攻击 fixture。
