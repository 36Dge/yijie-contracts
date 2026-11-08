# 上下文统计重开恢复

2026-11-08，`contract-impact = semantic`，本地 context-window 0.2.0 候选。
用户确认已完成聊天重开后缺少用量是缺陷，授权审计与修复。Owner：Agent Runtime Team；
producer：Host；consumer：Desktop。JSON/IPC 的字段、枚举、权限与版本号 1 不变；
修复冷读默认行为，旧消费者仍解释为“当前模型/窗口最近一次统计”。

原生已持久化 `event_msg/token_count.info`。`core/src/session/mod.rs` 的
`last_token_info_from_rollout` 与 app-server `token_usage_replay.rs` 原生恢复即使用该数据。
`thread/read` 没有统计字段，`thread/resume` 会加载执行会话，不能为展示而调用。
只读适配先通过既有 `thread/read(includeTurns=false)` 取得当前线程的原生 `path`，
仅在受管 CODEX_HOME 的 sessions/archived_sessions 内打开同一线程的普通文件；
逐级文件描述符只读打开，不跟随符号链接、不改变权限，不把路径或内容传给前端。

固定 native rust-v0.144.6 协议来源是 `codex-rs/protocol/src/protocol.rs`：

- RolloutLine 的 timestamp/type/payload；SessionMeta.id/cli_version；
- TurnContextItem.turn_id/model 与 task_started.turn_id；
- TokenUsageInfo.last_token_usage/total_token_usage/model_context_window；
- CompactedItem 与 contextCompaction 的 item_started/item_completed 边界；
- thread_rolled_back 使不能确认的旧统计失效。

数字只做 snake_case → canonical v2 camelCase 的机械字段适配，复用现有原生 schema
验证；绝不从文本、文件大小或模型目录估算。忽略重复 TokenCount 对新轮次的错误归属，
整理开始先撤掉旧样本，只有原生新窗口统计才恢复。时间保留原生事件时间。
只扫描元数据，不保存系统指令、消息、工具结果正文或供应商凭据。

Host 私有 TurnOperation 新增可选 `context_model_revision`，在原有提交事务中记录
当时模型版本，仅用于冷读展示归属，不参与接纳、重试、执行或计费。旧 reader 忽略
该字段；没有字段的旧记录保持原样，初始模型版本 0/1 且没有模型切换操作记录时，
可在原生模型/轮次匹配后恢复。
旧数据在多次模型切换后无法证明归属时保持未知，不假定“切回同一模型”等于同一窗口。
无需新 bucket、schema migration、重写旧记录或建立第二份 Token 历史库。

这是受控只读适配，复用原生统计而非重建上下文。原生文件 path 标记为 unstable，
仅支持当前已校验 Runtime；源摘要加入 source.lock，同源普通事件样本与实际原生日志
验证字段。Owner 在首次生产发布前必须重新审查此文件层适配；原生稳定只读查询暴露
同等字段后替换它。此本地候选不声称已完成生产协议长期兼容。

兼容顺序：生成与校验来源 → Host → 原有 Desktop；回滚旧 Host 会重新显示未知，
不改原生统计或历史，不影响执行；私有新增字段可被旧 reader 丢弃。即时 fallback 为
`c24d73fde83a01b5dd2a9ded8defb5bbef34e311`，既有族不改。测试只用正常回环、
正常重开及读取已完成的真实聊天；不发新模型请求，不制造崩溃/权限故障/攻击 fixture。
