# FEAT-170 Runtime tool-search 投影

权威源为固定Runtime原生ModelInfo/ModelsResponse、ToolSearch实现和提供方官方协议；此family只选择模型能力和固定制品，不定义另一套搜索RPC。最高impact=breaking，local_worktree_candidate、release=false，fallback c24d73fde83a01b5dd2a9ded8defb5bbef34e311；旧支持窗口保留。

profile继承runtime-interaction-tools六组能力，只覆盖kimi-k3.1-pro的supports_search_tool=true与tool_search_transport=function_code_mode。默认进程目录及MiniMax保持旧值。模型参数从同一native model-catalog.schema机械校验，Host消费生成的profile/schema/制品常量，Desktop消费来源锁；无手写公共问答或搜索DTO。

Kimi官方Responses类型范围不支持原样tool_search：[官方协议](https://platform.kimi.com/docs/api/responses)。原生function适配复用BM25和exec，不在Host建立目录、索引或已加载状态。协议参数、call_id/错误、缓存传输模式、原生历史/记忆及权限语义由Runtime和既有Gateway拥有。

node scripts/generate-runtime-tool-search.mjs --sync / --check 维护本family与消费副本。生成器验证原补丁序列+0023、源码输入、binary/manifest、stable schema树未变及canonical模型字段。当前schema271、experimentalApi=false，无新的公开HTTP/SSE/Native6变体。两项源conformance及fallback离线兼容检查通过；原四组已有的Native6响应枚举警告保持，不能冒称生产兼容发布。

消费者先完成精确候选支持，再从原开发入口启用。停用仅恢复普通线程基线目录，保留新Runtime reader；未经验证不降级旧writer或删除历史。真实Kimi与原入口证据由元仓FEAT-170记录，不把源码结构检查作为真实模型验收。
