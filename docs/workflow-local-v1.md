# FEAT-153 workflow-local v1 候选契约

本契约由已接受 ADR-0019 与 FEAT-153/05 设计批准。整体需求 `contract-impact=semantic`：引入新的工作流执行、身份和会话语义；现有 Public、Chat、Host 与 Runtime 交互不改变。本族是独立 opt-in、未发布的 `1.0.0-local-candidate`，无既有独立消费者，不将 dirty sibling 当作可发布 SDK。

## 权威与消费者

| 边界 | 唯一源 | Producer / consumer |
|---|---|---|
| Native → API HTTP | `openapi/workflow-local/workflow-local.yaml` | API / Desktop Rust |
| API → Coze 私有 HTTP | 上述 OpenAPI 的 `x-private-adapter` 派生面 | Coze / API |
| Vue → 8 个具名 Rust 命令 | 上述 OpenAPI 的 IPC components | Desktop Rust / Vue |
| Editor → Vue MessageChannel | `jsonschema/workflow-editor/bridge-v1.schema.json`，DTO 引用上述 OpenAPI | Editor、Vue 双向 |

Owner：段成威；实现职责分别为 Contracts、API、Coze、Desktop 仓库 Owner。多 agent 实现联审是工程复核，不能冒称独立人工审批。源 OpenAPI 先生成并通过初轮校验后，三个消费者才开始实现。共享 schema 是源的机器投影，私有数据库与部署配置保留在所属服务仓。

9 个 IPC-only components 不被 HTTP paths 直接引用，因此 Redocly 会报 unused-component warning；它们由生成 Rust 与 MessageChannel 消费。保留规则与警告，不关闭 lint 或删除合法消费类型。

## 固定语义

- 仅 exact `local` / `demo_fast` / enabled；API 使用独立 `feat-153-workflow-local` profile。固定 synthetic actor/tenant 和资源归属均由服务/native 权威判定，不能由 renderer 指定。
- API HTTP 使用 K_NA，私有 Coze HTTP 使用独立 K_AC，双方校验 run epoch。E 为 API/native 内存中的 300 秒绝对时限编辑会话，绑定 actor/resource/epoch。E 不进入 renderer，不转给 Coze。秘密不出现在 fixture/default/example。
- 8 个入口为 status、list、create、editor open/exchange/close、run start/query。列表、创建、首次打开和运行查询不依赖既有 editor。关闭或过期仅释放编辑能力，不伪称远程运行已取消。
- 写入 operation UUID 由 native 生成。相同 ID + 请求摘要不产生第二次副作用；相同 ID 不同请求返回冲突。结果未知查询原 operation，不自动换 ID 重发。receipt completed 只表示操作登记/副作用响应确认，run 成败必须另查 Coze 原生终态。
- `OperationReceipt.version` 只表示本次 publish 提交的版本或 release run 选择的版本；create/save/debug test 省略。`Workflow.published_version` 是资源已有的最近发布版本，不能投影成新 save 操作的结果版本。正常响应与原 operation 查询须保持同一语义。
- 草稿 revision 是真实 Coze commit_id；save 是 CAS。成功试运行证明绑定同一 revision；内部发布分配精确 v0.0.N，并以指定版本运行。公开最新版本接口不能替代指定版本执行。
- 初期图只含开始、文本拼接、结束，完整线性图才能运行；可保存范围内的未完成草稿。input 4096、prefix 1024、output 5120、canvas 262144 均为 UTF-8 bytes；完整 HTTP/IPC 524288 bytes。列表默认20、最大50条，使用无 canvas/大结果的摘要；详情独立读取，不截断 JSON。
- debug/release 共用一个在途槽位，30秒为 Coze 合作式 runner 预算。HTTP 超时和未知状态不能自行变成失败或取消。查询的 state 保留未来原生值，terminal 是显式事实。
- 错误使用源 ErrorResponse；不透传 SQL、DSN、堆栈、平台原始错误、秘密。来源与会话错误不自动降级到旧 OIDC/PAT 或任意 HTTP proxy。

## 生成、验证与本地来源

```sh
pnpm generate:workflow
pnpm check-generated:workflow
pnpm test:workflow
pnpm sync:workflow api
pnpm sync:workflow coze
pnpm sync:workflow desktop
```

`YIJIE_GO` 可选择已验证的原厂 Go 工具链路径。Go/TS 使用当前仓锁定的 generator；Rust 是本脚本支持范围明确的 serde 类型投影，标量校验由源 schema 驱动的 validator 执行。JSON Schema、私有 OpenAPI、TS MessageChannel 类型均从同源生成，不手改。正常 `generate:safe` 也生成全部这些输出，`validate:schemas` 实际验证带摘要校验的投影及 bridge，不静默跳过新 schema。

`compatibility/workflow-local/source.lock.json` 明确 `mode=local_candidate`、`release=false`、真实 base commit 和源/generator/各生成物 SHA-256。各下游独立 `contracts/workflow-local.lock.json` 记录逐文件消费来源，不改旧 public/Runtime 锁。没有创建契约提交/PR/tag，因此当前只可用于本地候选实现；未来合并前必须先合并 Contracts 并 pin 不可变完整提交，公开发布还需独立批准。

兼容基线为当前实现前 `811f38d6b104fa18477107e7ac91a85e19c445d1`（本族无已发布基线的 fallback）、已发布 `f16a497e1377f45747f8ff9292b4b60cf2027f88` 和 API 旧 pin `29317b6426578749dc698fc2ad32b986ee5c8e9f`。三次结构 breaking check 均通过；本族在三基线均不存在，检查同时保护它们已有的 API/Proto/AsyncAPI/JSON Schema。旧 wire 源与已有 SDK 除新增 namespace 导出保持字节不变。结构通过不等于真实引擎或跨平台端到端通过。

## 启用和回滚顺序

### 浏览器生成消费

工作流 canonical generator 生成自包含 AOT ESM 校验器，导出 `validators[name](unknown)`
与 `validateBridge(unknown)`，配套声明直接引用生成的 OpenAPI components 和
WorkflowEditorBridgeV1。Ajv 只在生成期编译，browser 产物没有 require、Buffer、eval 或
new Function；UTF-8 字节限制用 TextEncoder，字符 maxLength 保留 Unicode 码点语义。
生成选项 `defaultNonNullable=false` 保留源 optional 字段，RunQueryInput 的非 history
操作无需也不能为了满足错误类型声明而补 limit。

Desktop 消费 `src/api/generated/workflow-local-validator.gen.js` / `.d.ts` 和
`src/domain/workflow-editor-bridge.generated.ts`。Coze 独立 editor 消费
`frontend/apps/workflow-local/src/generated/` 下的 OpenAPI、bridge、validator JS/声明。
已有源 JSON Schema 仍同步；API/Coze 另消费 canonical source.lock.json 原字节用于静态
bundle 来源绑定。类型 import 的目录差异由 canonical sync 的 `typescript-imports-v1`
投影处理，consumer lock 同时记录原字节 hash、投影映射与结果 hash；不手改生成文件。

现有 connect/ready/dirty_changed/request_close shape 保持不变。父页计时、端口切换与
dirty/base revision 保留属于已批准会话交互；不能以自行广播无关联 response 发明另一套
session 状态。实际 dev/packaged WebView CSP 和 origin 行为仍须正常资格验证。

源与生成物 → API/Coze/native 候选实现及 conformance → 第4步独立受控 local 栈 → 第5步 editor/WKWebView 资格与产品接入。当前默认关闭，不改变原 Chat 启动。回滚先关闭 workflow gate，撤下独立服务；保留独立工作流数据，不删除 volume，不回滚或改写旧 Chat 数据。

第3步不启动 Docker、不执行实际 migration、不写业务数据，也不宣布 D4。默认历史测试链中的危险归档/注入式 fixture 未执行，按用户永久规则使用 safe/focused 检查。最终逐仓结果与未执行项由 FEAT-153 交付包登记。
