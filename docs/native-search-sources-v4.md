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
