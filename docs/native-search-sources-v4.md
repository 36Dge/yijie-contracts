# Native search sources v4（本地候选）

`contract-impact=breaking`，Owner 为段成威。权威先行顺序为固定 yijie-codex 的 0006 patch、
独立产物及 canonical schema，然后是本仓投影，最后 Host/Desktop。未发布，不构成生产批准。

新增 history `/v4/agent-sessions/{id}/native-thread` 与 SSE `/v11/agent-sessions/{id}/events`。
NativeWebSearchDisplay 可选 sources 为 Provider 原样给出的搜索命中，经安全筛选后显示：
最多 32 项；必填 HTTP(S) URL 上限 2048；可选标题上限 512。absent 表示未观察到来源元数据；
空数组不声称搜索无结果。sources 不能推导 assistant 引用、断言支持关系或核验状态。
所有失败、生命周期、权限、ID、顺序和 replay 规则不变。

旧 v1/v2/v3 权威源与本轮恢复基线逐字节相同；旧闭合 SSE v7/v8/v10 由 Host 降级复制提供。
新 Desktop 使用 IPC v4 和 record format 4，保留旧格式严格 reader；未知未来格式继续拒绝。
不迁移重写历史，不向旧 reader 发送新字段，不以回滚为由删除数据。

复用 generate-native-process / sync-native-process 生成并校验 v3 与 v4；Runtime 精确来源由
generate-runtime-chat-models / sync-runtime-chat-models 固定，canonical schema 只允许可选来源扩展。
本地未提交候选与旧 commit 基线的适用范围见元仓报告及 baseline.json / legacy-source-compatibility.json；
不能称为已发布 tag 或全仓 breaking 检查通过。

安全验证仅普通样例、版本降级、真实 Host 字节经过 Native/SQLCipher 正常重开，以及用户授权的
Kimi 同题真实回合。不运行攻击或进程故障注入；具体结论见元仓 `docs/dev/dual-progress-resume-20261023.md`。

## FEAT-164 URL组件判定修正（2026-10-27，Owner已批准）

增量contract-impact=semantic；v4/旧降级wire、schema、SDK、32来源/2048 URL/512标题上限不变。Host来源URL原有整串不透明凭据启发式会跨越URI结构分隔符误删普通公开路径，当前修正仅限定该启发式的输入范围。单一Owner段成威已在FEAT164第53号方案批准秘密识别适用边界、Contract First及零新增真实调用离线验证。

先保持既有HTTP(S)、无userinfo、合法host、大小、控制字符及Bearer/敏感名称/JWT/AWS/PEM全文检查。随后不透明长串判断分别作用于host、每个原始path segment解码后的完整值、每个query key/value解码后的完整值和fragment；按原始结构分段之后解码，编码的分隔符不能成为新边界。组件内短横线/编码内容不拆开，无域名白名单；不改通用命令输出脱敏规则。无法通过原保护条件的来源仍不输出、availability仍partial，不改变URL本身。

普通样例权威为tests/fixtures/agent/native-search-sources/ordinary-url-components.json，含本次真实返回的20个公开URL和5个普通结构化控制；不访问这些URL，不构造攻击/进程故障。该20条按本限定策略保留18、仍有独立长组件的2条保持保守隐藏，不能称20条全显。Provider/Runtime原始事实保留，既有SQL/回放记录不回写；正常native-thread读取按当前producer安全投影，旧v1/v2/v3降级继续剥离新增sources且不改变原事实。

同源同步manifest包含本说明及普通样例摘要；权威固定本地commit→Host消费/实现→Desktop固定Host构建来源。没有发布tag或push；正常来源显示修复不改变本次供应商检索答案质量，也不增加真实模型预算。
