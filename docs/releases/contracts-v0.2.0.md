# contracts-v0.2.0 发布说明

`contracts-v0.2.0` 是首个覆盖 Agent Host Runtime Baseline 2 的 supported 契约版本。
不可移动 tag 指向
`f16a497e1377f45747f8ff9292b4b60cf2027f88`，Agent Host 已验证并固定相同 commit。

## 范围

- 独立的 Agent Host 本机 HTTP/SSE OpenAPI；
- Agent Host Protobuf service 与有序 `AgentSessionEvent`；
- 固定 Codex Runtime `0.144.6` 的最小兼容投影；
- Go/TypeScript OpenAPI、Protobuf、JSON Schema 及 bundled AsyncAPI 生成物；
- 跨格式一致性、生成同步和兼容性门禁。

## 兼容性

既有 JSON Schema `$id` 保持向后兼容。已有属性不新增必填要求，不收紧旧字段的格式、枚举、长度或 `additionalProperties`。Agent Host 契约和 Runtime 兼容清单是新增接口。

## 发布顺序与本地完成证据

1. 先提交 `yijie-codex` 的双向兼容门禁，记录最终完整 commit；该步骤不修改 Runtime 上游源码、Schema tree 或 binary；
2. 将 `compatibility/agent-host-runtime-v1.json` 的 `runtime.repository_commit` 更新为该 commit，重新生成，并相对登记的 fallback 完整 commit 完成 lint、测试、breaking check 和人工语义审查；
3. 合并本版本所有源契约、生成物、测试、发布说明及治理变更，形成干净、远端可获取的最终 candidate 完整 commit；
4. `yijie-agent-host` 从该精确 candidate commit 做非生产同步，锁定版本、contracts 完整 commit、各源 digest 和 generator 身份，重新生成本地类型并通过 Host/Codex Runtime conformance 与集成门禁；
5. 只有第 4 步针对最终 candidate 通过后，才创建 `contracts-v0.2.0`，且 tag 必须指向同一个已测试 commit；
6. Host 验证 `contracts-v0.2.0^{commit}` 等于已锁定的 candidate commit、digest 未变，再把 provenance 从 candidate commit 切换为 tag 并复跑检查；
7. 在后续 registry 变更中把 tag + 完整 commit 登记为 supported baseline；此后 Desktop 才能固定该已发布引用并消费 TypeScript SDK；
8. cloud runner、平台身份、工具和审批协议使用后续版本，不混入本版本。

`runtime.repository_commit` 是故意设置的双向精确绑定。最终发布证据：

- `yijie-codex` 当前兼容门禁与治理提交并推送为
  `3aa317cebbbc9c743f6b1a18522be11a7ebb5d6f`；
- contracts tag 与完整 commit：
  `contracts-v0.2.0` /
  `f16a497e1377f45747f8ff9292b4b60cf2027f88`；
- Agent Host consumer commit：
  `34e94acf293f6daad61c4d42fa47028a2d1318e4`；
- Agent Host generator：
  `github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.7.2`；
- 当前兼容清单已固定 Runtime 完整 commit，并通过生成、lint、测试、fallback breaking
  check、Codex 双向投影和 Host 真实固定 Runtime 无模型集成；
- 首版无已发布基线期间登记的 fallback breaking 基线为
  `c51c6d424a6706724ce6dfbbb7511e644694adb4`。

后续若 Codex Runtime 身份、canonical schema 或兼容门禁变化，必须进入新的 contracts
版本，固定新的完整 commit 并重新执行双向验证；不得移动或覆盖
`contracts-v0.2.0`。

## 回滚

Host 保留已提交的契约 snapshot 和生成代码。若本版本回滚，Host 回退到上一已验证
snapshot；不得只回退生成物而保留不匹配的源契约。由于这是首个 Agent Host 可消费
版本，回滚意味着禁用 Baseline 2 对外接口，而不是回退到未定义协议。

## 后续动作

- 将本地 contracts candidate commit、Agent Host consumer commit、registry commit 和
  `contracts-v0.2.0` tag 一并推送远端后，复核远端 tag provenance；
- 在确定 TypeScript registry 和访问策略后增加发布凭据及发布 job；
- Desktop 正式接入时记录其固定的 contracts 版本。
