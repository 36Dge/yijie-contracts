# Breaking Change Policy

兼容结论必须说明数据流方向和真实 producer/consumer 行为，不能只看结构 diff。

## 潜在 breaking 或 semantic change

- 删除、重命名、增加 required、收窄类型/格式/范围、改变 null/omitted；是否实际 breaking 还需按输入/输出方向判断；
- 删除或新增可能被穷举处理的 enum/event variant；
- 为 closed request schema 新增旧 provider 不接受的字段；
- 为 response/event 新增旧 strict consumer 不接受的字段或消息；
- 改变 default、单位、时区、排序、分页、状态码、错误码或重试语义；
- 改变认证、租户、权限、scope、审批、审计、幂等、顺序或终态；
- 复用 Protobuf tag，或改变既有字段 wire 类型；
- 改变 SDK 公共签名、Runtime 能力投影或版本匹配规则。

因此新增 optional 字段、新 enum 或新事件不天然兼容：

- request/input：provider 先接受，consumer 后发送；
- request/input enum：provider 先支持，consumer 后发送；
- response/output enum/event：consumer 先容忍 unknown 或先升级，producer 后发出；
- 新 operation：provider 先部署，consumer 后调用。

## 处理方式

若 semantic change 使任一仍受支持基线下曾经有效的交互失效，必须升级分类为
breaking。只有 breaking change 强制使用 expand 或新 major/versioned endpoint/message：

1. 新旧契约并存，保留兼容窗口；
2. producer 支持双轨；
3. consumers 固定新契约并迁移；
4. 观测确认旧版本没有有效消费；
5. 标记弃用并按计划清理；
6. 更新 SDK、迁移文档、下游清单、发布顺序和回滚。

提交 PR 前列出所有仍受支持或处于生产兼容窗口的 tag + 完整 commit，并逐一运行
`./scripts/check-breaking.sh <baseline>`。只有尚无发布版本时才使用明确 fallback
baseline 的完整 commit；未打 tag 的生产 commit 只允许作为已登记的历史遗留或获批
紧急例外。CI 当前只相对 `origin/main` 使用 oasdiff、Buf、JSON Schema 和 AsyncAPI
检查结构性破坏，不能冒充多基线覆盖。

自动检查没有覆盖全部业务语义、跨格式投影、实现符合性和 consumer 解码行为。绿色结果
仍需人工与 consumer review。证明兼容的 semantic change 可以按实际影响提升 minor 并
分阶段发布；合法 major 演进必须通过新版本并行，而不是关闭检查。
