# Supported Contract Baselines

## 当前状态（2026-08-25）

### 已发布支持基线

- 版本：`0.2.0`
- 不可移动 tag：`contracts-v0.2.0`
- 完整 commit：`f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 状态：`supported`
- 远端可用性：2026-08-01 已复核远端 annotated tag object
  `c6e8577dc68c0962bb16bfed0550b48c18fc9f47`，其 peeled commit 为
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`
- producer/Owner：`yijie-agent-host` / Agent Runtime Team
- 已验证 consumer：`yijie-agent-host`
  `34e94acf293f6daad61c4d42fa47028a2d1318e4`
- 支持范围：Agent Host Runtime Baseline 2 的本机 HTTP/SSE、Agent session event 和
  Codex Runtime `0.144.6` 稳定投影
- 尚未进入范围：Desktop 正式消费、cloud runner、平台身份、MCP、工具和审批
- 兼容窗口：在明确登记 deprecation/unsupported 条件前持续支持
- 回滚：回退 Host 的契约 snapshot 并禁用 Baseline 2 对外接口；这是首个支持版本，
  没有更早的已发布 contracts tag 可回退

### FEAT-129 当前候选

- 版本：`0.5.1 candidate`
- 状态：`candidate`；不是 supported/release-ready，未授权 tag、publish 或部署
- contract impact：`semantic`；保留所有 `0.5.0` 有效 bundled manifest/response，新增由
  consumers 先接收的 catalog-only manifest 与 optional blocked-reason response 投影
- 权威源：保持不变的 Skill Bundle Manifest v1、版本化 Skill Bundle Manifest v2 Catalog First
  expansion、Agent Host Skills v1 OpenAPI、
  Public capability 初始值以及固定 Runtime Skills compatibility projection
- producer：`yijie-skills` 确定性 catalog/package；已知 consumers 为
  `yijie-agent-host` 与 `yijie-desktop`
- 目录基线：38 项合成 fixture，五类严格为 `5/9/7/9/8`；1 项 bundled/installable、
  37 项 catalog-only/blocked，blocked 项无归档和入口
- 本地身份：精确 `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` 由 Desktop 自动建立
  固定身份并透明携带 owner-only bearer，用户无需登录；Host 内部 bearer 与
  `plugin.read`/`plugin.manage` 不变
- 许可边界：38 项 fixture 全部为合成数据；产品 `copywriting@0.1.0` 仍只有
  `local-development` 授权，`desktop-distribution` 许可/来源证明继续并行确认
- breaking baseline：前一候选完整 commit
  `d6dff903e0c12b6a5e69599df1e33ef46d8bea6b` 与已发布
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 发布顺序：Contracts → Skills draft → Host → Desktop；真正发出 optional blocked reason
  和 38 项 manifest 时采用 Desktop/Host consumer-first 激活
- 尚未完成：最终不可变 `0.5.1` commit/digest、三个下游精确 repin/conformance、产品 Skill
  再分发许可、38 卡片真实 UI 与 D4
- 回滚：继续消费 `0.5.0` 单 bundled 条目，不发出 catalog-only entry 或 blocked reason

详见 [`releases/contracts-v0.5.1.md`](releases/contracts-v0.5.1.md)。

### FEAT-129 前一候选

- 版本：`0.5.0 candidate`
- 状态：`candidate`；不是 supported/release-ready，未授权 tag、publish 或部署
- contract impact：`additive`
- 权威源：Skill Bundle Manifest v1、Agent Host Skills v1 OpenAPI、Public capability
  初始值以及固定 Runtime Skills compatibility projection
- producer：`yijie-skills` 确定性本地包；已知后续 consumers 为
  `yijie-agent-host` 与 `yijie-desktop`
- 本地身份：精确 `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` 由 Desktop 自动建立
  固定身份并透明携带 owner-only bearer，用户无需登录；Host 内部仍要求 bearer 与
  `plugin.read`/`plugin.manage`，public/production 不适用
- 许可边界：重写的 `yijie.content-marketing.copywriting@0.1.0` 只获准用于
  `local-development` 候选；Accio 上游候选未被打包，`desktop-release` 继续等待产品/法务证明
- breaking baseline：同时相对当时工作基线与已发布
  `f16a497e1377f45747f8ff9292b4b60cf2027f88` 验证
- 不可变 candidate commit：`d6dff903e0c12b6a5e69599df1e33ef46d8bea6b`；Host/Desktop
  已完成该 checkpoint 的精确 pin，后续由 `0.5.1` Catalog First candidate 取代
- 回滚：禁用 Desktop consumer 且不注册受管 Skill root，保持既有接口可用

详见 [`releases/contracts-v0.5.0.md`](releases/contracts-v0.5.0.md)。

### FEAT-128 当前候选

- 版本：`0.4.0 candidate`
- 计划不可移动 tag：`contracts-v0.4.0`（尚未创建；本轮未授权创建）
- 状态：`candidate`；不是 supported/release-ready
- contract impact：`semantic`；以显式协商 v3/additive expansion 保持 v1/v2 不变
- Owner/producer：段成威 / Contracts Owner；当前只授权 exact-local synthetic producer
- 已知 consumers：`yijie-agent-host`、`yijie-desktop`；二者业务实现均未授权启动
- 权威源：AgentSessionEventV3 JSON/Proto/AsyncAPI、Agent Host v3
  events/content/poster/ack OpenAPI、ReportDocumentV1 JSON Schema
- 当前 pre-FEAT-128 baseline：
  `747cf740f2d91e76e5c1a130e8e009f1efa821b8`
- 已发布 breaking baseline：
  `f16a497e1377f45747f8ff9292b4b60cf2027f88` (`contracts-v0.2.0`)
- S1/S2 最终完整 commit：提交形成后由外部 FEAT-128 交付包登记；本文件不自引用
  尚未形成的 commit
- G2：2026-08-20 APPROVED，仅允许 Contracts S1/S2
- G2A：Pending；真实 generate/lint/test/build、双基线 breaking、人工语义/安全评审和
  不可变 commit 完成后，还必须等待 Host/Desktop 精确 pin 与 conformance
- Provider gate：image/video/file/report 四类 exact-local synthetic fixture 可用；真实
  provider/tool producer 保持 blocked
- 发布边界：无 tag/push/publish/supported 晋升/生产激活授权
- 回滚：不协商 v3，继续使用既有 v1/v2 与当前 0.3 candidate 表面

详见 [`releases/contracts-v0.4.0.md`](releases/contracts-v0.4.0.md)。

### 前序 `0.3.0` 候选

- 版本：`0.3.0 candidate`
- 计划不可移动 tag：`contracts-v0.3.0`（尚未创建；延至正式发布阶段）
- 状态：`candidate`；不是 supported/release-ready
- contract impact：FEAT-125 为 `semantic`；FEAT-126 产品语义为 `breaking`，相对已发布
  `0.2.0` 仍通过新 `/v2` paths/schema 做 versioned additive expand；FEAT-127 为
  `semantic`，保留 v1 turn 与 required legacy `content`
- FEAT-127 source/generated implementation checkpoint：
  `ebdd30f076614ebc7f5149aebf70e851b81ff32b`
- 本轮文档/fixture reconciliation 的最终完整 commit：提交形成后由外部 FEAT-127 交付包或 PR
  登记；本文件不自引用尚未形成的 commit
- S1 source/generated commit：`ab5e71db6e4d61eb9c761446066142de2edbb444`
- 既有immutable FEAT-126 candidate：
  `c000a0245acb5c3f7ead5d2a877fb60c281c588c`；Draft PR #1保持不变
- Owner/producer：段成威 / `yijie-api`、`yijie-agent-host`
- 已知/登记 consumers：`yijie-agent-host`、`yijie-desktop`、`unknown-public`；
  `unknown-public` 只涉及既有 Public 表面，FEAT-127 不改变 Public OpenAPI
- 权威源：FEAT-125 为 `openapi/public/public.yaml#listMyTenants` 与
  `#getMyCapabilities`；FEAT-126 source/generated overlay 为 Public Tasks v2、Agent Host v2
  title/cleanup/events、AgentSessionEventV2 JSON Schema/Proto/AsyncAPI；FEAT-127 为
  `openapi/agent-host/agent-host.yaml#startAgentTurnV2` 与
  `jsonschema/chat/message.schema.json#ChatMessage`
- Public Tasks v2数据边界：仅closed `TaskContentReferenceV2`；prompt、message、raw reasoning、
  title派生正文、provider output和项目路径不得进入request/response/PostgreSQL。local conversation
  正文及自动标题只属于Desktop SQLCipher
- Public OpenAPI SHA-256（FEAT-127 unchanged）：
  `c8d9e6742802e0f0392ea8221a5fdd028f76107df893ab4c531da75f9e9e354b`
- FEAT-127 Agent Host OpenAPI SHA-256：
  `3d2f2273160aa05112f63d67f170229780d4526d679cd449a267890a933ea177`
- FEAT-127 Chat message JSON Schema SHA-256：
  `3f277898f8204e02a400053cd56bec3b0eeb37ed2c50db3a6347e7fec61ddf34`
- FEAT-127 fixture/generated SHA-256：turn fixture
  `ec464ce56f749852e65be8d1472d8f5d8cccc82c89d2dd16fab33fbdbe62decc`；TypeScript Agent Host
  `c6fe5a8a283d5209529fe397e1957c289ccfd93d33999e07f64e55a1faf7d49e`；Go Agent Host
  `e77b7858fb922588db4cb936fe1fd8a282f58d89c067fcd862668433c3a1b425`；TypeScript Chat
  `4d620424afab17cbd41a19cb58adfd975c5b7e0d025f9faff821e97fa2fb69fd`
- Generators：`openapi-typescript 7.13.0`、`oapi-codegen v2.7.2`、
  `json-schema-to-typescript 15.0.4`
- Host pre-reconciliation checkpoint：
  `yijie-agent-host@673de86d3d076f4600eb0d0bfb215382677afd72` 已固定 `0.3.0`、完整
  Contracts commit、Agent Host OpenAPI digest 与 generator，`contract-check` PASS
- Desktop pre-reconciliation checkpoint：
  `yijie-desktop@3efed9aba5faab90ca3ea397a4d6489890df2026` 已固定完整 Contracts commit并完成
  conformance；candidate closure 另要求 Host-wire source/fixture digest lock、显式 Rust adapter
  例外与同源 conformance。最终 consumer commits/pins 由外部 FEAT-127 交付包登记
- Breaking baseline：2026-08-19 相对
  `f16a497e1377f45747f8ff9292b4b60cf2027f88` PASS；自动结果不替代 semantic/security
  review
- FEAT-126历史source-shape evidence（2026-08-02）：DEC-126-018/019/020与`c000a024`证据保留，
  DEC-126-023已批准方案C并关闭Q-017；DEC-126-024最终G2A仍须独立批准，FEAT-127 的
  consumer pin 不替代该结论
- FEAT-127 semantic review：段成威于 2026-08-19 批准本地 candidate 的 Contracts/Host/Desktop
  Owner/consumer 语义兼容结论；不批准 tag、publish、supported 晋升或生产激活
- tag/release 顺序：当前完整 commit 只允许本地/非生产验证；最终 release commit 与 digest
  冻结后才创建 `contracts-v0.3.0`。下游验证 tag 解析和 digest、
  按评审结论 repin/切换 provenance 后，才可把本候选晋升为 supported
- 尚未完成：FEAT-126 DEC-126-024、FEAT-127 最终 reconciliation/consumer identities 外部登记、
  不可移动 tag、release provenance 切换、package publish、生产发布和 supported baseline 晋升
- 回滚：不启用 provider/consumer，继续使用 `contracts-v0.2.0`

### `0.2.0` 首版登记的 fallback breaking 证据

`contracts-v0.2.0` 发布评审已相对
`c51c6d424a6706724ce6dfbbb7511e644694adb4` 执行并记录 breaking check。该 commit
是本政策建立时的 `origin/main`，只是为防止“零基线”检查真空而登记的 fallback，
不是已发布版本、生产支持声明或下游消费引用。结果为 OpenAPI、AsyncAPI 和 JSON
Schema 均无结构性 breaking change，并由 Agent Runtime/Contracts Owner 完成人工语义
复核：本次只更新精确 Runtime repository provenance，不改变 Runtime 方法、通知、
transport、schema、权限或失败语义。

从下一次契约变更开始，breaking check 必须至少包含
`contracts-v0.2.0^{commit}` 对应的完整 commit
`f16a497e1377f45747f8ff9292b4b60cf2027f88`；不得继续使用首版 fallback 代替已发布
支持基线。

## 发布后维护规则

tag 创建且下游验证其解析到已测试的同一 commit、digest 未变后，在后续 registry
变更中把候选移入“已发布支持基线”，并记录：

- version、不可移动 tag 和完整 commit；
- 支持状态：`supported | deprecating | unsupported`；
- 生产环境/consumer 范围；
- 兼容窗口结束条件与日期；
- migration、回滚和 release note。

breaking/semantic 评审必须覆盖表中所有 `supported` 和 `deprecating` 基线，以及任何
仍在生产兼容窗口的已登记历史/紧急例外 commit。只有观测证明无有效 consumer，且弃用
流程完成后，才能把基线改为 `unsupported` 并停止检查。未打 tag 的生产 commit 只允许
作为已登记的历史遗留或获批紧急例外，不能成为新发布的常规路径。
