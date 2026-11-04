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
