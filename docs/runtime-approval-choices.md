# 原生命令审批选项

`contract-impact = breaking`（首次保存原生命令规则后的老 Host 降级边界；HTTP 本身为增量）。本地 Agent Host 提供独立 v3 读取与决定端点，Desktop Native 为消费者。v1/v2 的接口、生成类型、单次决定、认证和审计不变。v3 的请求列表和决定回执引用同一 v2 定义。此变更没有数据库迁移。

原生权威为固定 yijie-codex 0.144.6 的 `item/commandExecution/requestApproval`、`CommandExecutionRequestApprovalParams.json` 与 `CommandExecutionRequestApprovalResponse.json`。Host 只转发原请求提供的 `acceptWithExecpolicyAmendment.execpolicy_amendment`；显式的 `availableDecisions` 优先，缺省时读取原生 `proposedExecpolicyAmendment`。不从命令文本推断前缀，不把 `acceptForSession` 或网络授权当成类似命令。客户端只提交原审批 ID 和选择，无权提交规则内容；匹配、生效范围及保存均由 Runtime 负责。

日常来源：yijie-codex `2b79447c363165ecd3b9d12dffe300c1adddbbb0`，`native-public-messages-r3` 构建。该构建上述请求与响应 Schema 的 SHA-256 分别为 `9a4a32a860c0b40b2e77b116677d9188510e67a5d437d802f01cad2ad8c9678e` 与 `db8384b633b9cee62f152328c5053ebaaa90299e0e686451c13de75fc01bafbd`。独立 v3 投影不启用已退役的 FEAT-137 生产者。

先支持 Host，再更新 Desktop；旧客户端继续读取 v2，新客户端对不支持 v3 的 Host 只读回退到 v2，只展示原选项，决策请求绝不降级重发。撤回客户端展示不撤销用户已交由 Codex 保存的规则。旧版对照：`5f305cb7e9746ef58827fe9195f9b493c1dd26df`；新族不替代已发布基线或 Native MCP 的既有 pin。

首次显式选择类似命令时，Host 在现有 Home 独占锁下创建私有目录及原生 `rules/default.rules` 追加目标；同 Home 的私有随机归属标记只用来与退役 FEAT-137 同名文件区分，不记录批准内容。只由 Codex 追加规则并在下一次执行时匹配，Host 不解析规则、不改既有权限、不采纳或覆盖无归属文件。正常退出保留规则。未选择过此选项的 Home 不写新文件。UI 可独立回退；已使用此功能的 Home 回退时应保留能识别原生规则的 Host。旧 Host 会拒绝带新规则文件的 Home；确需降级 Host 时，须正常退出并由所有者另外决定如何归档规则，不自动删除或改写。
