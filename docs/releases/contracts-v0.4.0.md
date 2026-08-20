# contracts-v0.4.0 候选说明

## 状态

- 状态：FEAT-128 local-only candidate；不是 supported/release-ready，未创建 tag。
- contract impact：`semantic`；所有新增表面均为显式协商的 v3/additive expansion，v1/v2
  权威源保持不变。
- G2：2026-08-20 已由 Owner 直接指令批准设计闭环，仅授权 yijie-contracts S1/S2。
- G2A：Pending；必须有真实生成、全部检查、双基线 breaking、人工语义/安全评审、不可变
  Contracts commit，以及 Host/Desktop 精确 pin 后才可批准。
- 不在授权范围：Host/Desktop 业务实现、SQLCipher/Tauri/CSP 变更、真实 provider/tool
  producer、tag、push、publish、supported 晋升和生产激活。

## 权威源

- AgentSessionEventV3 JSON：`jsonschema/agent/session-event-v3.schema.json`；
- v3 Protobuf：`protobuf/yijie/events/v3/agent_session.proto`；
- v3 AsyncAPI message/channel/operation：`asyncapi/events.yaml`；
- v3 SSE、content/poster 和 ACK：`openapi/agent-host/agent-host.yaml`；
- closed local report：`jsonschema/report/report-document-v1.schema.json`。

生成物来自仓库锁定的 `openapi-typescript 7.13.0`、`oapi-codegen v2.7.2`、
`protoc-gen-es 2.12.1`、Go protobuf toolchain 和 `json-schema-to-typescript 15.0.4`。
Go/Rust downstream adapters 不伪装成 JSON Schema generator；其显式 Owner、同源 fixture
conformance 和到期例外必须在各自 consumer pin 中登记。

## Candidate 范围

- v3 保留全部 v2 lifecycle/reasoning variants，并增加 image/video/file/report 四类 Artifact
  started/progress/completed/failed；
- `after` 是唯一 query cursor；无 `after_sequence` alias；
- completed 事件只含安全 metadata、digest 和 owner-only relative href；
- content/poster 支持 GET/HEAD、单 byte range、no-store、nosniff、无 redirect；
- Desktop commit ACK 按 `ack_id` 幂等，manifest 不匹配和 ID 冲突 fail closed；
- ReportDocumentV1 对六类 known section 严格 closed，对 unknown optional section 仅 opaque skip；
- 四类 exact-local synthetic fixtures 可用；真实 provider/tool producer 保持关闭。

## G2A 证据要求

1. `pnpm generate` 后生成树稳定，`pnpm lint`、`pnpm test`、`pnpm build` 通过；
2. 相对 published `f16a497e1377f45747f8ff9292b4b60cf2027f88` 和当前 pre-FEAT-128
   candidate `747cf740f2d91e76e5c1a130e8e009f1efa821b8` 分别执行 breaking；
3. `pnpm check:v1-wire -- <baseline>`（或脚本接受的等价调用）证明旧 wire 未漂移；
4. Owner 人工确认事件 terminal/ordering、href/ACK/retention、closed report、错误和安全语义；
5. 形成干净不可变 Contracts commit，由外部 FEAT-128 交付包记录完整 SHA 和源/生成物
   SHA-256，避免本文件自引用尚未形成的 commit；
6. Host/Desktop 只做精确非生产 pin 和 conformance。两者完成前 G2A 仍为 Pending，且不得
   开始业务实现。

## 回滚

不协商 v3、不启用任何 producer/consumer，继续使用已登记的 v1/v2/0.3 candidate 表面。
0.4.0 未发布，因此回滚不移动 tag，也不删除或改写历史 supported baseline。
