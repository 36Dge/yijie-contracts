# contracts-v0.3.0 候选说明

## 状态

- 状态：`candidate`；不是 supported release，尚未创建 tag。
- contract impact：`semantic`。
- 计划不可移动 tag：`contracts-v0.3.0`。
- Owner、需求、技术、安全、consumer Reviewer：段成威。
- 关联需求：`FEAT-125-authoritative-permission-projection`。
- G2：Passed；G2A：Pending，必须由段成威在候选证据形成后单独批准。

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
SDK。生成文件不得手工修改；最终 generator 版本、source/generated/package digest 和
候选完整 commit 在 S2 证据形成后登记。

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

## 合并、发布与回滚

1. 契约候选先形成远端可获取的完整 commit；不创建 tag。
2. 段成威基于完整 SHA、digest、generator、breaking 和 semantic review 单独批准 G2A。
3. yijie-api 与 yijie-desktop 固定同一候选完整 SHA/digest，完成非生产 conformance。
4. 只有最终 candidate 的 producer/consumer、安全和两租户集成全部通过后，才创建指向
   同一 commit 的 `contracts-v0.3.0`。
5. tag provenance 与 digest 复核后，API provider first，Desktop consumer 后灰度。

回滚方式是保持下游 feature flag 关闭并继续使用 `contracts-v0.2.0`。未完成 FEAT-126
前，生产 `/v1/tasks*` 必须继续由 ingress deny 与 service handler non-registration
双隔离；本候选不修改 Tasks wire，也不提供其资源级授权。
