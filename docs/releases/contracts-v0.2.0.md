# contracts-v0.2.0 发布候选说明

`contracts-v0.2.0` 是首个覆盖 Agent Host Runtime Baseline 2 的候选可消费版本。
在同名 tag 创建且通过 tag provenance 复核前，本文件不构成已发布声明。

## 范围

- 独立的 Agent Host 本机 HTTP/SSE OpenAPI；
- Agent Host Protobuf service 与有序 `AgentSessionEvent`；
- 固定 Codex Runtime `0.144.6` 的最小兼容投影；
- Go/TypeScript OpenAPI、Protobuf、JSON Schema 及 bundled AsyncAPI 生成物；
- 跨格式一致性、生成同步和兼容性门禁。

## 兼容性

既有 JSON Schema `$id` 保持向后兼容。已有属性不新增必填要求，不收紧旧字段的格式、枚举、长度或 `additionalProperties`。Agent Host 契约和 Runtime 兼容清单是新增接口。

## 发布顺序

1. 先提交 `yijie-codex` 的双向兼容门禁，记录最终完整 commit；该步骤不修改 Runtime 上游源码、Schema tree 或 binary；
2. 将 `compatibility/agent-host-runtime-v1.json` 的 `runtime.repository_commit` 更新为该 commit，重新生成，并相对登记的 fallback 完整 commit 完成 lint、测试、breaking check 和人工语义审查；
3. 合并本版本所有源契约、生成物、测试、发布说明及治理变更，形成干净、远端可获取的最终 candidate 完整 commit；
4. `yijie-agent-host` 从该精确 candidate commit 做非生产同步，锁定版本、contracts 完整 commit、各源 digest 和 generator 身份，重新生成本地类型并通过 Host/Codex Runtime conformance 与集成门禁；
5. 只有第 4 步针对最终 candidate 通过后，才创建 `contracts-v0.2.0`，且 tag 必须指向同一个已测试 commit；
6. Host 验证 `contracts-v0.2.0^{commit}` 等于已锁定的 candidate commit、digest 未变，再把 provenance 从 candidate commit 切换为 tag 并复跑检查；
7. 在后续 registry 变更中把 tag + 完整 commit 登记为 supported baseline；此后 Desktop 才能固定该已发布引用并消费 TypeScript SDK；
8. cloud runner、平台身份、工具和审批协议使用后续版本，不混入本版本。

`runtime.repository_commit` 是故意设置的双向精确绑定。前两步已经完成：

- `yijie-codex` 当前兼容门禁与治理提交并推送为
  `3aa317cebbbc9c743f6b1a18522be11a7ebb5d6f`；
- 当前兼容清单已固定该完整 commit，并通过候选阶段的生成、lint、测试和 breaking check；
- 首版无已发布基线期间登记的 fallback breaking 基线为
  `c51c6d424a6706724ce6dfbbb7511e644694adb4`。

最终 candidate 完整 commit 只有在第 3 步合并后才能产生，不能在其自身内容中自引用。
第 2 步已有结果不能替代针对最终 candidate 的第 4—6 步跨仓复核。

在创建 `contracts-v0.2.0` tag 前若 Codex Runtime 身份、canonical schema 或兼容门禁再次
变化，必须重新固定新完整 commit 并执行双向验证，不能把旧 SHA 带入发布 tag。

## 回滚

Host 保留已提交的契约 snapshot 和生成代码。若候选版本回滚，Host 回退到上一已验证 snapshot；不得只回退生成物而保留不匹配的源契约。由于这是首个 Agent Host 可消费版本，回滚意味着禁用 Baseline 2 对外接口，而不是回退到未定义协议。

## 尚需人工动作

- 合并当前候选的全部治理与发布文件，记录最终远端 candidate 完整 commit；
- 相对登记的 fallback commit 重跑候选 generate、lint、test、breaking check 并保存证据；
- 让 Agent Host 从该精确 candidate commit 重新同步、补齐 contracts commit/generator
  lock，并完成 Host/Codex Runtime conformance 与集成检查；
- 仅在上述检查通过后，在同一 candidate commit 创建 Git tag；
- 验证 tag provenance 与 digest 后，将 Host provenance 切换为 tag 并复跑检查；
- 在后续 registry 变更中把 tag + 完整 commit 晋升为 supported baseline；
- 在确定 TypeScript registry 和访问策略后增加发布凭据及发布 job；
- Desktop 正式接入时记录其固定的 contracts 版本。
