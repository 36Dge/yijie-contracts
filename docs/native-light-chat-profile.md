# 显式轻量新聊天配置

2026-11-04，Owner 要求继续实施 P2，并选择默认保留完整模式，仅新聊天可显式选择
轻量问答。ToolProfile 以既有 Agent Host OpenAPI 为唯一权威；Native/市场输入引用
相同定义，禁止复制 native feature/工具列表或实现新工具选择器。

full/省略保持原行为；light 只投影固定 yijie-codex 既有
features.multi_agent=false、features.goals=false。原生负责实际工具注册；权限、
审批、模型、选中连接器、技能和原生预算不变。不通过已被原生忽略的 multiAgentMode
参数实现，Runtime 及 schema 不改。新请求字段须 provider-first 接线后再发送。

选择在原新会话提交事务和 Host 会话索引中固定；恢复/模型切换保留。已有会话
默认 full，不按文本分类，不在中途切换能力。专家和计划草案不接受 light；
已有 light 会话不能静默改成专家，须另开完整聊天。重放原提交比较原模式；
后续轮次省略模式，由持久会话恢复。

公共输入为 additive，整体实施最高影响为 breaking：Native SQL 44 和 Host 12
提供必要的前向读取保护，旧内容与旧记录不回填/重写。回退必须保留新格式 reader，
不能降版本号或清历史。新响应字段不必新增：Native 从本地会话选择显示模式。

Owner/consumer 为本次个人本机修复的 Desktop/Agent Runtime 维护范围；本地
完整 commit 用于 canonical 接线，不发布 tag、不宣称生产兼容或供应商效果验证。
fallback 为实施前 6aa170b649a773961b211c6bda2099d748740624，并检查既有支持基线。
原生机制来源保持 55b4e51049d6f4fc0af4b35f12832357f5e4ea06。
