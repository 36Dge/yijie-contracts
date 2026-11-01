# 普通回答终态与资源检查展示

2026-11-01，`contract-impact = semantic`，用户授权本机开发链路修复。Producer/consumer：yijie-codex → yijie-agent-host → yijie-desktop。Runtime 权威为 `0013-answer-completion.patch`；Host 展示权威为 native-conversation-v4 的 NativeMcpDisplay。新增来源均须经 canonical 生成、同步和定向验证后才激活；不声明生产发布或未完成的 consumer review。

普通聊天将过程说明结束转为同轮、有上限、禁止额外工具执行的回答补全。正常答案、结构化输出及权限保持；最多两次后仍缺结果产生已有 failed 终态。无新 RPC、字段或 enum，269 份 Runtime schema 必须与原版本完全相同。Warning/Error code 是已有自由字符串，新增 allowlisted `answer_completion_continuing`、`answer_completion_tools_blocked`、`answer_completion_failed`；旧端对未知提示保留现有兜底，终态仍可准确识别。

Native `list_mcp_resources`/`list_mcp_resource_templates` 允许显示经校验的真实资源数量与名称/标题；空数组显示“未发现可用资源”。不透传 URI、分页 cursor、meta 或任意结构化内容。复用既有 text/index/resultKind/diagnostics、脱敏与容量边界；其他 MCP 类型的权限与展示规则保持。信息部分可用不再等同执行状态未知，前端可以独立展示已观察到的成功/失败状态。

兼容：旧数据包含被省略的结果时保持原记录，不把省略推断为空数组，不在前端猜测工具结果；新结果使用旧端支持的 text 形状。结束后的空思考只影响阅读布局，不删除历史。无数据库迁移，原记录与归档格式不变。回滚在正常退出后恢复精确来源与原固定开发入口，不能用旧回执替新产物背书。
