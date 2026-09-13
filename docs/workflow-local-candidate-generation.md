# Workflow local 候选生成入口

FEAT-153 local 候选采用独立入口：

```sh
make workflow-generate
make workflow-check
make workflow-test
node scripts/sync-workflow-consumer.mjs api --check
node scripts/sync-workflow-consumer.mjs coze --check
node scripts/sync-workflow-consumer.mjs desktop --check
```

`scripts/generate-workflow-local.mjs` 是权威生成实现，产生源锁记录的 Go、TS、Rust、
JSON Schema、私有 OpenAPI 投影与浏览器AOT校验器。生成和检查不调用历史危险fixture流程。

旧 native Chat consumer 的不可变来源同时固定了全局 `scripts/generate.mjs` 和
`package.json`。本轮真实 Desktop 启动发现，即使只是给它们追加工作流入口，仍会正确触发
committed source mismatch。因此这两个文件保持原提交字节，独立 Makefile target 调用
工作流 leaf generator。没有放宽 `--require-committed`，没有刷新原 Chat lock 或增加发布提交。

第3/5步早期记录中的 `pnpm generate:workflow` 等临时脚本入口已由以上入口替代，历史运行
证据保留。完整仓库发布/通用SDK生成需在后续形成不可变提交时统一审核；当前只声称工作流
候选专用生成检查和原 Chat 固定来源检查通过，不声称全仓fixture或发布资格。

## Git 交付时固定来源

生成锁的 `base_commit` 是创建候选时的基线，不是包含该锁的提交。检查入口显式重放该
基线，避免仅提交 Git 就让生成检查产生自引用漂移。需要重建同一来源锁时使用
`node scripts/generate-workflow-local.mjs --base-commit <原完整基线>`。

Contracts 提交后，执行 `node scripts/sync-workflow-consumer.mjs <api|coze|desktop>
--source-commit <Contracts完整commit>`。脚本在写入前逐文件核对该提交中的全部源、生成物
和来源锁，再把 `source_commit` 写入消费者锁。之后普通 `--check` 自动沿用这一精确引用；
不得把 `base_commit` 冒充实现提交。已有 pin 不会随 sibling HEAD 自动升级。

该引用只固定本地候选的来源，`release: false` 和 `1.0.0-local-candidate` 保持，不代表
合并、tag、SDK发布或生产资格。此次交付工具修正 `contract-impact=none`：只修复来源证明
和生成可复现性，不改变 wire、validator、身份、会话、持久化或运行行为。
