# FEAT-157 daily 源与生成专项

范围：未发布 market-provider/1 候选新增 owned TushareDailyArguments 与 tushare-daily-v1 工具策略，Broker prepare/qualification 语义引用当前 live backend。没有扩展旧管理55/selection18/Sorftime，没有修改 Runtime、读取凭据或调用真实服务。真实 OAuth/schema 核验由主任务留证；此记录仅证明 Contracts 源与生成。

输入只包含一个符合六位代码加 SH/SZ/BJ 后缀的 ts_code、一个合法公历 YYYYMMDD trade_date；额外字段拒绝。策略固定精确上游 daily schema 摘要、read/ask、每批准一次调用、最多一行有限公开数值结果。生成代码与源之间通过普通成功、缺失字段、边界日期和完整 400 年闰年周期进行 Go/Rust/AJV conformance；这些检查不证明实际股票存在或上游工具执行成功。

本轮限定使用独立 generator/source check、普通 Go/Rust/JS 测试、schema lint、TS 与 Rust Clippy。旧全量生成的远程 scheduled-schema 阻断与禁止的攻击 fixture 仍按此前验证记录保留，未重复运行；没有虚构全量 baseline 通过或新的发布 pin。沿用 FEAT-157 既有 fallback 与支持基线，完整来源均由 source.lock 的实际工作树摘要记录。

最终结果：Host/provider 与 Broker JS 13 项通过；Go Host/provider/Broker 三包通过（新增 provider 两项）；Rust 引用闭包 7 项通过（新增两项），Clippy `--all-targets -- -D warnings` 通过；schema lint、TypeScript、diff 检查通过。三族生成检查及 7 路 Desktop/Host/Connectors consumer `--check` 全通过。首轮 JS 有一项因既有语义文案断言失败，已恢复明确“外部网络装配不证明账号授权”的原保证并重新生成，最终全绿；没有修改或放宽该检查。

结果语义收尾：源增加 resultRequiredNumericFields=[close] 与 resultRowsField=rows，同源生成 Rust/Go 常量、OUTPUT_SCHEMA_JSON 和独立结果 JSON Schema；身份约束直接复用输入源，未新增依赖或手写结果 DTO。非空行缺 close、null/字符串或非有限数值、超过一行均不符合 schema；真正空 rows 成功，identity-only 不能转为空。追加普通输出 conformance 后 JS 14 项、Go Host/provider、Rust 7 项及 Clippy 通过，7 路同步检查通过。Native 实现未改，仅机械同步生成消费文件。
