# Security Policy

契约示例和测试数据只能使用公开或合成数据，不得包含真实 token、PII、订单或商家经营数据。

原生受限策略回执只作为Host的证据输入，不代替授权。新`runtime-input-only`投影从Runtime canonical schema机械生成，精确锁定产物、schema tree和patch；缺字段、未知字段及不完整策略不能被解释为允许。见[投影边界](compatibility/runtime-input-only/README.md)。
