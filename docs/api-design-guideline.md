# API Design Guideline

所有 API 先定义 contract，再由 `yijie-api` 或其它服务实现。完整的影响分类、权威源、
输入/输出兼容方向、评审证据、不可变引用和下游合并门禁见
[`contract-change-policy.md`](contract-change-policy.md)。

“先定义”不只覆盖字段形状，还覆盖 path/method/status/error、认证、租户、权限、
审批、幂等、分页、默认值、单位、排序和重试语义。实现不得成为反推契约的第二权威源。
