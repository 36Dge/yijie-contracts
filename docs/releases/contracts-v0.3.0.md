# contracts-v0.3.0 候选说明

## FEAT-126 R8 Runtime provenance convergence（2026-08-15）

Runtime clean checkpoint `0ce5902ed400866be0196886bb78f693a004d68d` 扩展既有
manifest-bound persistent diagnostics filter，继续保持 upstream tag/commit、Runtime
version、stable app-server schema tree、transport、method/notification 与 Host projection
不变。本候选仅将 Runtime repository provenance 刷新到该精确 checkpoint；Host consumer
必须同步消费由该 checkpoint 构建的 binary size、binary SHA-256 和 patch SHA-256。

邻仓 conformance 现在同时校验 Runtime schema projection 与精确 Git HEAD，防止 schema
未变时过期 repository provenance 被误判为通过。本轮 contract impact 为 `none`：没有修改
任何 wire、schema、transport、失败语义或安全投影。

## FEAT-126 R8 persistent diagnostics refresh（2026-08-14）

失败 R8 的 content-free no-log evidence 证明四个精确 Runtime diagnostic targets 会将
请求或会话字段持久化到 SQLite 日志。Runtime clean checkpoint
`3e4f5512d5429d9f040a6e43c89c7001098ee1a4` 将这些 targets 加入现有 replay-only filter，
保持 canonical upstream source、公共 wire、schema tree、Host projection 和 transport 不变。
本候选因此只刷新 Runtime repository provenance；Host consumer 仍须固定该 checkpoint
重建产物的 patch digest、binary SHA-256 和 size。

## FEAT-126 Runtime provenance refresh（2026-08-14）

FEAT-126 full-case R8 的 no-log corrective 在 Runtime 仓形成 clean checkpoint
`a4267e77708a23d7af79aa209f48f36ba89fbb12`。该 checkpoint 保持固定上游 tag、commit、
Runtime version、stable app-server schema tree、transport、method/notification 投影不变，
只增加 manifest-bound、可重放的持久诊断日志过滤 patch。因此本候选仅刷新
`compatibility/agent-host-runtime-v1.json` 的 Runtime repository provenance；公共 wire、
schema 和 Host projection 均无变化。Host consumer 仍须固定新的 Contracts commit、patch
digest、binary SHA-256 和 size 后才能消费该 artifact。

## 状态

- 状态：`candidate`；不是 supported release，尚未创建 tag。
- contract impact：FEAT-125 为 `semantic`；FEAT-126 产品语义为 `breaking`，但本候选以新
  `/v2` paths/schema 进行 additive expand，尚未退休 v1。
- 计划不可移动 tag：`contracts-v0.3.0`。
- Owner、需求、技术、安全、consumer Reviewer：段成威。
- 关联需求：`FEAT-125-authoritative-permission-projection`、
  `FEAT-126-public-task-authorization-hardening`。
- G2：Passed；FEAT-126历史G2A批准保留，但DEC-126-023已触发replacement re-review；
  DEC-126-024最终G2A Pending，必须由段成威基于新完整SHA单独批准。

### FEAT-126 source/generated candidate overlay（2026-08-02）

当前未发布的 `0.3.0` candidate 上增加FEAT-126 source/generated候选。段成威已于
2026-08-02接受DEC-126-023方案C并关闭Q-017：既有`c000a024`保持immutable与Draft PR不变，
本地新分支形成content-free replacement candidate。本提交仍不创建tag/downstream pin，也不
表示DEC-126-024已批准。它不会改变FEAT-125已登记的S1 commit身份：

- `POST /v2/tasks` 与 `GET /v2/tasks/{task_id}`：bearer、verified tenant selector、
  `task.create`/`task.read`、creator-private、server-derived ownership、UUID idempotency、
  no-store 与 closed stable errors；request/response仅允许closed `TaskContentReferenceV2`，无
  `title`、任意`result/error_message`或正文/path字段；匿名 `/v1/tasks*` wire 保持不变并继续双隔离。
- prompt、message、raw reasoning、自动标题正文、provider output与项目路径只属于Desktop
  SQLCipher本地数据面；不得进入Public Tasks/PostgreSQL或由opaque reference派生。
- Agent Host v2：隔离 `title-generations`、分表面 `cleanup-operations` 和必须显式
  `event_schema_version=2` 的 events stream；所有操作仍是 owner-only loopback bearer。
- AgentSessionEventV2：保留 v1 八种 lifecycle variants，仅增加 bounded raw reasoning
  delta/finalized；JSON Schema 是 SSE 权威，Proto/AsyncAPI 是等价投影。
- Host 只允许进程内 raw 聚合/有界 replay，不允许 raw 正文进入 bbolt、durable replay、
  log、metric、trace、audit、error 或 cloud；Desktop durable SQLCipher/级联删除仍是未来实现。

Source/generated identity（完整candidate commit在提交形成后登记到外部FEAT-126包，避免本文
自引用尚未形成的commit）：

| 项目 | SHA-256 / 值 |
|---|---|
| Prior immutable candidate / replacement parent | `c000a0245acb5c3f7ead5d2a877fb60c281c588c` |
| Public OpenAPI | `c8d9e6742802e0f0392ea8221a5fdd028f76107df893ab4c531da75f9e9e354b` |
| Agent Host OpenAPI | `d3bb9f33f89f03b7a2cd124e5528d3fbf72e0b88b35711d2d295f8e6959d2c71` |
| AsyncAPI | `17dc8f7042570c63140de8f388872a7b77668051e9080ecec662d2e284559248` |
| AgentSessionEventV2 JSON Schema | `b7a6494f58e274964ef5520c790f3891836c2f2cf69391ce67e5cfa00211f424` |
| AgentSessionEventV2 Proto | `a18c08df2e2805147768e9e1b7eed4f97e4b7d0aebde5b59170c7ff248f1f383` |
| TypeScript Public generated | `e84b70be6505dc5c0fc1e4702018fad2839e1a3fe74d7730883151e49928b678` |
| Go Public generated | `c3d6e58ee37157aaeeb7f9dbaf216881ba2ef3057a01f74c169a28467f3fc697` |
| TypeScript Agent Host generated | `6eeb8a77615095aa51daa74e9dc7a84006808381b46b778324d30a375742bed4` |
| AsyncAPI generated bundle | `f6b0e7d25b399d1fd4bf42f080fc5a379f21422482f3251b3087aeade5b65ac5` |
| Public create fixture | `7d366b3e44a9bd86a5c02638b152ac52d79580257ab735d634b01bc5bc73a178` |
| Public success fixture | `b08848c4ec8b617cadf3024b723dc2067b84829091d102889a7b2b7eb249200e` |
| Public access-denied fixture | `5333a781ddd9a81a290519f2948020eeec01889808b5d94e5e2f5f4d1438326f` |
| Public not-found fixture | `db2778cfce53c59b68c140d0c74a95ffa648e7cf20382ef74cf257039b2d0191` |
| Local SDK tarball | `21b17b50ee265e1ebbd7a5248880c7874c88def65c538f1216d0413e85fab082` |

以上digest标识本source/generated candidate。只有外部FEAT-126包登记本文所在的完整commit、
post-commit复验digest不变并由Owner最终批准G2A后，下游才可pin。

## 权威源与范围

本候选在 `openapi/public/public.yaml` 首次定义 Public API 的用户身份、租户选择和权限
投影边界：

- `GET /v1/me/tenants` / `listMyTenants`：返回当前已认证用户的 active tenant
  memberships，支持 0、1 和多租户选择；不接受 tenant header。
- `GET /v1/me/capabilities` / `getMyCapabilities`：要求
  `X-Yijie-Tenant-ID`，返回一个最长 5 分钟、可为空的 allow-only capability snapshot。
- operation-level `userBearer`：外部 IdP 面向 `https://api.yijie.ai` audience 的 RS256
  access JWT；API 不接受 ID token、profile claim 或 JWT role 作为业务授权事实。
- 稳定错误：`invalid_tenant_context`、`unauthorized`、`user_access_denied`、
  `tenant_access_denied`、`internal_error`、`authorization_unavailable`。
- 所有身份、租户、权限和错误响应均要求 `Cache-Control: no-store`；401 同时要求
  `WWW-Authenticate`，503 可返回 `Retry-After`。

初始 capability 治理值为 `knowledge.read`、`plugin.read`、`schedule.read`、
`store.read`、`task.create`、`task.read` 和 `workspace.use`。wire 类型保持开放的点号
字符串；符合 pattern 的未知值必须被旧 consumer 忽略，不能默认映射为权限或 UI。

## 兼容性结论

- Public OpenAPI 顶层 `security: []` 保持不变；新认证只作用于两个新 operation。
- 既有 `/healthz`、`/readyz`、`/v1/status`、`/v1/tasks` 和
  `/v1/tasks/{task_id}` 的 path、method、security、request、response 和错误语义不变。
- 新 operation 采用 provider-first：API 先实现并在非生产关闭 consumer flag，Desktop
  后调用。
- 未知公开 consumer 仍按保守假设处理；它们不调用新 operation，因此旧交互不失效。
- `contracts-v0.2.0` 继续支持 Agent Host Runtime Baseline 2；Agent Host 不迁移到 0.3.0。
- 自动 breaking 检查只证明工具覆盖范围内无结构性破坏；身份、租户、错误、缓存、
  unknown capability 和 Tasks 不变性必须进行人工 semantic/security review。

## Fixtures 与生成物

Canonical synthetic fixtures 位于 `tests/fixtures/public/access/`，覆盖：

- tenant list empty/single/multiple；
- capability ready/empty/unknown；
- 六个稳定 access error code。

`openapi-typescript` 和 `oapi-codegen` 从同一 Public OpenAPI 权威源生成 TypeScript/Go
SDK。生成文件不得手工修改。

当前固定身份：

| 项目 | 值 |
|---|---|
| S1 source/generated full commit | `ab5e71db6e4d61eb9c761446066142de2edbb444` |
| Public source SHA-256 | `7bd40dd1c5a53cc1dcd317e3a64bf7189170fd7f575b25bb07f0eb243d0319ed` |
| TypeScript generated SHA-256 | `77babb215608c6ace4468d37b72fc8e43f5758231c7807a4301063cb156ae8e0` |
| Go generated SHA-256 | `01d31efc1b1c3fb69e18c853d67ea12cdc313c2709f2a02d02e2a01b6ff4d253` |
| Runtime manifest SHA-256 | `5d374eb1b3012e08a10f8b8ce629a9ab12bbea6a11de379425cd8feaefdb8ea1` |
| Local SDK tarball SHA-256 | `43a54d7f9f01edd6b50adcebb8c3b4b645dab7ec8cf4aafe20b62d7d98718565` |
| TypeScript generator | `openapi-typescript 7.13.0` |
| Go generator | `oapi-codegen 2.7.2` |
| Toolchain | Node `26.0.0`、pnpm `11.9.0`、Go `1.26.5` |

最终 S2 candidate full commit 与 SDK tarball SHA-256 在 evidence commit 形成后写入外部
FEAT-125 需求包，避免在候选自身文档中创建不可满足的 commit 自引用。

## 候选门禁

候选必须全部通过：

```bash
pnpm install --frozen-lockfile
make generate
make lint
make test
make build
pnpm pack:sdk
./scripts/check-breaking.sh f16a497e1377f45747f8ff9292b4b60cf2027f88
```

还必须人工确认：

1. 两个新 operation 的 auth、tenant、response、error、cache 和 retry 语义与
   FEAT-125/ADR-0012 一致；
2. `authorization_revision` 位于 `1..9007199254740991`，TypeScript 不会静默丢精度；
3. capability 是开放字符串，unknown fixture 有效，已批准的 7 个治理值未变；
4. 旧 Tasks wire 没有任何 diff；FEAT-125 不把 capability projection 当作 Tasks 授权；
5. API/Desktop 未实现、未 pin、未做 conformance，`G2A` 和 FEAT-124 `G4-001` 继续阻断。

FEAT-126 overlay 还必须人工确认：

1. Public Tasks v1 两个 paths、Agent Host v1 七个 paths 与支持基线结构相等；新错误码不进入
   v1 closed `ErrorResponse`。
2. Public Tasks v2 不接受 client-supplied tenant/creator，读取默认 creator-private；request、
   response与fixtures只能含closed、content-free metadata/reference，正文/title/path/raw canary必须
   被schema拒绝；未知外部consumer继续走versioned expand。
3. Raw finalized 替换 delta buffer，closed reason/status 与 UTF-8 aggregate caps 一致；Host 无
   durable raw sink。
4. Title response 不包含 prompt/provider/ephemeral/path，cleanup `200` 不能代表 Desktop/OS/磁盘
   全表面清除。
5. DEC-126-023方案C已Accepted且Q-017已关闭；replacement完整commit的post-commit复验、
   DEC-126-024 Owner最终G2A review与downstream exact pin未完成前，不恢复LIA-126-002，所有
   业务flags保持关闭。

## FEAT-126 本地候选证据（2026-08-02）

| 检查 | 结果 | 说明 |
|---|---|---|
| `pnpm generate` | PASS | OpenAPI/Proto/JSON Schema/AsyncAPI generated sources 同步 |
| `pnpm lint` | PASS | Redocly、JSON Schema、Buf、TypeScript、Go vet |
| `pnpm test` | PASS | 29 generated files current；Node 27/27；Go packages PASS |
| `pnpm build` | PASS | 再生成与 TypeScript build 完成 |
| `pnpm pack:sdk` | PASS | 本地 `@yijie/contracts@0.3.0` tarball；未发布 registry |
| v0.2.0 breaking check | PASS | OpenAPI/Buf/AsyncAPI/JSON Schema；修复 v2 error enum 隔离后无 v1 enum warnings |
| Legacy wire equality | PASS | 新增可重复执行的reference-closure checker；Public Tasks v1 2 paths + Agent Host v1 7 paths相对`f16a497`完全相等 |
| Fixture/schema/SDK conformance | PASS | Public Tasks v2定向3/3；closed request/success/error fixtures与生成TS/Go DTO一致；全仓测试计入上述27/27 |
| 下游runtime conformance | NOT RUN | DEC-126-024前禁止修改或pin API/Host/Desktop；不把source-level conformance冒充下游实现证据 |

## S1/S2 本地证据（2026-08-01）

| 检查 | 结果 | 说明 |
|---|---|---|
| Frozen install | PASS | lockfile 未变化；本机已配置 runtime，使用 `--no-runtime` 避免重复下载 |
| Red→Green access contract tests | PASS | 基线 3/3 按预期失败；权威源完成后 3/3 通过 |
| `make generate` | PASS | Go/TypeScript generated sources 同步 |
| `make lint` | PASS | OpenAPI、AsyncAPI、JSON Schema、Buf、TypeScript、Go vet |
| `make test` | PASS | 26 generated files current；Node 16/16；Go packages PASS |
| `make build` | PASS | 生成与 TypeScript build 完成 |
| `pnpm pack:sdk` | PASS | 本地 `@yijie/contracts@0.3.0` tarball；未发布 registry |
| v0.2.0 breaking check | PASS | oasdiff/Buf/AsyncAPI/JSON Schema 相对完整 baseline 无 breaking |
| Legacy Public semantic equality | PASS | 5 个既有 paths、5 个既有 schemas、global security 与 servers 与 v0.2.0 相等 |
| Runtime projection semantic equality | PASS | 除 bundle version `0.2.0→0.3.0` 外完全相等 |
| v0.2.0 remote provenance | PASS | annotated tag object `c6e8577...` peeled 到 `f16a497...` |

首轮完整 `make test` 正确发现 Runtime compatibility manifest 的 bundle version 仍为
`0.2.0`；修正为 `0.3.0` 后重新生成并完整通过。该修正只更新 package provenance，未改变
Runtime repository commit、schema digest、methods、notifications、transport 或安全投影。

## 合并、发布与回滚

1. 段成威已于2026-08-02接受FEAT-126 DEC-126-023方案C；这一步只授权形成本地replacement
   candidate，不等于DEC-126-024通过或实现授权。
2. 契约候选形成本地完整commit并复验source/generated/SDK digest；不push、merge、tag或publish。
3. 段成威基于完整SHA、digest、generator、breaking、v1 equality和consumer conformance单独
   批准DEC-126-024/G2A。
4. DEC-126-024前不得恢复LIA-126-002，也不得修改API/Host/Desktop业务源码。
5. 本地实现后如需主线整合，须满足DEC-126-022另行审批；tag、package publish与deploy均不在
   当前Local-only Delivery范围。

回滚方式是保持下游 feature flag 关闭并继续使用 `contracts-v0.2.0`。未完成 FEAT-126
前，生产 `/v1/tasks*` 必须继续由 ingress deny 与 service handler non-registration
双隔离；本候选只定义v2资源级授权wire，不提供已运行的授权实现。
