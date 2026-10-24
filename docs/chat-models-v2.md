# FEAT-164 model selection v2 candidate

Owner: 段成威。整体影响 breaking；family 0.2.0，未发布、未激活。

权威源为 `jsonschema/chat/model-selection-v2.schema.json` 与 `openapi/chat-models-v2/chat-models-v2.yaml`。保留 v1 源和消费者；新的路径位于 `/v2/model-chat/`，不能在旧端点静默发送新身份。

`ActiveProfileId` 只含新 Kimi / MiniMax；`ProfileId` 额外保留退役 K3。目录只提供精确活动定义。`Selection.state` 保持应用事实，`availability=retired` 独立表达已知退役身份，不能假装未知。`availability=ready` 只允许 ready + 活动 profile。

新选择和显式恢复请求只能指向活动身份。历史 operation snapshot 可含 schema 1 和旧身份；只读 GET receipt 不带活动 model header。committed receipt 必须携带原 result，不能将它当当前 Selection；实际服务仍须检验 session/operation IDs、原 digest 和原 revision 的一致性。

原 result 保留原 schema_version 与字段集合：v1 结果不能添加 availability，也不能转为 v2；v2 结果必须满足 v2 Selection。版本化 snapshot 直接引用 v1/v2 权威源验证，拒绝把新 profile 放进 v1 请求或把旧 profile 放进 v2 新请求。目录的 available 与 reason 必须一致；activation_required 显式表示尚未激活候选。转发路由在原错误之外明确包含模型准入的 400/409/503 错误；原业务错误结构保持不变。

`POST .../model-operations/{operation_id}/recover` 是明确重新应用同一目标配置，不是只读；只允许同 operation 处理自己留下的非 ready 状态，其它待执行/批准工作继续阻断。committed 仅返回回执。协议不会授权推理或绕过权限。

生成入口 `node scripts/generate-chat-models-v2.mjs`，检查加 `--check`；普通 JSON Schema/路由测试 `node --test tests/chat-models-v2.test.mjs tests/chat-models.test.mjs`；Rust ordinary round-trip 位于 `tests/rust-chat-models-v2`。生成类型仅负责类型/枚举解码，完整常量、跨字段和业务关系仍须 schema validator + service conformance，不把 serde/golang 类型反序列化当完整协议校验。

OpenAPI 的 canonical URL 是 schema 标识符；离线 generator 从本仓权威源解析并登记所有传递依赖。对生成的 `sdks/openapi/chat-models-v2.bundle.json` 执行 Redocly lint；分辨类型的 discriminator 引用保留为可解析的具名组件。此独立 family 通过 Makefile 的 `chat-models-v2-*` 入口生成/检查，不替换既有生成入口。

Runtime 独立投影入口是 `scripts/generate-runtime-kimi-k31-pro.mjs`，从已完成构建的 `.yijie/build/kimi-k31-pro-r1/aarch64-apple-darwin` 校验实际 binary、manifest、269 个 schema 及 0001—0007 patch 摘要，生成 `compatibility/runtime-kimi-k31-pro/source.lock.json` 与对应 Go constants。它先检查保留的 input-only 权威，不修改旧 runtime-chat-models 投影，也不向 Host/Desktop 同步。mode=local_worktree_candidate/release=false 不能当作不可变已发布 pin。

后续顺序：G2A 不可变候选及 consumer 审查 → 兼容 reader 和新路由 → G2V → 各切片 → 停派发/前向迁移 → 新执行。当前没有 Host/Desktop v2 consumer，也没有旧日常库迁移；不得用本仓检查通过声称用户端已换模型。

比较基线：已发布 f16a497e1377f45747f8ff9292b4b60cf2027f88、Native 6f632f155eacdaf93df0e0b00b5dab9e369c5442 / 811f38d6b104fa18477107e7ac91a85e19c445d1、scheduled db4458fe94572c4df41a114005d54a049bb79b1f、experts 35e0949c95d7a59ca5480715c225766dcc822056、当前 chat-model family 前身 54be9314dce5319b049dc0a236800fd1a1fdd7a1、实施前 HEAD bedf4159b0fa22e24efe6c295f8b0d4845df56b7。不新增 supported tag 或改变旧 family 的支持窗口。

现有 `check-breaking.sh` 的部分 scheduled baseline 会把 canonical `$id` 当远端下载地址。FEAT-164 使用 `node scripts/check-feat164-breaking.mjs <full-sha>`：分别提取 baseline 与当前的原始 OpenAPI/JSON Schema，在临时副本中只把 canonical 引用改为同一来源树的本地位置，随后比较所有 baseline OpenAPI，并执行原 Protobuf/AsyncAPI/JSON Schema 检查。不会改源、跳过 scheduled family、放宽约束或把工作树当发布来源。原入口失败与离线比较结果均留在元仓 FEAT-164 evidence。
