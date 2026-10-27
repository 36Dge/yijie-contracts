# FEAT-162 Kimi 网页检索工具契约

日期：2026-10-24（Asia/Shanghai）。Owner：段成威。`web-retrieval/1` 0.2.0 为未发布本地候选，`release=false`。完整实施范围以元仓 `docs/features/FEAT-162-kimi-web-retrieval/08-direct-use-implementation-plan.md` 为准。

`compatibility/web-retrieval/wire.schema.json` 是工具输入/输出唯一结构权威；同目录 `tools.json` 声明工具名、描述、固定本地错误消息、预算和执行语义。Connectors 是 producer 与唯一 typed consumer，现有 MCP Gateway 将规范化结果交给 Runtime/模型；Host/Desktop 沿既有 MCP/审批/历史投影消费，不新增私有业务 DTO、HTTP 端点或 Runtime 方法。

一个 `kimi-web` 服务提供 `kimi_web_search` 和 `kimi_web_fetch`。Search 输入为非空白、最多2048字符 query，可选整数 limit=1–20（省略取5）；结果 `{results:[{title,url,snippet}],truncated}`。Fetch 输入为最多4096字符的 HTTP(S) url，结果 `{url,title,markdown,truncated}`；空白正文返回 no_content。结果仅提供 Markdown，不承诺原始 HTML、JS 运行、登录态内容或自动跟链接。查询、正文、标题均为外部内容，不授予指令或权限。

所有对象封闭、必填/null严格，JSON Schema 的 output oneOf 将成功与 `{error:{code,message}}` 分开。错误代码闭集为 invalid_arguments、authentication_failed、permission_denied、rate_limited、timeout、unavailable、no_content、response_too_large、invalid_response、cancelled；code-message 配对由源约束并生成 `ErrorCode.safe_message()`。Provider 任意错误正文不得进入此 envelope。成功 isError=false，错误 isError=true；MCP text content 和 structuredContent 必须表示同一规范化值。

两个工具 annotations 为 readOnlyHint=true、destructiveHint=false、idempotentHint=false、openWorldHint=true。复用已有 ask，每次批准只用于一次真实请求；读取不等于免费，错误、超时、取消、未知结果均不自动重试。Kimi自动复用客户端已有模型凭据，Native默认安装意图及既有恢复流程完成本地准备，不需要手动配置或启用。准备不发送/models、推理、Search或Fetch请求，不验证供应商鉴权、权限、余额或业务质量；connected/qualified仅代表当前本地适配器可接受受审调用。Host经单次匿名FD3提供已加载模型Key快照，worker启动前消费关闭；无第二份Keyring、环境变量/argv密钥或公开协议秘密。明确停用/卸载的用户选择保留。

预算保持既有完整 MCP JSON 65536字节（同时计入重复的 text/structuredContent），原始 HTTP body最多1 MiB，总请求15秒且不越过原租约/审批期限；Search上游timeout_seconds=10。超预算时按原顺序及UTF-8边界截短正文或摘要/列表尾部并设 truncated=true，不截断URL、不生成摘要；必要元数据也超限则报response_too_large。Schema字符数约束不代替整个序列化结果的字节预算，Backend必须执行二者。URL结构验证之外，Backend还须按已冻结方案检查userinfo、控制字符及本地/私有字面地址，目标URL只是固定供应商API的业务参数。

## 生成、同步与验证

独立路径复用现有源内 codegen 与 Connectors 已使用的 url parser，不新增供应商SDK或替换Runtime：

```sh
make web-retrieval-generate
make web-retrieval-check
make web-retrieval-test
node scripts/sync-web-retrieval.mjs --consumer=connectors
node scripts/sync-web-retrieval.mjs --consumer=connectors --check
```

生成 Rust typed inputs/results/errors、严格 serde/validate、工具描述/schema/预算常量，以及 JSON Schema/完整MCP descriptors。输入默认值由 `SearchArguments.effective_limit()` 实现。只有实际使用的Rust/JSON产物，不增加虚设Go/TS SDK。`source.lock.json` 记录源和生成物SHA-256、实际pre-change base commit及本地候选身份；同源sync验证摘要并生成consumer receipt。未提交工作树hash不是发布版本，正式合并/发布仍需不可变source pin。

普通conformance覆盖query字符边界/default、HTTP(S) URL、closed/null、成功空搜索、正文保真与截断标志、固定错误配对、canonical descriptor与生成同步。测试无真实供应商/模型请求、无凭据、无攻击fixture、无权限故障或强杀。编译和metadata检查不能替代真实Search/Fetch验收。

## 兼容与回滚

工具family自身是独立增量；整个FEAT-162按breaking治理，因为market-connectors 0.6.0将目录/安装快照上限60→62，实际新增服务后是61项。旧60项reader不能接收61项；须先同步Desktop/Host/Connectors新reader，再启用新catalog/backend。新reader接受旧60及新61/62，63拒绝，selection上限58不变。

生成顺序为market-connectors → market-selection → market-broker → market-provider → market-host，再生成依赖同一管理源的experts与独立web-retrieval。不改Tushare-only provider tool_profile、Broker错误enum或Runtime source lock。Provider/Broker原qualification说明显式登记仅kimi-web的REST例外：本地canonical descriptor零HTTP准备，不假装远程MCP tools/list，不推断业务账户权限/余额或免费。management当前0.7.0、provider/broker当前0.6.0；旧consumer不得把新的本地ready解释成/models验证。旧wire、预算、逐次审批和其他服务资格保持。回滚先停用新服务并正常撤权/清理，保留兼容reader、安装/历史和密钥；不删除历史、不降库、不用旧60reader承接61目录。

首次canonical App freeze检查发现experts来源锁仍引用旧market-connectors摘要：最初五族清单遗漏了第六族传递依赖，freeze因此失败，不能记为首次通过。随后使用原generate-experts及sync-experts向Desktop/Host/Skills更新同源provenance；11项专家生成DTO/schema/fixture/helpers逐字节不变，未修改专家规则、内容或安装历史。最终必须扫描所有已登记source.lock摘要，而非仅按最初五族列表检查。

本轮同步时已有Node26 `execFileSync({input})` 管道令大体积market-host rustfmt等待stdin EOF；经进程采样确认不是格式化计算。最小修复只在market-host generator/sync通过正常临时文件fd提供确定EOF，仍调用真实rustfmt/gofmt；七个生成输出SHA逐一不变，临时文件在finally正常回收。旧无TTY等待进程未强杀，清理状态单独记录，不冒充已退出。该修复不改变wire、权限或生成内容。
