# FEAT-173 内置视频 MCP（本地候选）

`contract-impact=additive`。独立 `video-generation/1` 源同时定义 `generate_video`、`get_video_result`、Host 私有请求和封闭回执。Owner 为 Agent Runtime Team；producer 为 Host，consumer 为同次构建的 Rust media adapter 与 Host 原生显示投影。用户接受修订 2 和视频交付补充；当前为本地工作树候选，不是已发布 SDK。

沿用 `yijie_media`、AdapterStartup.media 独立 capability、Native MCP 发现/执行/审批和 Code Mode exec/wait。固定 Runtime、既有 image/document/Artifact/专家协议与生成器不改。get 可能交付产物，readOnlyHint=false、idempotentHint=true；二者精确 approve，服务器不允许并行调用。每次仍检查 Host 当前 root 与持久专家绑定，任何已选专家都排除内置创建、查询和下载，不以专家失败作为兜底许可。

创建输入仅描述、当前图片模式与 1-based 编号。模型固定 doubao-seedance-2-5-260628，供应商 body 只有 model/content，可选参数全部省略。私有请求不得提供 API key、模型、URL、路径、供应商任务 ID 或 optional provider 参数。请求/结果各有 16KiB 上限；UUID 只接受本会话拥有的原生身份。API 凭据复用 Seedream 运营条目，bridge 沿用原独立 bearer，不向模型或前端暴露。

video_operation_id 复用创建 root ID，与当前观察 root 分离。pending/existing_operation/selection_required 为普通工具结果。无 ID 查询只解析本聊天记录；多条需明确选择，不猜最近。持久化是 Host 私有可选 bucket，不进入 wire/SDK；不保存 prompt、图像、下载 URL、manifest、bytes 或 ACK。首次 handoff 后只查询原 Artifact，不能重发或重建；staged 不等于 Native committed，更不等于实际播放。

生成和检查：

```sh
node scripts/generate-video-generation.mjs --consumer=host
node scripts/generate-video-generation.mjs --consumer=host --check
node --test tests/video-generation.test.mjs
go test ./sdks/go/videogeneration
```

源、普通示例、共享 projector、generator 和派生物摘要固定在 `compatibility/video-generation/source.lock.json`；Host 精确快照在 `api/video-generation.candidate.json`。实施前 fallback 为 `cca445ca30c8d13b11185212b3d709bae67cf4aa`。新族不收窄旧族，保留原有发布/Native 支持窗口。fallback 全结构检查已通过；整体 generation check 仍报告既有 `runtime-chat-models/source.lock.json` provenance 漂移，未为本功能刷新该旧锁。本族检查、全 lint、Go/Rust/JSON Schema 同源示例通过。

按同次候选先同步 Contracts，再构建 Host/共享 adapter，最后由 Desktop canonical launcher 核验并启动。旧 Host 不接新工具，禁止混配；开发回退使用 `YIJIE_FEAT173_VIDEO_MCP=false` 正常重开，保留同 Home、原图片能力和私有记录；不删除远端任务，不声称已停止计费。公开发布前仍需不可变来源及完整 consumer 发布门禁。

实现复审增量为semantic：只更新能力描述和观察/期限/限流权威语义及普通回执例子，字段/枚举/工具名不变。GET或下载超时是最大值，受剩余总期限限制，不要求剩满60秒才开始下载；已知终态、真正本地停止和单次观察到期分开处理，已收到Retry-After在观察结束后仍保留。新31项同源检查和原生/Host回环通过，旧费用证据不冒充本轮重跑。
