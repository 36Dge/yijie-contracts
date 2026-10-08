# FEAT-157 私有 Broker 控制设计候选

> 实施更新（2026-10-07）：本文保留为历史设计论证。用户授权后，正式本地候选已落入 `compatibility/market-broker-control/{wire.schema.json,control.json}`，见 [私有控制契约](market-broker-control-v1.md)。最终采用 Host **直接拥有 Rust worker**；本文旧的 Go Broker 转发拓扑、未定期限和“未生成 DTO”描述不再代表当前实现。旧 market-connectors 55defs 与 market-selection 18defs 的语义仍保持不变，真实执行资格未开放。

日期：2026-10-07。Owner：段成威。状态：**设计候选，未生成控制 DTO、未注册端点、未启用执行**。现有 market-connectors 0.1.0 的 55 个定义、9 个 Native IPC 和只读 worker 状态保持原样。本文 `contract-impact=none`，因为只补设计；真正跨进程实施需重新做 source-first 及语义评审，整体 FEAT-157 仍按 breaking 管理。

本候选承接元仓 FEAT-157 `04-architecture-and-contracts.md` 第 2/3/5/6/7/9 节及 ADR-0021 的职责边界。方案目标是复用 Codex 的协议客户端、Tool/Turn 和既有审批生命周期；不在 Broker 建立另一套 Agent、会话历史或工具执行状态机。下列名称只表示拟议动作和信息，不是已可调用的 API/上游 RPC。

## 1. 当前事实与尚未证明的连接

- Native `ChatScope` 已有 canonical owner user UUID 与 tenant UUID；`ChatAuthorizationManager` 有 native process epoch、authorization revision 和最多 300 秒的 context 生命周期。它们是可复用的身份概念，不表示现在已跨进程注册到 Broker。
- Host 有真实 `agentSessionId`、`nativeThreadId`、原 turn operationId、Host instance UUID 与 Runtime generation UUID；`startTurnV2` 已按输入摘要处理 accepted/pending/uncertain，不自动重发。原生 `turn/started` 与 start response 是 actual turn ID 的证据来源。
- Native `SelectionRef` 已冻结 installationId/revision/generation；产品安装与秘密分别归 Native SQLCipher 和 Connectors。整个选集采用下文不可变 operationId + selectionDigest 候选，不新增 UI 数值计数器；55 个定义仍无 Broker 能力 carrier。
- Q-SEL-05 已验证标准 form elicitation 保留 `yijieCallRef` / `yijieKind`：独立可信查询登记→控制面 accept→原生 accept 才执行，decline 实际执行0次，无 Runtime patch。此资格只证明原生关联机制及正常接受/拒绝；没有证明产品 carrier、租期、撤销、重放和风险审批权威。任何 `_meta`、工具说明或模型文本均不能单独授予权限。
- 当前 worker 状态源明确 externalCallsEnabled=false，qualification=not_qualified。新增本设计不能把该状态改成“可执行”，不能据编译/目录存在伪造真实账户资格。

## 2. 信任边界与最小控制信息

控制面仅由经验证的 Native/Host 进程与 Broker 交互；Runtime MCP 数据面只能提交受限工具请求，不能准备、更改、绑定、撤销或批准自身能力。公网、renderer、模型、上游 MCP 服务都不是此控制面的调用方。

候选受管 scope 绑定需涵盖 ownerUserId、tenantId、Native process epoch、authorizationRevision、Host instance 和 Runtime generation，并与 Native 安全投影和已验证进程装配逐项匹配。不能让调用者在普通 JSON 中填这组值即获得权限，不能使用 Trace 中的 tenant/user 代替资源授权。实际使用全字段、opaque registration reference 或其它 carrier 尚待控制通道资格和正式 schema 决定；目前不造 JWT、签名格式、端口或自定义认证。

能力引用是非秘密、不可兑换的不透明标识。真正数据面认证材料必须留在受管进程内并与控制面隔离，不进入 renderer、聊天/操作记录、工具结果、普通日志或 callback URL；平台 access/refresh/API key 则始终留在 Connectors。仅绑定到本机地址不等于认证。

## 3. 五个候选动作

| 候选动作 | 必须表达的信息 | 执行边界 |
|---|---|---|
| prepare immutable selection | 原 turn operationId、agentSessionId、nativeThreadId、可信 scope 引用/绑定、selectionDigest、不可变 installationId/revision/generation 选集、有界 TTL | 冻结一次提交的选集，只允许必要 discovery。逐项对照 Connectors/Native 当前权威；不得仅信请求快照，不得开始外部业务 |
| bind actual turn | 原 capabilityRef、scope/进程 generation、原 operationId、selectionDigest、由 Host 确认的 actual native turn ID、期望能力 revision | 原能力只绑定一个 Turn；不同 Turn 或过时 generation 冲突。不能用 Runtime 请求自报的 turnId 或历史文本激活；绑定不延长租期 |
| revoke capability | capabilityRef、scope/generation、预期 revision、原因及幂等请求身份 | 先阻断新准入，再正常清理；已发往外部且未确认结果的请求保持未知，不承诺撤销、回滚或已停止 |
| trusted pending-call query | 当前能力/Turn/scope、Broker 为真实 tools/call 建立的 callId | 返回精确 service/installation/generation、真实 toolName、不可变 argsDigest、审批资格和有效期；仅查受管记录，metadata 中的 callId 不能凭空建记录 |
| trusted pending-call decision | 精确 callId、capabilityRef、scope/Turn/generation、selectionDigest、toolName、argsDigest、既有审批引用、期望审批 revision、一次性决策身份 | 决策复用 approve_once/reject/cancel，重复同意图返回原回执；异参、过期、已消耗、已撤权或错 Turn 拒绝。不得把一次批准用于第二个实际调用 |

callId 是 Broker 对实际收到的单个 tools/call 的本地稳定身份，绝不冒充原生 Tool Item ID。实际同参数重复工具请求仍是两个调用身份，不能复用批准。查询/决定只管理准入与批准事实，不新建 completed/failed 工具事实；结果和原生 Tool/Turn 状态仍来自原生执行链。

支持工具集由供应商依据、真实 schema、风险/权限及幂等语义审定。toolName 来自该真实调用和受管支持工具表；不能从 serverName、显示标题、最近 Item 或原生 Prompt 自然语言猜测。approvalRef 必须由既有可信审批权威产生并可回查，不能只检查 UUID 格式即认为批准。

## 4. 租期、重放和并发候选规则

- 一个能力最多对应一个原 turn operation、一个不可变选集版本、一个 scope/进程 generation 和一个实际 Turn。绑定完成之前业务准入关闭。
- 租期必须有限且不超出 Native 可信授权的剩余有效期。**建议候选**上限为 300 秒，依据 Native context 现有上限；具体准备阶段/已绑定阶段期限和长任务策略未定稿，不能把这个建议值当现有 Broker 配置。不能无限续期或静默续到后继 Turn。
- Broker 使用自身单调时钟执行到期判断；可投影的绝对时间仅供观察，不能依赖客户端时钟续权。重放原请求不延长期限，不重新创建已失效能力。
- 原 operation 已 accepted 时，Host 返回原 Turn 回执，不再次 prepare/bind/call。pending/uncertain 时先查询原事实，不能因控制面超时制造第二轮执行。Broker 重启失去内存记录即旧能力失效，不从历史 chip、操作日志或原生 metadata 恢复授权。
- Native 停用/卸载/重授权提升的 generation 立即阻断新调用；Native 产品状态无需镜像成 Broker 的另一份业务数据库。Broker 可保留有界、可丢弃的能力索引与准入回执。
- `turn/started` 可能先于 start response；复用现有 Host begin/bind/clear 的通知时序和当前操作关联。业务调用未取得绑定时只能有界等待或失败，不能由请求先到而自行认领 Turn。
- call decision 的最大有效期不得晚于父能力、scope 授权或原生待决请求的有效期。批准是一次消耗的准入事实，超时或 response 丢失不能自动再次执行业务，尤其不能自动重放写操作。

## 5. 确定性快照与 carrier 取舍（可采纳候选，尚未生成）

### 5.1 selectionDigest：不新增 UI revision

Native 在原提交事务内冻结 turn operationId 和唯一 SelectionRef 列表。先验证 canonical UUID、正整数界限以及 installationId 唯一性，再按 installationId 的 ASCII 字典序排序。提出以下专用编码，不使用通用 JSON canonicalization：

```text
yijie.market-selection/v1\n
<canonical turn operationId>\n
<decimal count>\n
<canonical installationId><ASCII SPACE><decimal revision><ASCII SPACE><decimal generation>\n
... each sorted entry ...
```

这里 `\n` 表示一个实际 LF 字节；所有字段只含其已验证的 ASCII 字符。整数不带符号、空白或前导零。空集仍有 domain、operationId、count=0 三行。对该 UTF-8/ASCII 字节串计算 SHA-256，小写十六进制结果就是 selectionDigest。现有 sha2/标准库 crypto 足够，不新增库，也不冒称 RFC8785。

operationId、排序 refs 和 digest 只在同一提交中冻结一次；重试读取原快照，不根据当前 UI 重算新意图。Host 可用同源算法核对收到的 refs/digest；Broker 冻结该结果并与安装当前权威对照，不自增数值 selectionRevision。不同 scope/session 的 authority 仍由控制面绑定单独核验，hash 本身不是认证凭证。只有 explicit 新提交才使用新 operationId；旧 accepted 操作返回原回执。

这个精确编码目前是待纳入共享源/生成算法的一致性候选，**没有**在 Native/Host/Broker 三处先行手写实现。不能把本段 Markdown 当作运行时 wire authority。

### 5.2 argsDigest：只绑定同一 worker 冻结快照

Q-SEL-05 的 Python harness 使用 `json.dumps(sort_keys=True, separators=(',', ':'))` 后 SHA-256，且仅验证了普通合成字符串参数；它不证明跨语言通用 JSON canonical 规则。产品不采用“Host 重新序列化原参数然后猜一致”的做法。

可采纳候选为：worker/Broker 在参数 schema/适配处理完成之后，冻结实际准备调用的 parsed argument 快照；以固定 worker 的 `worker-json-v1` 编码计算 argsDigest 并登记 callId，保存同一快照直到决定/执行结束。Host 仅通过可信查询获得并原样比对 digest，不重算，也不把它当签名。最终调用必须使用**同一已登记 parsed 快照**；任何参数补齐/变更发生在登记之前，登记之后若需变更则是新 callId 和新审批，不重新赋值到旧批准下。

正式源需明确编码实现/版本、args 缺省与空对象差别、数字范围、大小限制、摘要算法、是否键控及清理规则，并以同一 worker 输入→冻结→登记→调用验证。这个编码只承诺同一冻结值的身份，不声称任意语言对语义等价 JSON 都算出相同 hash。预期可复用既有 SHA-256 与 serde_json，不引入新的 JSON canonical 库。原参数不因本候选出现在 renderer/Host 普通日志；需要人审的参数展示另由受管工具 schema 产生安全、可理解的审阅投影，不能只显示 hash 冒充知情审批。

### 5.3 控制面 carrier：优先复用 owner-owned JSONL stdio

推荐调整为 **Host 持正式 Broker 子进程，Broker 持 Rust worker**。已有 Go worker owner 的 content-addressed 制品准入、独占 stdin/stdout JSONL、正常 EOF/退出确认提供复用基础；Host 的 Runtime 管理与这条控制管道保持各自所有权，不把 Runtime 接到 Broker 控制 stdin。

| 方案 | 取舍与待证明事实 | 当前选择 |
|---|---|---|
| Host→Broker owner-owned JSONL stdio，Broker→worker 同类管道 | 无新增可访问控制 listener 或第二套控制 bearer；复用已建立的进程所有者、帧边界和正常 EOF。仍需证明只向目标进程传递管道、无 Runtime/工具子进程 FD 继承、bounded 并发请求ID/超时与双方 generation绑定 | 优先资格候选，未注册控制动作 |
| 私有 Unix socket + 单独控制能力 | 可支持非父子生命周期，但增加 socket所有权、peer识别、能力供给和清理；仅同UID不授予控制权限 | 保留替代，不在本轮默认建立 |

控制面字段中的 owner/tenant/authorization revision/Host instance/Runtime generation 必须来自已验证装配和 Native 原子快照；即使 owner-owned 管道成立，也要核对作用域和过期，不能把“父进程发来的任意 JSON”自动视为所有工具授权。启动资格及二进制路径不能由 renderer 提供。

### 5.4 Runtime 数据面 carrier：比较两条固定原生能力

数据面仍使用 Codex 支持的 Streamable HTTP；以下都是候选，尚未授予业务执行资格：

| 方案 | 优点 | 必须证明的缺口 |
|---|---|---|
| 每 Runtime instance 的本机数据面能力，经 `bearer_token_env_var` 在正常启动时注入；每次调用再精确检查不可变 lease/Turn/selectionDigest | 不要求运行中更改进程环境；新线程可使用相同受管入口认证，实际权限仍由短期单Turn lease收窄 | 环境变量必须只到目标Runtime，工具/stdio子进程不得继承；已有exclude声明不等于真实scrub证明。能力跨thread不能独立执行任何调用，旧instance/lease必须失效 |
| 每线程/lease 的短期数据能力，经内存 `thread/start` / cold-resume `http_headers` config提供 | 能独立轮换，避免向运行中进程动态添加env | 必须证明header值不进入rollout/history/config落盘、模型输入、日志/遥测或错误；固定原生接受内存config不等于其后续不保存。热resume忽略config限制仍适用 |

两者都不得含平台access/refresh/API key；数据面能力不能调用 Broker 控制动作，非secret capabilityRef只能做索引。loopback、UUID格式或原生metadata均不是认证替代。TTL/generation撤销须在最终Gateway准入处校验；目录reload或env变量名本身不构成已撤权证据。本轮不假定任何环境继承或内存config保密性已通过，不生成未实现授权API。

### 5.5 Q-SEL-05 证据适用范围

已只读核对[资格报告](../../yijie/docs/features/FEAT-157-desktop-market-connectors/evidence/runtime-qualification/qsel05-report.md)、同目录 `qualify_elicitation.py` 和 `qsel05-run-01/result.json`。测试登记 callRef/rpcCallId/server/tool/argumentsDigest/threadId/turnId，metadata仅带引用和类型；同一MCP RPC数字ID可在不同线程重复，不能全局拿RPC ID当唯一调用标识。控制决定与原生action同时一致才执行；拒绝0次执行。正式pending-call query应返回已登记调用的service/installation/generation、Runtime server映射、toolName和argsDigest，不解析自然语言。

这次证据不包括产品租期/撤销/取消/重放、身份配置、平台风险策略或公开部署。测试临时header `X-Qualification-Owner` 以及 `default_tools_approval_mode=auto` 不是正式产品协议/权限决定。现有 55defs 的只读 worker qualification 保持原样。

## 6. 尚未形成 source 的阻断

| 未决点 | 需要的事实/决定 | 当前处理 |
|---|---|---|
| selectionDigest 实施 | 下文编码候选落入 Native 原子出站快照和共享源；旧记录与同 operation 回执保持原语义 | 无 UI 自增计数器、无 Broker 产品版本计数器；当前仅设计，未改出站契约 |
| 私有 carrier 与 scope 注册 | Native/Host/Broker 身份装配、生命周期、控制/数据面能力分离、过期和撤销的实际传输 | 不注册控制 endpoint，不采用 localhost 即可信 |
| 产品审批关联 | Q-SEL-05 已证明透传、可信查询和双 accept；仍需正式调用所有权、取消/重放和 FEAT-152 避免双审批策略 | metadata 只作查询线索，测试的 X-Qualification-Owner 及 default_tools_approval_mode=auto 不能直接发布 |
| argsDigest 规范 | 参数冻结/算法/字节一致性/清理及 worker 发送值匹配 | 不生成猜测 digest DTO |
| 有界期限和资源限制 | 授权到期、长任务、准备等待、并发/记录容量和已发外部请求语义 | 推荐300秒上限仅候选；未定不能激活 |
| 权威审批回执 | 既有权限模式下风险、具体工具/参数/影响对象与 approvalRef 的核验 | 不扩大 Sorftime 单工具证明，不自创签名或新审批主状态 |

待这些信息齐全后，新增独立的私有控制源与生成投影；不得让当前只读 WorkerAuthStatus DTO 或前端 MutationResult 暗中携带未声明的执行字段。旧家族、原生 Runtime RPC 和现有 55defs 均保持语义不变。

## 7. 安全正常验证计划（尚未执行）

只使用普通合成本地服务和确定的生命周期：空集/不同线程选集、正常 cold resume、实际 turn 绑定、同操作回执重读、显式停用/到期拒绝、同参数不同调用独立审批、用户正常拒绝/取消、正常 EOF/退出后能力失效。所有输入仅为正常声明式状态和数据，不做故障强杀、权限破坏、二进制伪装或攻击 fixture。真实平台、OAuth、费用、业务写入和凭据操作继续另记授权及外部证据。测试和文档不得将“拒绝全部调用”当作51项真实业务交付完成。
