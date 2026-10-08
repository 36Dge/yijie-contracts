# FEAT-157 Host / Provider 候选专项验证

2026-10-07。范围：market-host/1 0.1.0、market-provider/1 0.1.0、market-broker-control/1 本地候选 0.2.0。只修改 Contracts 源/生成/文档及机械同步消费者生成文件；没有真实模型、OAuth、Keyring 或 MCP 业务调用，没有 commit/push。

本轮普通合成数据检查通过：

- `node --test tests/market-host.test.mjs tests/market-broker.test.mjs`：Host/provider 5 项与 Broker 7 项全部通过。
- `go test ./sdks/go/market-host ./sdks/go/market-provider`：Host 4 项通过，provider 编译通过。
- `cargo test --offline --locked --manifest-path tests/rust-market-host/Cargo.toml --target-dir /tmp/yijie-feat157-market-host-contract-target`：5 项通过；同 target 的 Clippy `--all-targets -- -D warnings` 通过。
- `node scripts/validate-json-schemas.mjs`：旧 schema 与新 family 结构校验通过。
- `pnpm exec tsc -p tsconfig.json --noEmit`：包含两条 Native UI TS/AJV 投影的检查通过。
- 三族生成 `--check`，并通过专项测试复核旧管理55/selection18源生成一致性；消费者机械同步单独核对。
- `git diff --check` 通过。

新增普通 conformance 共 14 项（JS 5、Go 4、Rust 5），验证 required/null、封闭请求、源别名、合法 identity/profile/content/provider 状态、Native 两命令引用闭包及无秘密错误形状。源结构检查不代替 Host HMAC/Native 权限锁、实际 Runtime state machine 或真实 provider 资格。

本轮未重跑无关全量及历史基线。此前 FEAT-157 记录保留：三个旧基线 `f16a497e1377f45747f8ff9292b4b60cf2027f88`、`6f632f155eacdaf93df0e0b00b5dab9e369c5442`、`811f38d6b104fa18477107e7ac91a85e19c445d1` 结构检查通过；明确 fallback `1a213ac8383e95ac6ec69363937687904fa3591c` 的旧 scheduled-plan 远程 schema 解析阻断，不能称本轮全部 baseline 通过。旧 full safe generation 同样受此阻断；旧普通全量还保留 Runtime pin 与 scheduled schema 两项既有失败，详见 [此前验证](market-broker-control-validation-2026-10-07.md)。

用户禁止攻击性 fixture、危险归档、权限破坏、进程强杀及运行时伪造，因此未执行含这些活动的旧全量入口。当前采用正常源/类型/编译检查，不伪造缺失的通过结果。没有新增 supported tag；所有生成锁均为真实本地工作树候选，不是发布 pin。
