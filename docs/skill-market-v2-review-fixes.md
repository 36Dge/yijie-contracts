# FEAT-174 七项复审修复契约

2026-11-14；contract-impact=semantic。这是尚未发布的 local_worktree_candidate，保留 v2 wire 形状、v1 已完成操作回执和固定 Runtime N1/N2/N3 投影。本次不新增原生协议，不改原生技能解析、执行、配置优先级或插件版本选择。

- 权威：`jsonschema/skills/market-v2.schema.json`、`openapi/agent-host/skill-market-v2.yaml`；原生调用仍以现有 canonical schema 为准。
- Producer：Host、Skills 打包器；Consumers：Desktop Native/renderer、Host。字段、枚举、方法和既有成功结果不变；描述补齐既有语义，不手写消费者 DTO。
- `pending` 和 `needs_attention` 都是未决状态。进入兼容回滚前必须全部收敛；禁止以 worker 可执行队列代替未决库存。
- 兼容回滚不得复活迁移后被用户卸载的技能；遇到无法无损表达的后续意图，在修改规则/路由/安装前拒绝。原始文件、成功回执和来源保留。
- 当前发行目录允许 0..512 项，38 仅是当前初始内容。下架后仍枚举已验证的旧安装回执及原生库存，不将当前发行清单当作历史库存。
- 配置编辑继续调用原生 CAS。Host 只对自己记录的规则编辑按全局反向依赖顺序撤销，不实现原生规则求值。
- 普通、工具市场及专家提交的技能预检必须使用已规范化的实际CWD，并从预检直到原生turn准入共享资源门闩。已接受的操作先按原回执重放，不重新解析或派发；不改自然语言或历史正文。
- 私有迁移进度由 Host 负责兼容扩展；v3 reader 必须保留。不能将业务逻辑或私有数据库结构加入公共 DTO。

顺序：源语义说明与同源校验 → 生成/检查三类消费者 → Host/Skills 修复 → Desktop 来源固定 → 正常本机验收。无提交、tag、公开发布或生产兼容承诺。验收必须经过工具市场开启的完整聊天入口、实际维护命令及兼容模式冷启动，使用本机普通响应，付费调用为零。
