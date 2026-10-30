# FEAT-162 Basic/Pro 本地契约候选

2026-10-29，contract-impact=breaking。用户授权本地契约、代码及零费用验证，禁止提交、推送和付费。技术/消费者责任沿元仓 FEAT-162，由段成威负责；本轮机器检查不代替 Owner 人工认可或发布资格。

权威源为 `compatibility/web-retrieval/{wire.schema.json,tools.json}`。候选 web-retrieval/1 0.3.0 保留 0.2.0 原件于 `legacy/0.2.0`，基线为 `61137174a25dc368e0006f27633fd4a9ad097aa6`。生成 Rust、工具 JSON、Desktop TS/独立浏览器 validator 均由 `generate-web-retrieval.mjs` 产生；同一状态/正文约束在 JSON Schema 和生成 Rust validate 中执行。第三方原始 REST 语义依据元仓22号所列官方资料；未调用账户或验证真实权限。

新增 Basic include_content、Pro 参数/结果、content_status、dropped_results；旧 Basic 默认成功/Error/Fetch 分支保持。available 必须有非空白正文，unavailable 不得有非空白正文，truncated 允许裁至空；有丢页或逐页正文截断必须 top-level truncated。日期必须是有效日历值；Rust TimeWindow 另验证 start≤end（JSON Schema 无跨字段排序能力），不补写用户未给的筛选。

新模式在创建审批前发现A已到时，复用现有CallExpired分类并返回tools.json源生成的固定中文工具错误，明确未发送与不自动重试，不扩大旧输出格式。

Broker 0.7.0 新 prepare 成对携带 webRetrievalVersion=0.3.0 / mcpToolTimeoutMs=60000。PendingCall 成对可选 decisionExpiresAtUnixMs / executionExpiresAtUnixMs；remainingTtlMs 继续表示执行 TTL。Host v1 0.4.0 / v2 0.6.0 同步双截止，原 expiresAtUnixMs 仍为执行 D。双字段必须同在且 A<D，新 Host 的 execution=D=expires。新模式使用 prepare 时刻+60s 的保守 MCP 截止下界，详见元仓24号；不改 Runtime。

| 方向 | 处理和验证 |
|---|---|
| 旧 Host→新 Broker | 省略新 prepare 字段，只暴露冻结的旧两工具；Pro/正文新字段拒绝；旧 Basic/Fetch 期限与结果不变 |
| 新 Host→旧 Broker | 旧 closed decoder 不接受新 prepare；失败关闭，不猜版本或降级后发新参数 |
| 旧历史→新 Desktop | 生成 SearchOutput 保留旧成功分支；正常旧值组件测试通过 |
| 新结果→旧 reader | 不承诺旧 reader 理解新增正文/Pro；只有匹配新来源才启用，旧 reader 不接收新模式 |
| 新历史→回滚 | 回滚保留数据；旧 reader 最多普通文本/不支持，不能重放 HTTP；真实旧 App 回滚未执行 |

消费者：Connectors 由既有 sync-web-retrieval / sync-market-broker / sync-market-provider 同步；Host、Desktop 由显式 `sync-feat162-local.mjs --consumer=… --local-candidate` 机械投影。后者记录 source_commit:null、真实 base_commit、源锁/产物摘要和 activation_qualified:false，不改写既有不可变候选回执。它只允许本地开发验证，不能替代发布 pin。规范生成/来源漂移检查继续生效。

发布顺序仍为源契约不可变引用→provider→匹配 Host/Desktop→准确制品→单独激活/真实验收。当前禁止 Git 提交，故不可变消费闭合、专家资源级联及 daily:prepare/open 留待后续授权；不刷写 Skills 摘要绕过门禁。恢复旧端时先停用新模式，保留旧两工具及原历史，正常退出自有进程，不迁移数据。

验证结果和完整命令见元仓 `24-basic-pro-implementation-and-zero-cost.md` 与 `evidence/implementation-checks-20261029.json`。定向检查不是所有已发布 baseline/公开 wire 的全量兼容证明，不新增 supported tag。

## 2026-10-30：Alpha E1 列表分流澄清

两次真实 E1 均错选 Pro，现以 semantic 修订明确无站点/日期限制的仅列表交付优先 Basic，Pro 的普通问答规则不覆盖“只列标题/摘要/链接、不作问答或分析”。不更改三工具输入输出、注解、单次审批、期限、旧 0.2 描述或实际供应商接口；0.3.0 未发布候选用新完整 commit 区分。Connectors 为描述 producer，固定 Runtime 为模型消费者；Host/Desktop 仅透传及保存来源。新旧 SDK wire 兼容，回滚只回到旧描述，不回放调用。用户已授权本地提交、收费 Alpha、遇阻修复；旧段落禁止提交/收费仅为原时点记录。具体源引用、零费用检查和 E1/E5 复验见元仓 42 号，未取得实际通过前不宣称闭环。
