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
- `docs/`：设计、版本、迁移和发布规则。

同一业务概念出现在 OpenAPI、Protobuf、AsyncAPI 和 JSON Schema 中时，必须明确哪个表示是权威源以及为什么需要多个表示，并增加一致性检查。不要复制后独立演进。

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

- 默认采用向后兼容的增量变更：新增可选字段、新端点或新消息；
- 删除/重命名字段、增加 required、收窄类型或格式、移除 enum、改变默认值或错误语义均视为潜在 breaking change；
- breaking change 必须有新版本、兼容期、迁移文档、下游清单、发布顺序和回滚方案；
- `pnpm breaking` 默认对本地 `main` 检查，执行前确认基线存在且符合本次发布基线；CI 使用 `origin/main`；
- 自动检查未覆盖所有 JSON Schema 约束变化、业务语义和跨格式一致性，结果为绿色仍需人工审查；
- 发布 tag 使用 `contracts-vX.Y.Z`，版本号和兼容承诺必须与实际变化一致。

## 生成物与跨仓流程

- 只修改源契约和生成脚本，然后运行 `pnpm generate`；
- 生成后检查完整 git diff，生成文件必须与源文件在同一变更中提交；
- 不手工修补 `*.gen.*`、`*.pb.go` 或 SDK entrypoint；生成结果错误时修复源或 generator；
- `pnpm test` 会重新执行生成检查，源与生成物不一致时失败并可能留下工作区改动；运行前后都要检查状态；
- 契约合并和可消费版本先于下游实现，下游按生产者、服务、客户端和发布依赖顺序更新；
- 跨仓变更需要列出所有消费者，并在各自仓库按其 `AGENTS.md` 生成、实现和测试。

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
make breaking # 默认相对本地 main
./scripts/check-breaking.sh origin/main # 需要远端生产基线时显式指定
make build    # 生成并编译 TypeScript SDK
pnpm pack:sdk # 构建本地 SDK tarball；不向未确认 registry 发布
```

- 任意源契约或 generator 改动至少执行 `make generate && make lint && make test`；
- 已发布契约改动还必须执行正确基线的 breaking check；
- AsyncAPI 变更执行 Redocly lint、bundle 生成同步和 breaking check，并额外人工检查跨格式语义；
- 运行生成前记录工作区状态，禁止覆盖用户尚未提交的生成物改动。

## 完成标准

- 业务语义、Owner、消费者、安全边界和失败模型已经明确；
- 源契约与所有生成 SDK 同步，没有手改生成文件；
- 自动 lint、测试和正确基线的 breaking check 通过；
- 人工审查补足自动检查无法覆盖的语义和跨格式兼容性；
- 下游仓库、兼容期、迁移、发布及回滚顺序已经记录；
- 未定义的认证、AsyncAPI 生成或端到端验证被如实说明。
