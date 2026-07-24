# AGENTS.md

## 适用范围

本文件适用于 `yijie-contracts` 整个仓库。契约类型目录中若出现更具体的 `AGENTS.md`，修改对应目录时以更具体的规则为准。

## 仓库职责与当前状态

`yijie-contracts` 是易界多仓项目的契约源和 SDK 生成中心，负责 OpenAPI、Protobuf、AsyncAPI、JSON Schema、兼容性检查及 Go/TypeScript 生成产物。这里定义跨进程、跨仓库和持久发布的接口语义，不实现业务逻辑。

当前仓库已经包含：

- Public、Admin 和 Internal 三组 OpenAPI；
- Agent Host 本机 HTTP/SSE OpenAPI；
- Agent Host 服务与任务事件 Protobuf；
- 任务事件 AsyncAPI；
- Codex Runtime 与 Agent Host 投影的机器可校验兼容清单；
- Agent、Audit、Chat、Listing、Skill 和 Task JSON Schema；
- 提交到 Git 的 Go/TypeScript SDK 生成产物；
- OpenAPI、Protobuf、JSON Schema 和 AsyncAPI 结构性破坏检查。

当前仍需如实区分的能力：

- Public、Admin 和 Internal 三组 OpenAPI 目前均为 `security: []`，认证、授权和服务身份尚未形成生产契约；Agent Host 仅定义本机 owner-only bearer 边界；
- AsyncAPI 会由 Redocly 校验并打包为单文件产物，但不生成特定 broker 的客户端；
- JSON Schema/AsyncAPI breaking checker 覆盖常见结构约束变化，仍不能代替人工业务语义兼容性评审；
- 契约生成和校验通过不代表下游实现、部署或端到端兼容已经完成。

## 仓库边界

- 不实现 handler、业务规则、数据库访问、外部平台 client 或 Runtime 行为；
- 不提交真实 token、cookie、DSN、PII、订单、商家经营数据或生产 payload；
- 不让下游仓库手写与本仓库生成类型重复的 DTO；
- 不把某个服务的内部数据库模型直接发布为公共契约；
- 不在缺少业务语义、Owner 和消费者确认时猜测字段、枚举、认证或错误模型；
- 不通过关闭 lint、跳过 breaking check 或手改生成文件解决兼容问题。

## 目录与权威来源

- `openapi/public/`：Desktop 等外部客户端使用的公共 HTTP API；
- `openapi/admin/`：Admin Web 使用的管理 HTTP API；
- `openapi/internal/`：服务间 HTTP API；
- `openapi/agent-host/`：Desktop 与本机 Agent Host 的 HTTP/SSE API；
- `protobuf/yijie/`：版本化 RPC 和事件消息；
- `asyncapi/`：异步 channel、operation 和 message 语义；
- `jsonschema/`：跨工具、Skill、审计和文档边界的结构约束；
- `sdks/go/`、`sdks/typescript/`：生成产物，禁止手工编辑；
- `scripts/`：生成、验证和 breaking check 的唯一自动化入口；
- `docs/`：设计、版本、迁移和发布规则；`docs/supported-baselines.md` 是支持窗口清单。

同一业务概念出现在 OpenAPI、Protobuf、AsyncAPI 和 JSON Schema 中时，必须明确哪个表示是权威源以及为什么需要多个表示，并增加一致性检查。不要复制后独立演进。

## Contract First 合并门禁

仓库级执行流程见 `docs/contract-change-policy.md`。每个任务在修改实现前必须标记
`contract-impact = none | additive | semantic | breaking`；选择 `none` 必须说明为什么
没有改变跨进程、跨仓库、跨版本或持久化/重放边界的可观察行为。

分类按 `breaking > semantic > additive > none` 的最高风险唯一选择：任一仍受支持端
可能失败或错误解释时为 breaking；改变既有值/操作的解释、默认或行为，但经方向性
验证仍兼容时为 semantic；只有新增能力且不改变既有交互解释时才是 additive。无法
确认时不能假定 additive。

本节当前是强制人工合并/发布规范；本仓 CI 已自动执行结构、生成和 breaking 检查，
但 PR body、Owner/consumer 审批、逐仓 pin 和 branch protection 尚未全部机器化。

契约影响不只指 DTO 字段，还包括路径、方法、header、状态码、错误码、null/default、
enum、单位、分页、排序、认证、租户、权限、scope、审批、幂等、trace、审计、事件
channel/key/顺序/重复/重试/重放/终态、MCP tool 风险及失败语义、SDK 公共签名和
Runtime 能力投影。`semantic` 的判断与结构形状是否改变无关；即使形状不变，行为
语义变化也至少属于 `semantic`。

易界拥有的跨仓 wire contract 必须先在本仓形成权威源。两个权威源特例不能被机械
倒置：

- Codex app-server 的上游 tag/commit 与 canonical schema 是 Runtime 协议权威；`compatibility/**` 是易界允许 Host 使用的稳定投影权威；`yijie-codex` 完整 commit/schema digest 是身份与一致性证据；
- 第三方平台 API/webhook 以当前官方规范为权威，Connectors 负责适配；易界归一化的公共 tool/API/event 仍以本仓为源。

纯进程内领域模型、服务私有数据库/缓存格式、部署配置和不可发布试验通常不属于本仓
契约，分别走本仓 migration/data/deployment compatibility；不得把这些模型直接发布为
wire DTO。只有被独立发布单元消费，或成为跨版本 durable event、audit、replay/public
payload 时才进入本仓契约判定。

契约变更必须完成以下门禁：

1. 明确 contract ID/权威源、Owner、producer、全部已知/登记 consumers、输入/输出方向、安全与失败语义、兼容窗口和回滚；
2. 修改所有受影响且适用的源契约、示例/fixture、生成物和一致性测试，检查并按需更新版本/发布说明，执行 generate、完整 diff、lint、test，并对所有适用基线逐一执行 breaking check；若没有已发布基线，必须记录明确 fallback baseline 的完整 commit；
3. additive 在存在 consumer 时至少由一个代表性 consumer Owner 评审；semantic/breaking 由所有受影响 consumer Owner 确认或逐仓记录例外；`unknown-public` 按最保守兼容假设并由 SDK/代表性客户端 Owner 评审；全新无 consumer 契约由架构及适用时的安全 Owner 评审；
4. 契约 PR 满足计划版本、评审与检查后先合并，形成不可变完整 commit；生产发布必须使用不可移动 tag；
5. 每个下游实现 PR 在自身合并前固定精确版本、完整 commit 和可用时的 digest/generator 版本，使用生成物或同源 validator，并增加 producer/consumer conformance；
6. provider 是否可激活新能力或发出新值按输入/输出方向决定；provider-first 变更不要求所有 consumers 先 pin，response/event/breaking 切换不得早于相应 consumers 就绪。

下游 draft 可以在契约草案稳定后并行开发，但不能先合并或上线再补契约。dirty 或浮动
sibling 工作树只能用于本地候选验证，不能作为可发布 SDK/快照的来源。

## 契约设计规则

- 每次变更先确定生产者、消费者、传输方式、Owner、兼容窗口和失败语义；
- OpenAPI `operationId`、路径、方法、状态码和错误码发布后保持稳定；
- 请求与响应明确 `required`、`nullable`、长度、格式、枚举和 `additionalProperties` 语义；
- 身份、租户和权限应来自已确认的安全模型，不能长期依赖客户端任意提交的 `tenant_id`；
- 分页、幂等、时间、金额、时区、trace、错误和重试语义必须明确，不用自由文本代替机器可判定字段；
- Protobuf 新字段使用新编号，删除字段时保留编号和名称，禁止复用 tag；
- 事件必须定义 key、顺序、重复、幂等、版本、时间、重放和终态语义；
- JSON Schema 的 `$id`、title 和文件路径保持稳定，收紧约束也按潜在 breaking change 处理；
- 示例只使用合成或公开数据，并同时验证成功、错误和边界情况。

## 认证与安全契约

当前 OpenAPI 尚未定义认证。引入 security scheme、服务身份、session、OAuth、API key、mTLS、租户上下文或 RBAC 前必须由用户结合系统安全设计明确确认。

- Public、Admin 和 Internal API 的信任边界必须分别定义，不能共用模糊的默认方案；
- 敏感字段应最小化，并在 schema 中说明用途、可见范围、保留和脱敏要求；
- token、secret、cookie 和平台凭据不得出现在 schema 示例、默认值、生成代码或测试 fixture；
- 管理和高风险操作必须表达授权、审批、幂等和审计所需上下文；
- ErrorResponse 不泄露内部堆栈、SQL、DSN、平台响应原文或秘密。

## 兼容性与版本

- 默认采用可分阶段部署的增量变更，但“新增”不自动等于端到端兼容；
- 新请求字段先由 provider 接受，再由 consumer 发送；新端点先部署 provider，再启用调用方；
- 新 request/input enum 值先由 provider 接受再由 consumer 发送；新响应字段、response/output enum 值或事件变体必须先证明旧 consumer 容忍未知值，或先升级 consumer，再由 producer 发出；
- 删除/重命名字段、增加 required、收窄类型或格式、移除 enum、改变默认值或错误语义均视为潜在 breaking change；
- semantic change 必须人工证明兼容；若使任一仍受支持的有效交互失效，升级为 breaking；
- breaking change 必须采用 expand 或新版本、producer 双轨、consumer 迁移、观测、弃用和清理，并有兼容期、下游清单、发布顺序和回滚；
- `pnpm breaking` 默认对本地 `main` 检查；发布评审必须额外对所有适用基线逐一执行，若没有已发布基线则记录 fallback baseline 完整 commit；CI 当前只使用 `origin/main`，不能冒充多基线覆盖；
- 自动检查未覆盖默认值、null/omitted、权限、错误、幂等、顺序、实现符合性和所有跨格式变化，结果为绿色仍需人工与 consumer 审查；
- 发布 tag 使用 `contracts-vX.Y.Z`，版本号和兼容承诺必须与实际变化一致。

## 生成物与跨仓流程

- 只修改源契约和生成脚本，然后运行 `pnpm generate`；
- 生成后检查完整 git diff，生成文件必须与源文件在同一变更中提交；
- 不手工修补 `*.gen.*`、`*.pb.go` 或 SDK entrypoint；生成结果错误时修复源或 generator；
- `pnpm test` 会重新执行生成检查，源与生成物不一致时失败并可能留下工作区改动；运行前后都要检查状态；
- 契约合并和不可变可消费引用先于每个下游实现 PR 合并；下游记录 version、完整 commit、可用时的 digest/generator 版本，并按方向性发布依赖更新；
- 跨仓变更需要列出所有已知/登记 consumers，并在各自仓库按其 `AGENTS.md` 生成、实现和测试。

## 必须先确认的决策

- API/事件的 Owner、消费者、业务语义、字段必填性和错误模型；
- Public、Admin、Internal 的认证、授权、租户和服务身份方案；
- breaking change、版本号、兼容期、弃用和跨仓发布顺序；
- AsyncAPI 与 Protobuf/JSON Schema 的权威关系和生成策略；
- SDK 支持语言、包名、发布 registry 和版本绑定方式；
- 新 generator、依赖、格式规范或需要真实数据的示例与测试。

## 开发与验证

统一使用 pnpm，不混用 npm 或 yarn，并提交 `pnpm-lock.yaml`、`go.mod` 和 `go.sum`。

```bash
pnpm install --frozen-lockfile
make generate # 重新生成并写入 SDK 文件
make lint     # OpenAPI、JSON Schema、Protobuf、TS 和 Go 静态检查
make test     # 生成物同步、契约测试和 Go 测试
make breaking # 技术默认相对本地 main，不能单独作为发布证据
./scripts/check-breaking.sh <full-baseline-commit> # 使用 supported-baselines.md 登记的固定完整 commit
make build    # 生成并编译 TypeScript SDK
pnpm pack:sdk # 构建本地 SDK tarball；不向未确认 registry 发布
```

- 任意源契约或 generator 改动至少执行 `make generate && make lint && make test`；
- 已发布契约改动还必须逐一执行所有适用基线的 breaking check；无已发布基线时记录明确 fallback baseline 完整 commit；
- AsyncAPI 变更执行 Redocly lint、bundle 生成同步和 breaking check，并额外人工检查跨格式语义；
- 运行生成前记录工作区状态，禁止覆盖用户尚未提交的生成物改动。

## 完成标准

- 业务语义、Owner、已知/登记 consumers、安全边界和失败模型已经明确；
- 源契约与所有生成 SDK 同步，没有手改生成文件；
- 自动 lint、测试和全部适用基线的 breaking check 通过；无已发布基线时已有明确 fallback baseline 完整 commit；
- 人工审查补足自动检查无法覆盖的语义和跨格式兼容性；
- 下游仓库、兼容期、迁移、发布及回滚顺序已经记录；
- 当 `contract-impact != none` 时，交付说明包含权威源、Owner/producer/consumers、契约 PR/tag/完整 commit、全部适用 breaking 基线或 fallback 完整 commit、下游 pin 和 conformance 证据；`none` 只需保留分类理由；
- 未定义的认证、AsyncAPI 生成或端到端验证被如实说明。
