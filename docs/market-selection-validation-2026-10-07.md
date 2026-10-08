# market-selection/1 验证记录

日期：2026-10-07。范围：独立 Native submit source、生成/同步和确定性选集摘要；无 Host/Gateway 激活。没有调用真实模型、第三方 MCP、OAuth 或凭据存储，没有强杀、攻击 fixture、运行时替换或权限破坏。

| 检查 | 结果 | 证据范围 |
|---|---|---|
| `node scripts/generate-market-selection.mjs --check` | PASS | 18 个定义、一个 Native command；source/input/output candidate 摘要一致 |
| `node scripts/sync-market-selection.mjs --consumer=desktop --check` | PASS | Rust/TS/AJV/schema/candidate 消费字节一致，同时检查 market-connectors/chat-models 既有生成物 |
| `make market-selection-test` | PASS | JS 7、Go 2、Rust 5；Native manifest、正常请求/回执/缺失字段、摘要向量、重复安装身份、附件上限；Rust Clippy `-D warnings` |
| 显式新 TS/声明文件 `tsc --skipLibCheck false` | PASS | 消费者 type/validator declaration 真实类型引用可解析 |
| `make lint` | PASS | 原有注册 OpenAPI、26 JSON Schema 加独立私有 IPC wire authority 的全部定义、Buf、TypeScript、Go vet；原有 unused-component warnings 保留 |
| 已发布基线 `f16a497e1377f45747f8ff9292b4b60cf2027f88` breaking | PASS | 原仓 canonical breaking checker |
| 保留基线 `6f632f155eacdaf93df0e0b00b5dab9e369c5442` breaking | PASS | 原仓 canonical breaking checker |
| 保留基线 `811f38d6b104fa18477107e7ac91a85e19c445d1` breaking | PASS | 原仓 canonical breaking checker |
| pre-feature fallback `1a213ac8383e95ac6ec69363937687904fa3591c` breaking | BLOCKED | 既有 scheduled-plan-draft baseline 的远程 `https://schemas.yijie.ai/scheduled-tasks/draft-execution/v1` 引用加载返回 EOF；未关闭门禁或伪造 PASS |
| Native-only 源格式路由 | PASS | 确认原文件无 HTTP path 后迁至独立 JSON Schema wire authority 和私有 IPC manifest。manifest 严格验证，全部 Schema 由仓库 lint 编译；18defs 所有生成 bytes 与迁移前一致；未添加虚构 server 或关闭 HTTP lint 规则 |
| 完整 `make generate && make test` | NOT RUN | 旧 canonical 流程包含不属于本需求的历史攻击/危险归档 fixture 生成和测试，遵守用户长期条款；仅运行独立新族及既有只读一致性检查，不能宣称全仓测试通过 |
| 真实账号/51 项联通/Runtime turn/OAuth | NOT RUN | 本步骤只建立 source-first 提交身份和禁执行边界 |

新 family 在以上四个基线中均不存在；旧 tracked OpenAPI/JSONSchema/兼容源未修改。新 JSON Schema 路由通过显式 source loader 纳入 canonical schema lint，并以独立生成/consumer conformance 检查，私有 IPC metadata 不充当 HTTP endpoint。初版错误使用 OpenAPI 包装、触发 `no-empty-servers` 的格式问题已经通过调整权威源位置解决，并非忽略失败或降低 lint 规则。正式发布仍要求解决独立的旧 fallback 远程引用、不可变 pin、完整 producer/consumer 和真实执行资格，不因本地候选通过而晋升 supported。
