# FEAT-175 builtin-web-retrieval/1 本地候选

Owner与本轮消费者审阅人：段成威。用户2026-11-15授权修订3的S1及Q1零费用验证；不是公共服务、付费调用、合并或发布批准。整体FEAT-175为breaking，本批以独立未发布0.1.0 family增加源及显式候选消费，旧web-retrieval 0.3.0、市场工具与现有受支持接口保持。

## 权威与消费

- `compatibility/builtin-web-retrieval/wire.schema.json`：应用委派、operation、claim、取消与私有控制载荷；`policy.json`：描述、只读注解、原生auto、预算与精确专家政策。`expert-web-policy/1`候选政策在这一同源family中表达，不另外维护Host白名单。
- 原`compatibility/web-retrieval/wire.schema.json`仍拥有三工具输入和成功结果。本family按引用机械展开，新增应用错误，不改旧供市场消费的描述／生成物。
- `openapi/public/web-retrieval.yaml`与`openapi/internal/web-retrieval.yaml`分别拥有HTTP路由、安全方案和响应状态，复用同一JSON Schema定义。新API没有handler或部署。
- Codex Runtime完整canonical elicitation schema拥有原生回调；新Go/TypeScript类型是机械消费投影，nullable turnId和原request ID不被改造为item ID。支持的S1适配为一次form确认，记忆选项／完整UI仍属S3。

Producer/consumer：Native→Host→worker消费私有控制载荷；worker→API消费public操作；API↔Connectors消费internal执行/claim/finish；Runtime→Host/未来Desktop消费原生elicitation；MCP工具表由worker提供、Runtime消费。本批只有Host配置及原生回调消费者实际接入，其余保持S2／S3实施前置，不提供手写影子DTO。

## 语义

产品会话留在Native，API发行web-only不透明委派；grant只进私有内存。普通续期不取消已准入任务；退出／换租户撤销整个binding的全部重叠grant。x-sensitive标注不能替代将来SecretValue包装、日志脱敏及实际B1-A8验收；本批没有产生或传递真实委派。

operation使用UUIDv7；已有记录先按主体／租户和参数摘要查重。ready先持久化，随后一次内部execute；Connectors必须在供应商HTTP前取得唯一claim。claim是保守授权点，不证明实际发送；cancel先于claim才保证零请求，已有claim/unknown不重派发。status/cancel没有新的模型工具，也不消耗执行额度；没有正文时明确result_unavailable，不能伪造成功或回填原生终态。

工具名保持，注解为readOnly=true、destructive=false、openWorld=true、idempotent=false。普通问题优先native；Pro/Basic/Fetch的自然语言选择仍待Q2/Q3，不用同源描述和合成响应冒充真实模型路由资格。

2026-11-16 最小指导修复（semantic）：`policy.json` 的 `server_instructions` 通过生成常量接入 MCP 标准初始化，复用固定 Runtime 的命名空间／工具发现机制。Pro／Fetch 描述明确研究优先次序、实际站点／日期参数以及成功截断结果的处理方式。MiniMax 的原生模型配置使用扁平函数，因此关键规则同时保留在各工具描述中。成功结果格式、历史描述、权限、准入和 Runtime 均保持；此项只证明指导接线，不构成真实模型遵循策略的资格。实际定位和验证见元仓 FEAT-175 第 31 页。

同日追加（第 38 页，semantic）：补齐 Basic 的 `collection_instructions` 和三工具共用的
`completion_instructions`，由原生成器机械投影到命名空间和各独立函数。未指定站点／日期的
资料列表优先 Basic，所需标题、URL、摘要齐全即足够；普通问答保持原生搜索，研究结论或
显式过滤保持 Pro，指定页面读取保持 Fetch。不得为了补做链接核验而升级已足够的资料列表；
追加检索须对应用户交付物中的具体缺口，成功页面换锚点不构成继续取正文。Host 同步移除
“未选连接器只走原生搜索”的旧优先规则，保留所选连接器在其适用信息上的优先权及证据诚实性。
输入／输出 schema、工具名、审批、凭据、费用准入、取消和超时语义均无变化；全部四个候选
消费者用同一 generator 更新，未发布 0.1.0 候选及固定 Runtime 保持。此项仍需真实模型复验，
本机脚本化响应只证明首轮工具可见和规则传递，不能证明自然选路、检索收敛或答复长度。

## 生成与验证

`node scripts/generate-builtin-web.mjs --consumer=host`仅生成此family及Host同源投影；加`--check`逐字节核验。source.lock记录当前工作树SHA、固定Runtime制品和canonical摘要，是本地候选凭据，不是Git提交／发布pin。正式consumer合并前仍须不可变源引用。

产物包括JSON Schema／工具表、Go原生回调及政策、TS应用载荷和原生回调、Rust同源schema常量。后续REST／worker实现需要的具体语言validator必须从此源生成并通过conformance，不能因已有schema常量就宣称执行器已经完成。

运行`node --test tests/builtin-web.test.mjs`及新API lint；完整generator、lint与支持窗口检查的实际结果记录在元仓FEAT-175/19和机器账本。现有工作树还包含其他需求的未提交源，不能借全量命令覆盖它们。

本批即时比较基线为`2592f5d5b07fcd92de10d25c4dcf73bd1ce03cb5`；旧受支持tag和FEAT-162列出的全部比较基线仍保留。新family在这些基线不存在；既有wire的任务前后字节保持另行核验，新增API引用闭合使用既有prepare-breaking-inputs工具。全局历史差异不因本批是新增family而宣称兼容通过。

部署仍按修订3：服务端先支持→客户端精确pin→最后启用；关闭候选即可回到旧行为，保留已读历史和原有生成物。不降库、不清历史，不把全量检查受其他需求阻塞隐藏为PASS。

### 0.4.0 网页读取拒绝原因

`kimi_web_fetch` 收到 Kimi HTTP 403 且响应的 `error.type` 为 `security_risk` 时，返回 `url_blocked` 和固定文案“网页读取服务的安全策略拒绝了此网址。”。该次读取失败，没有网页正文。操作的派发、结算和重试规则沿用既有定义。其他 403 继续按供应商权限错误处理，404 沿用 `no_content`。[Kimi Fetch 接口](https://platform.kimi.com/docs/api/tools-fetch)

`contract-impact = breaking`。0.3.0 的封闭错误枚举无法识别新值。API、执行器、网关、Agent Host 和 Desktop 同步采用 0.4.0 的生成物，本次为本机候选。切换或回退时将这些组件一起正常停止并按目标版本重新构建、启动。已有对话记录保留当时的错误。变更前的本地比较基线为 `a1101880f60726c056bf859bb61389e299df6e66`。
