# 原生问答与上下文工具，本地候选 0.2.0

范围仅 request_user_input、get_context_remaining/new_context。最高 contract-impact=breaking；新增独立 family 和精确默认关闭配对，不替换旧 Runtime/审批接口。用户已确认保留自动摘要、仅显式新窗口的策略。Owner 段成威；producer Runtime / Host；consumer Desktop。仅 demo_fast/local，非发布或已批准生产版本；fallback c24d73fde83a01b5dd2a9ded8defb5bbef34e311，原 supported 窗口保持。

Runtime canonical ToolRequestUserInputParams/Response 是问题和回答权威，机械投影 types.openapi.json；公共 HTTP 外层以 openapi/user-input/user-input.yaml 为权威。generate-runtime-interaction-tools / generate-user-input 生成来源锁、Go/Rust/TS/JSON Schema，--sync 同步消费者，--check 检查漂移。不得手写另一套问题字段。

Host 只保留有界当前进程请求与短期回执。请求绑定 generation、owned root、turn、item、原 RPC ID 与对外随机 ID；用户答复只能回复原 RPC，不能当新消息重发。单题单选或自由输入，每题最多一条 8192 字符回答。空回答表示跳过；关闭卡片等于跳过全组，停止任务仍走 native turn/interrupt。不是批准/拒绝接口；不授权命令、MCP 或扩大权限。

有 autoResolutionMs 时按原生归一化的 60–240s 开始可选倒计时，第一次用户实际交互暂停；无值无限等待。到期返回空回答，不选推荐项。提交和到期共享互斥状态。operation_id + 内容指纹绑定一次提交，结果仅在原生写回完成后为 answered/skipped；断连可能 unknown，不能静默重放。completed/resolved 关闭未提交请求；已提交的请求由原写回回执收束。所有 HTTP 路径 owner bearer + session 绑定，no-store；不写 Host 业务库、SSE 普通消息或 Desktop 持久草稿。

isSecret 仅显示遮罩，答案仍提供给模型并由原生 rollout 保留。Host/UI 不额外留存/回显；不宣称不落盘，不用作平台凭据设置入口。问题正文以文本展示。原生上下文工具复用计算与窗口机制；unknown 不能当 0，new_context 不摘要、会移除活跃任务消息/工具结果，历史独立保留。不得另造摘要器、预算计算器或自动恢复任务记忆。

顺序：独立 Runtime 构建与 canonical schema → Contracts → Host → Desktop → 定向验证 → 原开发入口激活。旧 Host/旧 Desktop 不激活此开关。正常结束/取消活动任务后退出，可回退原四组配对版本；没有历史数据迁移、请求复活或跨进程重放。当前检查与验收事实记入元仓 FEAT-169 的 04/后续交付记录，历史四组 D4 不代表本阶段通过。

## 0.2.0：P2权限与生命周期修复

最高contract-impact=breaking：Native touch从只读权限收紧为既有提交权限，修正此前实现的权限遗漏；HTTP/IPC现有字段、错误枚举和schema_version不变。用户已明确要求修复复审四项，非新增权限或运行能力。Host bearer保持，Native read使用task.read，touch/answer使用task.read+task.create。使用原有chat_resource_not_found/chat_conflict/chat_temporarily_unavailable等IPC代码保留问答错误语义；不扩展全局错误解析来猜测未知响应。

过期回执以权威snapshot无该项+严格关联的not_found判定本地不可再答，只移除表单并显示结果未确认，不制造原生终态或重投。所有迟到成功/失败回调都受会话、请求和本地版本约束；已知终态不可回到pending。Host提交/超时与原生活动轮次读取使用统一锁顺序，终结后的新提交不获准，已获准的幂等操作保留原写回确认语义。源契约保持同源生成，旧0.1.0材料的wire形状与错误值继续兼容；按Native权限收紧的实际边界使用配对开发版本，不能保留旧宽松权限。
