# Versioning

契约发布使用 `contracts-vX.Y.Z`，SDK 包版本与 tag 中的 `X.Y.Z` 保持一致。
当前及历史支持窗口登记在 [`supported-baselines.md`](supported-baselines.md)。

- 兼容性基线包含所有仍受支持或处于生产兼容窗口的不可移动 tag 及其完整 commit，不能只检查最新 tag；尚无发布版本时使用明确 fallback baseline 的完整 commit；未打 tag 的生产 commit 只允许作为已登记的历史遗留或获批紧急例外；
- 新增端点、消息、可选字段或生成物通常提升 minor，但必须先按输入/输出方向证明旧端兼容；
- 删除、重命名、增加 required 或收紧约束若使任一受支持基线下的有效交互失效，则必须发布新 major 版本并提供兼容期；否则仍按输入/输出方向评审和分阶段发布；
- 默认值、错误、认证、权限、幂等、顺序、单位和 enum/event 扩展即使结构检查绿色，也按 `semantic` 评审并根据真实 consumer 影响决定 minor 或 major；
- 第一个可消费的 Agent Host 契约版本为 `contracts-v0.2.0`；在 tag 创建前只视为候选版本；
- tag 只在源契约、生成物、breaking check、迁移/发布说明，以及下游针对最终 candidate commit 的非生产同步/conformance 全部通过后创建；tag 必须指向该同一 commit。

同一未发布候选版本可以累积经评审的兼容修订；远端完整 commit 可用于非生产跨仓
集成。tag 一旦创建不得移动或覆盖，后续任何源契约变化进入下一版本。生产发布只使用
不可移动 tag。

tag 创建后，下游还必须验证 tag 解析到已测试 commit 且 digest 未变，才能把 provenance
切为 tag 并宣称 supported/release-ready。

下游发布必须记录精确 tag、完整 commit 和可用时的 digest/generator 版本。短 SHA、
浮动分支、未创建的 tag 或 dirty sibling 不能充当已发布版本引用。

TypeScript registry 尚未确定前，CI 只构建并校验本地 SDK 产物，不自动发布到公共 registry。Go 消费者使用 Git tag 固定版本。
