# 原生提示词输入复用（2026-11-04）

本批由 Owner 要求复审并实施提示词链路 P1 整改。配置结构和 Skill 输入以既有
`yijie-codex@55b4e51049d6f4fc0af4b35f12832357f5e4ea06` 为权威；Runtime 二进制、
补丁和 app-server wire 不变。Host 是配置 schema 的消费者，Desktop 经 Host 使用
原生 Skill input，不能另写原生配置 DTO、技能发现或正文加载引擎。

`generate-runtime-kimi-k31-pro.mjs` 从已核验来源复制 `core/config.schema.json` 和
该固定产物的 `v2/TurnStartParams.json`，连同原生来源与派生摘要记入现有 source lock。
Go 投影只嵌入原文件，不改字段、默认值、校验语义或原生 Skill 路径选择行为。
同步仍使用现有不可变来源脚本。schema 全量包含原生配置能力，不表示 Host 授权用户
修改所有字段；Host 继续只允许其受管边界内的原生拥有状态并保护 provider/security 层。

此 schema 消费投影为 additive；启停持久状态兼容与后续提示内容调整按 Host semantic
变更验证。本投影不改变任何现有 HTTP、事件、数据库或权限协议，不发布 tag。
本轮 fallback 为实施前 Contracts `dfd9012954c716d360f702d6be3bdbdef75e0633`。

已执行 canonical 全量安全生成、全量 lint、13 项相关配置/模型/input-only 一致性检查。
Host 必须另行完成原生技能正常停用、正常 EOF 退出、重开及读取禁用状态的集成检查；
只通过 schema 测试不能宣称产品启停或完整 P1 闭环已完成。

## 结构化技能选择与原生热重载

`SelectedSkillRef` / `SelectedSkills` 以 Agent Host OpenAPI 为唯一源；Native 输入族引用
相同定义。既有 text 输入新增可选 `skills: [{id, version}]`，旧请求省略该字段时保持原语义。
普通、模型、连接器及专家提交沿原 content-block 管道保存并转发选择，不能只改提示文本。
Host 验证受管目录、版本和安装回执后投影到现有原生 `UserInput::Skill`；正文读取、
同名处理和同轮去重由 Runtime 完成。公共请求不接受路径或 Skill 正文。

Native 本地输入持久化需要增加独立元数据表与前向 reader guard；不改历史正文、原生
rollout 或旧无技能输入的摘要。所有受影响消费者必须先接收新来源，前端入口最后启用。
新字段的发布顺序是 provider-first，不能向旧 Host 发送它；当前仅本地候选，不新增 tag。

配置热重载直接消费已存在的 `config/batchWrite`：`edits=[]`、`reloadUserConfig=true`。
两个请求/响应 schema 也由固定 Runtime 原文件投影。原生负责把用户配置更新到已加载
线程，不新增 Host 配置缓存、线程重建或预算计数逻辑。旧 Runtime 投影保持原方法表；
新增消费方法登记在当前 Kimi candidate 的来源锁。

结构化输入生成后的全量 lint、42 项相关检查，以及实施前 fallback、已发布与既有
Native/scheduled/experts/model/retrieval 共 10 个比较基线均已通过。历史专家测试原来把
跨 family 当前源码永久绑定到更早 commit，已改为验证生成检查不修改当前共享源码；
两个保留的 Skill manifest 仍按原不可变基线检查，不放宽它们的规则。

整体实施最高影响为 breaking（Desktop 私有本地格式新增 SQL 43 前向 reader guard），
不是 Runtime wire breaking。旧 HTTP 请求和历史正文保持原语义；旧客户端不能写入
已升级的本地库，回退必须使用保留新格式读取能力的版本。日常数据的实际迁移与完整
产品验收尚未执行，不能由本仓检查结果代替。
