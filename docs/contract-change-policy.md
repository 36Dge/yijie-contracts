# Contract Change Policy

## 1. 目的与适用范围

本文把易界项目级 Contract First 决策落实为 `yijie-contracts` 的合并和发布流程。
它适用于 OpenAPI、Protobuf、AsyncAPI、JSON Schema、兼容投影、生成器及公开 SDK
表面的新增、修改、弃用和删除。

本文不把纯进程内领域模型、服务私有数据库/缓存格式、部署配置或第三方原始协议强行
纳入中央仓库；它们分别走所属仓 migration/data/deployment compatibility。任何易界
拥有、被独立发布单元消费，或作为跨版本 durable event、audit、replay/public payload
的表面必须先有权威契约。

本文是强制人工合并/发布规范。本仓 CI 已自动化结构、生成和 breaking 检查，但 PR
body、Owner/consumer 审批、逐仓 pin 和 branch protection 尚未全部机器化，不能宣称
不可绕过的工程门禁已经闭环。

## 2. 变更开始前

在 PR 和交付说明中填写：

- `contract-impact = none | additive | semantic | breaking`；
- contract ID 与权威源路径；
- Owner、producer、全部已知/登记 consumers 和按影响级别要求的 reviewer；
- 输入/输出方向、业务语义、错误、幂等、认证、权限、审批和审计影响；
- 兼容窗口、合并/部署顺序、迁移、观测和回滚。

分类按 `breaking > semantic > additive > none` 的最高风险唯一选择。任一仍受支持端
可能失败或错误解释时为 breaking；改变既有值/操作的解释、默认或行为，但经方向性
验证仍兼容时为 semantic；只有新增能力且不改变既有交互解释时才为 additive。`none`
必须证明没有跨边界可观察变化。无法确认 consumer 或兼容方向时不能假定 additive，
先由用户或契约 Owner 确认。

在机器可读 contract catalog 建立前，contract ID 使用稳定权威源相对路径；文件内
多契约使用 `<path>#<operation/message/schema>`。不得临时发明不可追踪别名。

## 3. 权威源与派生物

| 类型 | 权威源 | 派生物 |
|---|---|---|
| HTTP | `openapi/**` | TypeScript/Go SDK、快照、文档 |
| RPC / wire event | `protobuf/**` | `*.pb.go`、`*_pb.ts` |
| 异步 channel/operation | `asyncapi/**` | AsyncAPI bundle |
| JSON/SSE/shared payload | `jsonschema/**` | TypeScript types、validator/快照 |
| Runtime 上游协议 | 固定 Runtime tag/commit 产生的 canonical schema | `yijie-codex` 完整 commit 与 schema digest 是身份/一致性证据 |
| Agent Host Runtime 投影 | `compatibility/**` 中易界允许使用的稳定子集 | consumer snapshot 与双向兼容测试 |

同一概念有多个表示时必须声明唯一 payload 权威源和投影关系，并增加跨格式一致性测试。
禁止直接改 `sdks/**` 或让复制出来的下游快照独立演进。

Codex app-server 和第三方平台协议是外部权威源特例：Runtime candidate 可以先提交，
以产生完整 SHA 和 canonical schema，但此时不得宣称为易界受支持 baseline；本仓随后
固定兼容投影，Agent Host 消费后才能完成受支持晋升。该特例不允许下游跳过本仓投影
直接发明易界协议。

## 4. PR 阶段门禁

### 4.1 设计

- 明确 operation/message/tool 的成功、失败、边界和安全语义；
- OpenAPI 明确 path/method/header/status/error 与 schema；
- Protobuf 新增 tag，不复用已发布编号，删除时 reserve；
- 事件明确 channel、key、ordering、delivery、dedupe、retry、replay 和 terminal；
- JSON Schema 明确 required、null/omitted、additionalProperties、enum、format 和版本；
- 所有受影响且适用的示例只使用合成或公开数据，并验证为契约有效；不适用项写 `N/A`。

### 4.2 生成与验证

```bash
pnpm install --frozen-lockfile
make generate
git diff
make lint
make test
./scripts/check-breaking.sh <full-baseline-commit>
```

基线清单见 [`supported-baselines.md`](supported-baselines.md)。必须列出所有仍受支持
或处于生产兼容窗口的 tag + 完整 commit，并逐一执行检查。只有尚无发布版本时才使用
明确 fallback baseline 的完整 commit；未打 tag 的生产 commit 只允许作为已登记的历史
遗留或获批紧急例外。CI 当前只检查 `origin/main`，不能冒充多基线覆盖。自动检查绿色
后仍要人工检查默认值、错误、权限、幂等、单位、排序、事件量、时序和 consumer 行为。

### 4.3 评审与可消费引用

- additive 在存在 consumer 时至少由一个代表性 consumer Owner 认可；
- semantic/breaking 由所有受影响 consumer Owner 确认，或逐仓记录获批例外；
- 公开未知 consumers 标为 `unknown-public`，按最保守兼容假设并由 SDK/代表性客户端 Owner 评审；全新无 consumer 契约由架构及适用时的安全 Owner 评审；
- 所有受影响且适用的源契约、生成物、测试、版本和迁移/发布说明在同一可审查变更中；不适用项写 `N/A`；
- 契约 PR 在计划版本、评审与检查齐全时即可合并，随后形成完整 candidate commit；下游先从该精确 commit 做非生产同步/conformance，全部通过后才创建指向同一 commit 的不可移动 `contracts-vX.Y.Z` tag；
- tag 创建后，下游必须验证 tag 解析到已测试 commit 且 digest 未变，再把 provenance 切为 tag；完成后才能晋升为 supported/release-ready；
- 下游 draft 可并行；每个下游实现 PR 在自身合并前固定不可变 contract ref，功能激活再按方向矩阵决定。

“契约 PR ready”与“跨仓交付 complete”是两个状态。前者不能预先拥有合并后的最终
commit，只要求计划版本、检查和评审；后者才要求最终完整 commit/tag、下游 pin、
conformance 和 rollout 证据。

## 5. 方向性兼容矩阵

| 变化 | 可能失败的旧端 | 必须的发布顺序 |
|---|---|---|
| 新 optional request 字段 | closed/strict provider | provider 先接受，consumer 后发送 |
| 新 endpoint / RPC | 旧 provider | provider 先支持，consumer 后调用 |
| 新 response 字段 | strict consumer | consumer 容忍/升级后，producer 再返回 |
| 新 request/input enum 值 | 旧 provider | provider 先支持，再由 consumer 发送 |
| 新 response/output enum 值 | exhaustive consumer | consumer 先支持 unknown/新值，再由 producer 发出 |
| 新 event variant/message | closed union consumer | consumer 先升级或证明容忍，再启用 producer |
| required、删除、重命名、收窄 | 取决于输入/输出方向 | 若使基线下有效交互失效则 breaking；否则仍按方向分阶段 |
| durable event/audit/replay payload | 新旧 reader/writer | 同时验证旧数据→新 reader 与新数据→回滚旧 reader；必要时版本字段、dual reader/writer 和 migration |
| default/error/auth/idempotency 改变 | 依赖旧语义的任一端 | 按 semantic/breaking 评审并同步安全与回滚 |

因此“新增 optional 字段”“新增 enum”“新增事件”不能被笼统标成兼容。兼容结论必须
说明数据流方向、读写双方和真实 decoder/validator 行为。任何变化若使仍受支持基线下
曾经有效的 request、response、event 或旧端行为失效，就归类为 breaking；兼容的
semantic 澄清不强制 major/双轨，但仍需人工评审和分阶段发布。

## 6. 下游消费门禁

下游必须：

1. 固定 contract version、完整 commit、可用时的 digest 和 generator 版本；
2. 从生成物或同源 validator 接入，不手写影子 wire DTO；
3. 将 wire DTO 与 domain model 用显式 mapper 隔离；
4. CI 检查 snapshot/生成物漂移；
5. producer 验证实际输出符合契约，consumer 覆盖 unknown、失败、取消、重试和版本不兼容；
6. 在 PR 中链接 contract ref、已知/登记 consumer 列表、合并/部署顺序和回滚。

从相邻 dirty/floating 工作树同步仅用于本地候选验证。它不能生成生产发布证据，也不能
被标记为已发布 tag。

## 7. 禁止与例外

禁止：

- 先合并 endpoint/event/tool/DTO，再补 contract；
- 手改生成文件、复制 schema、跳过 breaking 或降低严格度来掩盖不兼容；
- 在 consumers 未迁移时多仓硬切；
- 用不存在的 tag、短 SHA 或未记录来源的 snapshot 声称版本已固定。

不发布的 spike 可以使用隔离临时类型，但不得进入可发布分支、默认启用或被兄弟仓依赖。
暂无 generator 时，只允许显式 adapter、同源 conformance test，以及记录 Owner、期限和
移除条件的例外。

线上事故优先回滚或禁用。若安全事故确实无法等待常规流程，必须取得用户明确确认并
记录原因、范围、consumer、期限、回滚和补偿 PR；不得让未文档化的跨边界形状长期上线。

例外记录在 PR 模板的“临时例外”字段并链接带 Owner、到期日和补偿 PR 的跟踪 Issue。
自动到期检查尚未接通，由 reviewer/Owner 负责追踪。

## 8. 完成定义

契约 PR 在计划版本、评审和仓内检查齐全后可以先合并。以下证据齐全后，才能声明
整个跨仓交付完成：

- contract-impact 与方向性兼容结论；
- 权威源、Owner、producer、已知/登记 consumers 和分级 consumer review/例外；
- 所有受影响且适用的源契约、生成物、测试和迁移/发布说明；
- 全部适用 breaking 基线，或无已发布基线时的 fallback 完整 commit、自动结果和人工语义审查；
- 不可变 tag/完整 commit 与下游 version/commit/digest pin；
- producer/consumer conformance、部署顺序、兼容窗口、观测和回滚。

独立 CI 因缺少 sibling 而跳过的检查、未创建的 tag、占位 generator 和未迁移 consumer
必须明确列为未完成。
