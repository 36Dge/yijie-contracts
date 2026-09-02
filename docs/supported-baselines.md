# Supported Contract Baselines

## 当前状态（2026-09-02）

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

### FEAT-137 v6 source-first 当前候选

- 版本：继续使用未发布 `0.7.0 candidate`；不创建新 tag、不发布，且所有下游必须固定完整
  commit/digest，不能只按版本号消费
- 状态：Contracts deterministic-producer authority candidate；已有 Host/Desktop reviewed candidate 必须在
  本次新 Contracts immutable SHA 上重新 pin、冻结和完成 cross-repository conformance；fresh D4
  已由 Owner 单独授权但尚未执行，且不得早于下游冻结
- contract impact：`semantic`；v5 是 closed union，因此新增显式协商 v6，v1-v5 保持不变
- 权威源：AgentSessionEventV6 JSON Schema、Protobuf v6、AsyncAPI v6 channel/message/operation、
  Agent Host `/v6/.../events`、owner-only pending snapshot 与 one-shot decision OpenAPI
- producer/consumer：`yijie-agent-host` → `yijie-desktop`；Host 是唯一 Runtime mapper、pending
  和 decision authority
- Runtime：approval compatibility 的旧占位 pin 为
  `yijie-codex@9ed24710d73f22a9b269092b8cdf2225199ea222` /
  tree `984e0f5bb48aaa953ed3a329614d00e5905514fb` / `0.144.6` / 267
  schemas / `experimentalApi=false`；该 SHA/tree/artifact 已不代表最终 repair authority，必须由
  clean Runtime freeze 后的完整 identity 替换。`agent-host-runtime-v1.json` 保持逐字节不变并继续
  描述当前 `read-only/never` 默认投影；独立
  `agent-host-runtime-approval-v6-v4.json` 当前为 `candidate/PENDING`，描述 exact-gated
  `on-request` deterministic producer、mapper 和 stable `sandboxPermissions=use_default`
  admission；原 approval-v6、v2 与 v3 manifest/schema 保持逐字节不变
- 新语义：固定 `git_repository_check`、Host opaque approval identity、primary `accept_once` /
  secondary `cancel_current_turn`、120 秒 TTL、Host memory pending snapshot、revision 1→2、
  generation-bound decision、Runtime replay reuse 与 closed requested/resolved outcomes/errors
- Runtime 映射：accept once 只发送 stable `accept`；cancel current turn 与 TTL 只发送 stable
  `cancel`；Runtime/Item/Turn cleanup 先胜时 `resolved_elsewhere` 且不再响应；HTTP 200 等待相同
  generation/RequestId/thread 的 stable `serverRequest/resolved`
- producer/admission：默认关闭的 Host Owner gate 只在 exact local/demo_fast + FEAT-134/136/137
  后向 Runtime child 注入私有 gate；首步唯一 strict/closed 零参数 `exec_command`、
  required/non-parallel，Runtime 忽略 Provider arguments 并构造固定
  `UseDefault` 只读动作，首 call 后 no-tools/no-sampling。Runtime 每个 response stream 只接纳一个
  canonical plain/nonempty-call-id Done，并以 turn-global CAS 保证整个 TurnContext 仅有一个
  Provider request；post-tool/second-stream completion 在 follow-up 前 fail closed。Host 随后校验
  exact wrapper 与唯一 allowlisted Unknown `commandAction`，三层共同构成 closed admission authority
- managed surface：Host exact MiniMax config 固定
  `hooks/plugins/apps/tool_suggest/shell_snapshot=false`，Runtime 在 contributor/discovery 前关闭
  hook/plugin/MCP/Connector/snapshot 表面；configured/runtime/effective MCP 与 Connector 投影均为
  0。Runtime private gate 自身强制 `DisabledEphemeral`；Host ambient strip 后只向 exact D4 Runtime
  child 注入 `CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED=1`，Runtime 读取后移除且 Command
  child scrub
- Provider privacy/retry：gate-on SSE/WebSocket wire logging 与 lifecycle telemetry content-free，
  transport payload telemetry 和 raw tool-input delta 被抑制；`request_max_retries=0`、
  `stream_max_retries=0`，automatic 401 recovery 禁用且额外 request 为 0，spawn 前精确重验。
  这与 decision POST 不自动重试是不同边界
- Provider call：私有 gate 在 prewarm/authentication/TurnContext producer side effect 前生效，
  三类 side effect 均为 0；整个 gate-on TurnContext（含 steer/follow-up）Provider request 精确且
  hard max 为 1，follow-up 为 0，automatic compaction 与 post-tool final sampling 均禁用且各产生
  0 次额外 request
- gate-off parity：managed config bytes、Provider tools/choice/parallel/arguments/output、process
  env/argv/shell、remote-control（不注入）、extension contributors、SSE/WebSocket logs/telemetry、
  startup producer、Provider cardinality、automatic compaction、post-tool final sampling、401
  recovery、public v6/stable schema 以及 permissions/approval decisions 均逐维保持普通历史路径
- real wire：`environmentId` 必须为精确 `local`；`reason` 只允许 absent/null 或不含 NUL、
  最多 512 UTF-8 bytes，并在 Host 校验后立即丢弃，不进入 fingerprint/log/storage/projection
- sandbox provenance：stable wire 必须带 `sandboxPermissions`；只接收 `use_default`，拒绝
  `require_escalated`、`with_additional_permissions`、未知或缺失值，并把该值纳入 replay fingerprint
- 数据边界：禁止 Runtime RequestId/approvalId、command/cwd/reason/actions、permission/amendment、
  `availableDecisions`、secret、path 和 raw wire；Desktop 仅按 fixed action ID 本地化
- compatibility baseline：前一 Contracts candidate
  `87f94c9aa6d4848cb67aa8a1265bd21474edb0bb` 与 published supported
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 发布顺序：Contracts immutable candidate → Host exact pin/mapper/pending authority → Desktop
  exact pin/closed consumer → conformance → Owner separately-authorized D4；consumer ready 前不得发出 v6
- 回滚：关闭 FEAT-137 并协商 v5，保持现有 `read-only/never`；不修改 Runtime
- exclusions：FileChange/Diff、一般权限/MCP/requestUserInput、decline/session approval、
  network/write/sandbox expansion、进一步 Runtime patch 与 production approval

详见 [`agent-session-events-v6.md`](agent-session-events-v6.md)。

### FEAT-136 当前候选

- 版本：`0.7.0 candidate`
- 状态：`candidate`；不是 supported/release-ready，未授权 tag、push、publish、部署或
  public/production 激活
- contract impact：`semantic`；v4 是 closed output/event union，因此新增显式协商的 v5，
  v1-v4 权威源、packages 与 routes 保持有效
- 权威源：AgentSessionEventV5 JSON Schema、Protobuf v5、AsyncAPI v5 channel/message、Agent
  Host `/v5/.../events` OpenAPI 和 Runtime stable compatibility projection
- Proto 边界：JSON Schema 是 semantic validity authority；Proto3 仅是 typed transport，adapter
  必须拒绝 unset oneof/message、unknown/unspecified enum、错误 lifecycle/status/result/error 组合、
  progress index 与 scalar/UTF-8/aggregate/SSE 超限，不能把可解码 message 当成有效状态
- producer：`yijie-agent-host`；known consumer：`yijie-desktop`；外部 Runtime 固定为
  `yijie-codex@b2b20e2fc4a0c94834f34d8cc459e488a1b56277`
- 新语义：`item.started`/`item.completed` 含 closed Command/Tool typed snapshots，新增
  `item.command_output.delta` 与 `item.tool.progress`；按 `event_id` 去重，相同文本不同事件
  合法，completed 是 Item 的权威封口快照，缺失 Command aggregate 映射为显式 unavailable，
  Runtime Tool `is_error=true` 可保留 bounded result summary 并同时归一化 stable error；只有
  `turn.completed` 是 Turn terminal
- caps：SSE 1 MiB；Command summary/cwd/delta/aggregate 分别 4 KiB/1 KiB/16 KiB/256 KiB，
  overflow 保留 UTF-8 head/tail 各 128 KiB；Tool identity/args/progress/result 分别
  256 B each/8 KiB/4 KiB each（32 条、64 KiB total）/64 KiB；error 4 KiB；SSE cap 按 compact
  JSON `data` value 计数，cwd aggregate 包含 `/` 分隔符
- 数据边界：契约要求先脱敏后按 UTF-8 截断；只允许安全 summary、结构化 relative/redacted cwd、
  stable status/error/truncation；禁止 raw command/cwd、Tool args/result/meta/context、token、
  secret、absolute path 和 raw Runtime wire；schema 只能证明 closed fields/path shapes，实际
  Host reviewed draft 已覆盖 secret/path/content sanitizer；针对本次新 provenance 的 exact
  repin 与 fresh cross-repository conformance 尚未执行
- Runtime 边界：`0.144.6`、upstream `rust-v0.144.6`、267 stable schemas、tree SHA-256
  `82ee9de771cf1d41bac16d87380f1121e7794107aa3aa526ad702d5d1bf7afe1`、
  `experimentalApi=false`；严格应用 FEAT-126 `0001` → FEAT-136 `0002`，后者只补 early
  sandbox-denial 的 canonical same-identity started/failed completed；隔离 build、Schema 零差异、
  normal-EOF smoke 和 Runtime→Contracts 双向检查通过，不改变 read-only/never
- Tool gap：generic Tool contract 不注册 MCP/Connector、不产生真实 Tool；Runtime MCP status
  没有 declined，v5 的 Tool declined 仅 Yijie 预留/synthetic-only；CAP-017 Owner/product 与
  real-producer decision 继续 pending，但不阻塞 Command contract；unknown identity 固定为
  `unknown` sentinels，不保留源标签
- exclusions：generic Item 为 closed stable allowlist；无 FileChange、Diff、patch、approval/write
  gate 或任意 unknown/experimental generic kind；Artifact authority 保持独立
- breaking baseline：FEAT-134 candidate
  `3832a6c5e99b2a6365f193280fdb887c8fdbc2de` 与 published supported
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 发布顺序：Runtime immutable candidate → Contracts repin → Host exact artifact/pin 与 mapper
  conformance → Desktop exact pin/closed consumer conformance → fresh Command D4；consumer ready 前
  不得发出 v5
- 回滚：成对恢复 Runtime `0ce5902ed400866be0196886bb78f693a004d68d` 与其匹配 Contracts
  provenance，关闭 FEAT-136 并继续协商 v4
- 尚未完成：新的 Contracts immutable commit、Host/Desktop exact repin 与 fresh cross-repo
  conformance、真实 Command D4、真实 Tool、不可移动 tag、publish、supported 晋升和
  production activation

详见 [`releases/contracts-v0.7.0.md`](releases/contracts-v0.7.0.md)。

### FEAT-134 当前候选

- 版本：`0.6.0 candidate`
- 状态：`candidate`；不是 supported/release-ready，未授权 tag、push、publish、部署或
  public/production 激活
- contract impact：`semantic`；v1–v3 权威源保持有效，新增显式协商的 v4 输出 union
- 权威源：AgentSessionEventV4 JSON Schema、Protobuf v4、AsyncAPI v4 channel/message、
  Agent Host `/v4/.../events` OpenAPI 和 Runtime stable compatibility projection
- producer：`yijie-agent-host`；consumer：`yijie-desktop`；外部 Runtime 权威固定为
  `yijie-codex@0ce5902ed400866be0196886bb78f693a004d68d`
- 新语义：AgentMessage started/completed 要求 `text` 和
  `phase=commentary|final_answer|null`；delta 仍只有文本；`turn.plan.updated` 是按序完整替换
  快照，空数组清空计划，omitted/null explanation 清空解释
- Runtime 边界：`0.144.6`、upstream `rust-v0.144.6`、`experimentalApi=false`；只登记现有
  stable `item/reasoning/textDelta` 与 `turn/plan/updated` 投影，不修改、升级或重编译 Runtime
- 激活边界：仅 exact `YIJIE_ENV=local` + `YIJIE_LOCAL_PROFILE=demo_fast` + FEAT-134 gate；
  managed provider 固定 high/raw 由 Host 私有策略负责，协议与 UI 均不新增推理强度字段
- 数据边界：不得把 prompt、reasoning、plan 或 final 正文写入 Host durable storage、日志、
  metrics、trace、audit 或错误体；Desktop 既有本地正文 authority 不由本契约改变
- breaking baseline：前一候选完整 commit
  `164b14f609537d727a52326832da04430aecc4ab` 与已发布
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`
- 发布顺序：Contracts 不可变 commit → Host gated producer/Runtime mapper → Desktop consumer
  与 native gate；仅在 consumer ready 后启用 exact-local gate
- 尚未完成：最终不可变 Contracts commit/digest、Host/Desktop 精确 pin 与 conformance、
  canonical content-free smoke、FEAT-134 D4
- 回滚：关闭 FEAT-134 exact-local gate并继续协商 v3；v1–v3 与 public/production 保持不变

详见 [`releases/contracts-v0.6.0.md`](releases/contracts-v0.6.0.md)。

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
