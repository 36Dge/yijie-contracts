# FEAT-157 私有控制契约验证

2026-10-07，本地候选；没有提交、推送、tag、发布或真实服务资格。最终源采用 required-nullable 新 thread 意图以及实际 thread/turn 一次绑定，详情见 [契约说明](market-broker-control-v1.md)。

## 已通过

| 命令/检查 | 实际结果 |
|---|---|
| `node scripts/generate-market-broker.mjs` / `--check` | 55 个源定义、8 个 owner-only 动作；独立 source/lock/生成物同步 |
| `make market-broker-test` | 7 JS、5 Go、6 Rust 专项通过；另外复用原 Go selection 2 项；Rust Clippy `--all-targets -- -D warnings` 通过 |
| `make lint` | 全 OpenAPI/JSON Schema/Protobuf/TS/Go vet 通过；保留既有 12 条 unused-component 警告 |
| `go test ./...` | 恢复完整旧生成树后全仓 Go 测试通过 |
| `sync-market-broker.mjs --consumer=connectors --check` | Rust portable Snapshot、控制类型、原 SelectionRef 和 candidate/source hash 一致 |
| `sync-market-broker.mjs --consumer=agent-host --check` | Go 原生成权威 alias、导入路径机械投影和 consumer hash 一致 |
| `git diff --check` | 通过 |
| 旧源/生成差异检查 | `scripts/generate.mjs`、原 `jsonschema/`、tracked `sdks/go/openapi/`、`sdks/typescript/src/openapi/` 与 `src/jsonschema/` 以及下述两个旧测试均无 diff |

跨语言 conformance 使用正常合成 JSON、独立 scope/operation、同源 selection 摘要向量。新增的线程检查区分明确 null 与字段遗漏；已经绑定的 thread/turn 必须成对，已有真实 thread 不可被替换。校验程序没有执行网络模型或业务工具。

## 兼容基线

以下均执行 `./scripts/check-breaking.sh <完整 SHA>`：

| 完整 baseline | 结果 |
|---|---|
| `f16a497e1377f45747f8ff9292b4b60cf2027f88` | PASS：OpenAPI/Protobuf/AsyncAPI/JSON Schema 无结构性 breaking |
| `6f632f155eacdaf93df0e0b00b5dab9e369c5442` | PASS |
| `811f38d6b104fa18477107e7ac91a85e19c445d1` | PASS |
| fallback `1a213ac8383e95ac6ec69363937687904fa3591c` | BLOCKED：旧 `scheduled-plan-draft` baseline 解析 `https://schemas.yijie.ai/scheduled-tasks/draft-execution/v1` 时 EOF，exit 102 |

新私有 family 在上述 baseline 中都不存在。通用 breaking 工具不代替新增私有生命周期、授权和幂等语义审查；没有把新源当作旧 Runtime 协议修改。

## 全量正常测试的现存限制

对 `tests/*.test.mjs` 排除下文两份禁止项后，32 个测试文件的最终执行结果为：**164 项，160 PASS、2 FAIL、2 已有 SKIP**。日志为本地 `/tmp/yijie-feat157-broker-normal-contract-tests-run-03.log`。

两项失败均位于未修改的旧源/测试：

1. `runtime-approval-compatibility-v6.test.mjs:464` 对旧资格 candidate HEAD 的断言期待 `9ed24710d73f22a9b269092b8cdf2225199ea222`，当前实际 Codex HEAD 是已固定的 `7fd463bcef07f37b0211acd9f62b9f93ea0a4b12`。没有修改 Runtime、移动 HEAD 或替换旧断言。
2. `scheduled-schema-closure.test.mjs:43` 的 `draft/root/unknown-field-0` 在旧生成 projection 中为 true，测试期待 false。相关旧 schema、projection 和测试均无本次 diff；没有扩大 FEAT-157 范围修改另一 family 或关闭校验。

`pnpm generate:safe` 也已实际尝试，退出 1：旧 JSON Schema 引用 `https://schemas.yijie.ai/scheduled-tasks/plan-draft/v1` 下载失败。旧 generator 先清理后生成，失败曾留下 18 份原本干净的 tracked SDK 文件被删除；已只把该次尝试影响的原文件恢复到原 HEAD 字节，移除该次新增的孤立 `chat-model-selection-v1.gen.ts`。没有覆盖用户改动或新 family 文件。首次全套正常测试因此出现缺文件失败，日志保留为 run-01；恢复后 run-02、最终 run-03 都只剩上述两项旧失败。恢复后的全 Go 测试与 lint 另已重新通过。

因为 canonical safe generation 没有完成，`check-generated:safe` 的全链通过条件也未满足，本轮不宣称完整 generate/check/test 通过。独立新族及原 market-connectors/market-selection 的生成 `--check` 均通过。

## 安全条款要求的未执行项

- 未运行默认 `make generate` 的 skill archive fixture 生成；它会生成危险归档样本。改用仓库已提供的 `pnpm generate:safe`，其独立网络失败如上记录。
- 未运行 `tests/skill-bundle-v1.test.mjs`，该文件会重建上述归档 fixture。
- 未运行 `tests/structured-artifacts-v3.test.mjs`，其用例含 injection fixture。
- 未把默认全量 `make test` 标记为通过，因为它包含这些步骤；替代执行其余正常测试和完整 Go 测试。

这些限制来自用户长期硬性安全条款。影响是相关旧归档/注入验收本轮没有证据，不能由新私有控制测试代替或伪造通过。没有强杀、权限破坏、危险资源注入、程序替换、真实账户、Keyring、外部 MCP 或付费模型调用。worker/Host 的普通合成 Gateway 状态机与 Runtime 资格由各自记录提供，不能从本文件推导 51 项真实服务已接通。

## 独立实现审查后的容量终止补充

只读审查发现原通用 receipt 上限会同时拒绝 Revoke/Shutdown，Host 单纯返回容量错误时不能保证停止原准入。已先在 control.json 的 capacity/shutdown 语义写明：Host 在串行 gate 内收到这两个动作的 typed `capacity_exceeded` 时，必须正常关闭 stdin、永久退役 generation，返回原 typed 错误，再用 Close 确认真实退出或保留 STOP_PENDING；不增加 receipt、不强杀、不自动重发，也不宣称外部业务完成。

这次仅改变未发布候选的生命周期语义，wire 字段及 Go/Rust 类型字节不变。source candidate 更新并同步两端；7 项 focused JS、原三族 source check 和 diff check 通过。没有重复执行 Runtime、历史全量生成或多基线检查。Host 的真实 canonical worker 容量边界验证由 Host owner 的独立记录提供。
