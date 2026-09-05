# FEAT-137 永久终止

Owner 于 2026-09-05 在收尾任务中再次确认：因实现耗时过长，FEAT-137 永久终止，未完成验收，未来不再实现或重启。本日期记录本次确认，不推定最初口头关闭的日期。

机器可读退役决定以 [FEAT-137.json](FEAT-137.json) 为权威。`contract-impact = breaking`：显式 opt-in 的未发布 local v6 审批能力被撤销。v1-v5 的格式、接口、权限限制与持久历史读取不变。Owner 已授权按该顺序退役，Host/Desktop 是全部已知消费者；不存在发布或生产激活。

新 Host 在读取 provider credentials、启动 Runtime 前拒绝遗留的审批与 deterministic producer 启用配置；Desktop UI 常闭，native 层拒绝旧启用请求。正常与 stable 入口使用已经保留、经 SHA-256 固定的 FEAT-136 双补丁 Runtime，维持 `read-only/never`。本地旧三补丁 FEAT-137 artifact 在解除引用后移除。历史四补丁 candidate 不再是活动 Runtime baseline；其源码、schema、生成物仅保留作审计，不继续开发。

原 FEAT-137 v6 API/schema/SDK 保留以避免无关生成差异和历史数据破坏，不是可用能力或未来待办。原 FAIL/BLOCKED/NOT RUN 与 source PASS 都是历史证据；终止不能兑换 D4、usable 或验收 PASS。

本次检查仅验证退役约束和保留功能。失效配置/未配置场景使用正常输入，不做故障注入、强杀、权限破坏、binary 替换或攻击 fixture。回滚通过归档恢复文件和引用用于审计恢复，不授权重新激活 FEAT-137。
