# 原生执行进展候选投影

2026-11-03，Owner 批准复审后的实施，并允许仅本地提交本次修复和 canonical 版本引用，不推送、不打 tag。

`contract-impact = semantic`：普通聊天连续相同的已接受计划进入现有原生有界收尾；Host 直接配置既有 `features.rollout_budget`，不自建预算。原生 `SessionBudgetExceeded`、失败/取消、权限、审批、历史及 app-server schema 保持。当前 269 文件 schema 与上一受审产物逐字节一致；新增补丁仅为私有进展判断，没有新公共字段、诊断枚举或数据库格式。

权威源是 `yijie-codex` 的 canonical `execution-progress-v1`，由 `scripts/generate-runtime-kimi-k31-pro.mjs` 校验二进制、完整补丁链、schema、固定上游及不可变 Runtime 源提交。生成的 Go 常量和 source lock 不手工编辑。随后通过原 `sync-kimi-k31-pro-contracts.py` 从本仓不可变提交派生 Host/Desktop 引用。

准确的 Runtime SHA、来源 commit 和 manifest 以生成 lock 为准。旧产物与历史保留；本机接入只在消费者来源与实际构建检查通过后进行，旧 Host 不自动接受新产物。不把源码或回环协议测试当成真实 Kimi 效果验证。没有外部发布或生产兼容窗口变更。
