# FEAT-155 scheduled-task-recovery v0.1.0

2026-09-18 local candidate，contract-impact=additive。Owner段成威/platform-team；producer为Host，后续consumer为Desktop native/client-team。用户已接受方案并授权第一阶段，不构成发布或独立人工代码评审。

权威源：`openapi/scheduled-task-recovery/scheduled-task-recovery.yaml`；Go类型和JSON Schema投影由独立leaf generator派生，`x-state-rules`约束原受理turn与reserved映射的字段关系。`jsonschema/scheduled-tasks/plan-draft-v1.schema.json`是草案唯一源，本阶段不接入模型；形状合规不代替native的IANA时区、未来时刻、trim内容、目标解析和授权检查。

两类GET只读既有task索引与(session,operation)记录，不调用Runtime或更新存储。只在精确local/demo_fast启用，Host保留owner-only bearer及ID关联校验，Trace不作为身份权威。Desktop必须校验native authority与本地计划/会话scope后消费；没有新增多租户Host服务。responding_host_instance_id省略为unknown，仅描述当前响应实例，不证明历史执行属于该实例或已终止。404也可能源于正常清理，不能推断从未执行；503、pending、uncertain不能触发自动重投，accepted不是业务成功或原生终态。

plan、run仅在后续Desktop账本存在；conversation/task是聊天身份，Host session、Runtime thread/turn是各自执行身份；operation是同一session内投递身份，不混用plan_id/task_id或跨session查询。三个目标意图为专属聊天、每次新聊天、已有聊天；模型只给意图/显示名称，不能给native ID、路径、scope、预算或保存成功。

生成/校验：`make scheduled-recovery-generate scheduled-recovery-check scheduled-recovery-test`，另运行新源定向Redocly lint和Go vet。`node scripts/sync-scheduled-task-recovery.mjs [--check]`仅同步Host候选。manifest记录base commit、源/生成物digest及generator；base不是包含新代码的提交，mode=local_candidate/release=false，不改旧pin/通用generator/package/Runtime锁。

方向：Contract source→Host provider→阶段三Desktop consumer。第一阶段没有Desktop consumer激活；旧Host不支持时后续consumer须保持unknown/阻断，不能另行执行。新增端点不改变旧请求、响应和持久格式；回滚移除新端点即可，无DB迁移。进入合并/发布前需真实commit及consumer pin，当前不生成tag或发布SDK。

兼容基线：新增族fallback为当前完整commit `db4458fe94572c4df41a114005d54a049bb79b1f`；已发布支持基线 `f16a497e1377f45747f8ff9292b4b60cf2027f88`；本机native-v1 pin `6f632f155eacdaf93df0e0b00b5dab9e369c5442`及native-v2来源 `811f38d6b104fa18477107e7ac91a85e19c445d1`。本族在上述基线不存在；旧族的源和生成物应保持逐字节相等于本轮base，完整历史差异检查单列，不将其他历史候选变化归到FEAT-155。

安全验证仅用普通合成JSON和临时Store正常接口；全量generate/test包含历史攻击归档和故障fixture，按用户长期条款不执行，用本族定向生成、conformance及已审查回归替代；不宣称全仓测试或产品D4通过。

2026-09-18契约收口：条件required同步生成无附加限制的字段声明，保留父级原字段约束和forbidden规则，使投影可严格编译；草案同义声明同步来源摘要。Host仅同步schema和candidate，Go类型及GET处理不变。原始恢复OpenAPI未变，仍为未发布0.1.0；本次source/tooling的semantic分类及修复前后判定、Host定向回归见元仓FEAT-155的12报告，不改变第一阶段additive历史分类。

## 3B-2 Rust consumer candidate

The existing leaf generator now derives closed Rust types, canonical ID checks,
omitted-versus-null handling and x-state-rules validation from this same source,
including the nested error object. The wire version and existing Go/schema bytes
remain unchanged. The leaf sync also copies Rust/schema/candidate provenance to
Desktop; Host receives the updated generator/source digest even when its DTOs
are unchanged. No legacy generator, pin or Runtime source is replaced. Desktop
uses the two exact GETs with owner bearer and managed Host liveness checks;
Runtime readiness is not a prerequisite for these storage-only queries.

## 本地源码固化（FEAT-155）

Consumer候选元数据新增`source_commit`与`source_lock_path`，由既有sync脚本从显式`YIJIE_SCHEDULED_CONTRACTS_COMMIT`生成。该完整commit必须包含相同源lock及其全部源/生成物，check从consumer已固定引用读取Git对象并比较工作树。原`base_commit`保留生成比较基线含义，不充当实现来源；`release:false`保持。本批没有改变wire、数据或权限语义。六个FEAT-155族共用一个仅负责来源元数据的内部helper，不引入发布框架。
