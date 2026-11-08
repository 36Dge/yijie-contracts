# FEAT-169 原生工具本地候选

最高 contract-impact=breaking。用户 2026-11-07 明确只接 V2 多代理、apply_patch、Code Mode exec/wait、四个 memories 工具，并要求复用原生实现。本 family 的 profile 是易界受管装配的权威事实；原生配置形状、模型 metadata 和 thread/read 身份字段仍来自固定 fork 的 canonical schema。

原生候选在保留的 FEAT-168 patch 链后追加输入适配、显式 V2 恢复策略、子代理 MCP 继承选项，以及 generate_memories=false 对启动管线的约束。补丁/原生源码先行，随后由本仓 canonical generator 固定实际 binary、manifest、schema 和源文件摘要，再生成 Host/ Desktop 消费材料。本阶段允许明确标记 local_worktree_candidate；没有 Git 提交/发布授权，不冒充不可变 release。

多代理执行和树由 Runtime 拥有。Host 只根据可信 thread/read 的 parentThreadId 与当前代已拥有的根线程完成审批承接，不用模型自报祖先，不复制代理注册表为业务事实。子代理不继承父线程的 MCP 服务器/许可；既有市场工具继续由原已绑定主线程调用。

输入适配只把函数调用中的 input 字符串交给原生 apply_patch/Code Mode 执行器，仍使用原语法校验、事件、输出、取消与审批。`collaboration`、`memories` 的显式命名空间在提供方 wire 上分别投影为 `collaboration__*`、`memories__*` 普通 function，执行仍委托原生 handler。V2 默认加密参数仅在本 profile 的 `plaintext_messages=true` 时使用已有 `InterAgentCommunication::new` 明文路径；出站请求将原生 AgentMessage 投影为带发送者/接收者的普通 message。原生历史、邮箱和轮次边界不改写；不把消息提升为 system/developer 权限，也不把旧密文伪装成可读取文本。

外部接口依据：[Kimi Responses](https://platform.kimi.com/docs/api/responses)、[MiniMax Responses](https://platform.minimax.io/docs/api-reference/responses-create) 及其官方 OpenAPI。当前两个受管模型不直接接收原生 `agent_message` / 加密工具参数；MiniMax 的本次自定义工具使用 function 声明；[官方 Server Tools 文档](https://platform.minimax.io/docs/guides/server-tools) 另行说明 Responses 支持 web_search，本次保留其既有声明，不以通用 OpenAPI 的 function 枚举误关原搜索能力。真实供应商行为仍须另行实测。

展示契约 Native6 从 0.6.0 增至 0.7.0，仅新增 `fileChange`、`subAgentActivity` 两个真实原生变体。Host 投影文件差异、活动类型，Desktop 复用已有活动卡片。`subAgentActivity` 完成只代表动作已记录，不推断子任务已完成。原生 Code Mode / memories 未在 stable ThreadItem 中提供独立 Item；不合成 MCP 结果或伪造生命周期，其结果由原生模型上下文及最终答复消费。手动记忆使用原生目录和追加写工具，自动模型提取、整理与历史清理不属于本次接入。

消费者先具备精确候选支持，再从正常开发入口启用；原 Runtime 制品与已提交历史保留，回退不降数据库或编辑 rollouts。任何实际供应商/额度验证单独记录，不用本地协议响应证明模型能力。


新 Native6 值对严格旧读者是 breaking；本地只配对启动已更新的 Host/Desktop。回退 Runtime 执行策略时仍应保留能读新值的消费者，不把新记录交给未适配的旧读者；不降库、不改写历史。本候选没有宣称生产滚动升级兼容。

本次不修改连接器、Skills 业务执行器。主线程继续使用原有受管 MCP 入口；原生子代理仅共享工作区与手动记忆目录，受原生沙箱与审批约束。


2026-11-08 复审追加 0021 原生补丁，保留 0020 及原制品。函数别名保留 Code Mode 的逻辑命名空间，原生 excluded/direct-only 策略继续生效；V2 子代理 MCP 继承由实际父轮次与父/子较严格配置共同约束。默认工具集合与 wire 字段不增加。

审批展示归根会话，原生操作必须保留其原子 threadId。自动审核拒绝可在原轮次结束后由用户明确授权；适配器异步通过原生 thread/read 确认祖先，避免占用 stdio reader。原生 approveGuardianDeniedAction 只注入具体操作的授权，不启动轮次；Host 不自动重放，不另建代理树缓存。根线程的当前代凭据在线程删除后撤销。

正常进程关闭后，原生 V2 的 live agent 列表不会从历史自动复活。恢复根会话仍只使用 V2，旧记录可读，后续任务通过新 V2 子代理继续；易界没有绕过原生生命周期额外重建代理树。
