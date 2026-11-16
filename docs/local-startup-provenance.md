# 日常启动来源同步

2026-11-14，用户要求将本地启动前检查和必要构建自动纳入易界固定入口。
`contract-impact=semantic` 仅涉及私有生成／部署命令；HTTP/IPC、schema、生成类型、
Runtime 二进制、权限和持久化语义不变。此流程不是发布、功能测试或审查批准。

七个既有生成器新增 `--refresh-provenance`。它们仍按原逻辑读取权威源码、核对固定
Runtime 的源码、manifest、二进制、schema，并计算全部输出。共享 helper 在写入前
比较每个已有输出：Runtime 投影仅允许 `runtime_source.base_commit` 改变；问答投影
仅允许其 `sources[compatibility/runtime-interaction-tools/source.lock.json]` 摘要改变。
其他差异、缺失文件和普通生成内容改动均拒绝，已经存在的用户修改保持。
`--check` 与该写入模式互斥；原 `--check`、普通生成和 `--sync` 行为保留。

顺序为 Runtime 投影 → 问答来源消费 → 本地 Host 构建候选 → 原日常入口的全部来源检查。
Desktop 在持有原构建锁且客户端已退出时执行；通过后仍走原 Cargo/Go 编译和 Tauri
打包，启动前再核对源码摘要。实际 Runtime/协议/生成内容变化仍须先完成规范构建和
source-first 消费，不能自动将旧制品标为新代码。

回滚先正常退出 App，恢复旧启动脚本和与它配套的来源记录后执行原标准构建；无需数据库
迁移，不覆盖既有受审 Runtime。定向验证使用普通 JSON 来源变更和本机规范启动，
不执行攻击 fixture、权限破坏、程序替换或强杀。
