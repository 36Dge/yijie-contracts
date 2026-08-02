# Supported Contract Baselines

## 当前状态（2026-08-01）

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

### 当前候选

- 版本：`0.3.0 candidate`
- 计划不可移动 tag：`contracts-v0.3.0`（尚未创建）
- 状态：`candidate`；不是 supported/release-ready
- contract impact：FEAT-125 为 `semantic`；FEAT-126 产品语义为 `breaking`。相对已发布0.2.0仍
  通过新 `/v2` paths/schema 做versioned additive expand；相对既有未发布`c000a024`候选则收窄
  request/response，是明确的replacement candidate，尚未执行legacy retirement
- S1 source/generated commit：`ab5e71db6e4d61eb9c761446066142de2edbb444`
- 既有immutable FEAT-126 candidate：
  `c000a0245acb5c3f7ead5d2a877fb60c281c588c`；Draft PR #1保持不变
- DEC-126-023 replacement candidate完整commit：形成后在外部FEAT-126需求包登记并提交
  DEC-126-024；本文件不能自引用尚未形成的包含自身commit
- Owner/producer：段成威 / `yijie-api`、`yijie-agent-host`
- 已知/登记 consumers：`yijie-desktop`、`unknown-public`；FEAT-125 Runtime Baseline 2 的
  `yijie-agent-host` 继续固定 `contracts-v0.2.0`，FEAT-126 的未来 Host v2 producer 另行 pin
- 权威源：FEAT-125 为 `openapi/public/public.yaml#listMyTenants` 与
  `#getMyCapabilities`；FEAT-126 source/generated overlay 为 Public Tasks v2、Agent Host v2
  title/cleanup/events、AgentSessionEventV2 JSON Schema/Proto/AsyncAPI
- Public Tasks v2数据边界：仅closed `TaskContentReferenceV2`；prompt、message、raw reasoning、
  title派生正文、provider output和项目路径不得进入request/response/PostgreSQL。local conversation
  正文及自动标题只属于Desktop SQLCipher
- Public source SHA-256：
  `c8d9e6742802e0f0392ea8221a5fdd028f76107df893ab4c531da75f9e9e354b`
- Generator：`openapi-typescript 7.13.0`、`oapi-codegen 2.7.2`
- Breaking baseline：2026-08-01 相对
  `f16a497e1377f45747f8ff9292b4b60cf2027f88` PASS；自动结果不替代 semantic/security
  review
- FEAT-126历史source-shape evidence（2026-08-02）：DEC-126-018/019/020与`c000a024`证据保留，
  但DEC-126-023已批准方案C并关闭Q-017；新的content-free replacement以`c000a024`为parent，
  当前等待本地完整commit、post-commit复验和DEC-126-024最终G2A批准
- 尚未完成：replacement完整commit的post-commit复验/外部登记、DEC-126-024最终G2A批准、
  API/Host/Desktop exact pin与conformance、两租户E2E、不可移动tag、生产发布和supported
  baseline晋升
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
