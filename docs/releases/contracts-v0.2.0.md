# contracts-v0.2.0 发布说明

`contracts-v0.2.0` 是首个覆盖 Agent Host Runtime Baseline 2 的候选可消费版本。

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
2. 将 `compatibility/agent-host-runtime-v1.json` 的 `runtime.repository_commit` 更新为该 commit，重新生成并完成 lint、测试和 breaking check；
3. 合并 `yijie-contracts` 并创建 `contracts-v0.2.0` tag；
4. `yijie-agent-host` 从该 tag 同步 OpenAPI、事件 JSON Schema、Runtime 兼容清单、版本和 SHA-256，并重新生成本地类型；
5. Codex Runtime 与 Host 的普通/集成门禁全部通过后，再由 Desktop 消费 TypeScript SDK；
6. cloud runner、平台身份、工具和审批协议使用后续版本，不混入本版本。

`runtime.repository_commit` 是故意设置的双向精确绑定。当前未提交工作区仍以现有 `yijie-codex` `HEAD` 验证；一旦 Codex 仓产生新提交，第二步必须执行，不能把旧 SHA 带入发布 tag。

## 回滚

Host 保留已提交的契约 snapshot 和生成代码。若候选版本回滚，Host 回退到上一已验证 snapshot；不得只回退生成物而保留不匹配的源契约。由于这是首个 Agent Host 可消费版本，回滚意味着禁用 Baseline 2 对外接口，而不是回退到未定义协议。

## 尚需人工动作

- 创建 Git tag；
- 在 `yijie-codex` 变更提交后回填最终 `runtime.repository_commit`；
- 在确定 TypeScript registry 和访问策略后增加发布凭据及发布 job；
- Desktop 正式接入时记录其固定的 contracts 版本。
