# 原生公开进度与写作收尾候选

2026-11-04，Owner 明确批准最小 Runtime 修复、canonical 构建/引用接入及必要本地
固化，不推送。`contract-impact = semantic`。Runtime 源是既有原生 0014 后追加的
0015 写作预告识别；不新增公共 wire/消息字段、权限、数据库格式或执行循环。

生成器继续以 canonical Runtime manifest、二进制 SHA、完整源码 commit、各补丁
摘要和稳定 schema 为权威，经现有 generator 生成同族 artifact identity，再由
Host/Native 固定不可变来源。旧 execution-progress-v1 产物保留；schema 零变化
必须由实际生成结果证明，不能仅根据补丁大小推定。

正常 commentary、同响应多消息、end_turn=false 无工具续行和真实工具后续保持；
仅未标阶段且符合保守写作预告条件的提前结束进入原有最多两次无工具补答。历史
不重放、不回填 phase，Skills 保留原生显式与隐式加载。未取得正文不能记为成功
交付；模型覆盖率、真实 UI 和语义兼容分别验证。

消费者顺序：Runtime 固定→本投影生成/检查/本地 commit→Host 同源同步与回环→
Desktop 精确来源与标准入口。回退需恢复匹配的 Runtime/Host 来源组合，原会话
数据不回滚、不降版本。当前为本地候选接入，非生产或签名发布。
