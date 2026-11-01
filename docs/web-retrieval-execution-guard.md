# 执行前网页检索与重复失败约束

2026-11-01，Owner 为本轮明确要求硬拦截的本机易界用户。Producer：固定 yijie-codex Runtime；消费者：Agent Host、Desktop；供应商工具实现和公共业务 API 不变。

`contract-impact = semantic`：在执行前拒绝用户明确禁止的网页补抓与无条件失败重试，沿已有工具拒绝/Warning 返回原因；原受支持的本地计算、文件处理、软件开发、真实条件改变后的重试继续使用原执行器。无新增 RPC、schema 字段、enum、权限或数据库迁移。保留完整 r5 行为和旧产物，用新 canonical Runtime 的相同 app-server schema 验证方向兼容，旧产物不被覆盖。

Runtime 权威源是 `yijie-codex` 的可重放 `0012-web-retrieval-execution-guard.patch` 与 canonical manifest；本仓 `generate-runtime-kimi-k31-pro.mjs` 读取固定源码提交、二进制和 schema 摘要，生成原 family 的新候选投影。生成后的不可变 Contracts 提交由原 `sync-kimi-k31-pro-contracts.py` 同步消费者。发布 tag 为 N/A：只用于已授权的本机开发客户端，不作生产发布。

可见原因复用 NativeNotification 已有自由字符串 `code`（不透传原始 Warning、命令、路径）：

- `web_retrieval_local_fetch_blocked`：本轮已使用检索，拒绝本地网页补抓。
- `operation_duplicate_pending`：同一操作尚未收尾，拒绝重复启动。
- `operation_retry_unchanged`：同一失败操作条件未变。
- `operation_retry_dns_unchanged`、`operation_retry_network_unchanged`、`operation_retry_access_unchanged`：上一失败的固定原因分类。
- `operation_guard_capacity`：当前轮有界记录已满，不继续启动新操作。

Host 仅从固定 Runtime 原因前缀映射以上代码，其他 Warning 保持 `runtime_notice`；Desktop 使用既有显示白名单。旧消费者收到陌生代码继续走已有 unknown 提示，不改变原生执行终态、不伪造执行事件。新客户端仍读取旧记录，历史格式不变。Runtime 自身失败、不完整输出与禁止测试不得改判成功。

部署顺序：Runtime canonical 构建与同形 schema → 固定 Runtime 源码提交 → 生成并固定 Contracts 提交 → 原同步入口更新 Host/Desktop pin → 定向兼容测试 → 正常退出固定开发客户端并增量重启。回滚按同一入口恢复成对旧来源与 r5 产物，无数据迁移和全量备份。

本次 Runtime 源固定为 `9ebafd71de2dea4c2f016bb38307b0a19a722384`。`make generate` 完成全部 23 个注册 family 的正常生成；随后全量生成一致性检查零漂移，`make lint`、14 项模型/原生会话/Runtime 投影测试通过。生成器同时刷新旧 runtime-chat-models 的源码身份引用，旧产物与 schema 摘要未变。未运行含危险归档生成的历史全量测试，按用户硬性规则改用上述正常验证；不宣称该历史测试覆盖通过。

结构兼容检查逐项通过的完整基线：当前 fallback `56bed40a3f87a1c5b1a5866b76be85ec0157a82d`、原消费者来源 `d191ad6ed08f0e8cc89dfea1346b5ecdf010e776`、已发布 `f16a497e1377f45747f8ff9292b4b60cf2027f88`、Native `6f632f155eacdaf93df0e0b00b5dab9e369c5442` / `811f38d6b104fa18477107e7ac91a85e19c445d1`、scheduled `db4458fe94572c4df41a114005d54a049bb79b1f`、experts `35e0949c95d7a59ca5480715c225766dcc822056`、chat-model `54be9314dce5319b049dc0a236800fd1a1fdd7a1`、原 fallback `bedf4159b0fa22e24efe6c295f8b0d4845df56b7`、Kimi 集成 `d5792d6aad18352ce8d1c5d510d345004cab3bd6`。这些检查不能替代 Host/Desktop 实际调用验证，最终消费与激活结果在 Host 的 `docs/web-retrieval-routing.md` 登记。

执行策略只判断已识别命令和可观察条件；文件观察不完整不伪称条件未变。权限/输入/配置变化或成功依赖修复允许重试。任意动态程序沙箱与供应商内部未暴露的重试不在该进程内策略的覆盖范围。
