# FEAT-155 第二阶段 scheduled-plan v0.1.0

2026-09-18，本地候选，未发布。Owner段成威/platform-team；producer为Desktop native，实际消费者为本阶段native计划服务，后续Vue入口尚未注册。新增共享结构是additive；Desktop私有SQLCipher版本兼容按breaking治理，两者不混同。

唯一源为`jsonschema/scheduled-tasks/plan-storage-v1.schema.json`。时间规则、名称/内容和目标模式引用第一阶段`plan-draft-v1.schema.json`的原定义；leaf generator解析引用后生成Rust/TypeScript类型及完整schema，不修改原草案、Host查询族或历史通用generator。派生类型负责闭合字段形状；IANA、日期、trim文本、scope、revision、目标存在性仍由native校验，同源测试覆盖实际Rust输出。

PlanDefinition、SavePlanRequest、PlanView、TimePreview及错误枚举是本阶段边界。没有HTTP API或Tauri command。scope/参考时钟来自native，不接收renderer自授身份或grant；已有聊天引用的是本地conversation ID，受管目标只存意图。时间单位为UTC Unix秒；rule_version与tzdb_version由native记录。新建/编辑均保存paused，有限授权引用为空，enabled和真正投递尚未开放。

稳定request ID在owner/tenant内去重；相同内容重放返回当前计划视图，不重新应用旧编辑，删除后返回deleted事实，不复活。修改须带plan_id和expected_revision。读取deleted不进入普通列表。普通暂停计划的next_at仅是日历预览，不承诺自动执行；UI后续必须按状态解释。

来源锁`compatibility/scheduled-plan/source.lock.json`记录源/生成摘要、generator身份及base commit，mode=local_candidate/release=false。Rust Debug省略字段值。`node scripts/generate-scheduled-plan.mjs`生成；`node scripts/check-scheduled-plan.mjs`校验可再生；`node scripts/sync-scheduled-plan.mjs [--check]`只写/校验Desktop本族四个文件。`node --test tests/scheduled-plan.test.mjs`检查结构；`node scripts/check-scheduled-plan-producer.mjs <正常合成Rust输出>`验证producer符合性。

兼容fallback：`db4458fe94572c4df41a114005d54a049bb79b1f`；已发布支持`f16a497e1377f45747f8ff9292b4b60cf2027f88`；本机native-v1/v2来源`6f632f155eacdaf93df0e0b00b5dab9e369c5442`和`811f38d6b104fa18477107e7ac91a85e19c445d1`。四基线均无本族，既有契约不变；源与生成物通过后才同步native。本候选不是Git发布pin，第三阶段/正式激活前须重新核对对应consumer和存储格式。

第二阶段无模型/Runtime/Host调用；测试只用普通JSON与临时SQLCipher数据。全量攻击/故障fixture未运行。最终结果及原始失败记录见元仓FEAT-155的08报告，不以schema测试代替产品D4。

2026-09-18契约收口：外部引用使用既有canonical `$id`与fragment，条件字段引用原定义；同仓闭合注册表解析时保留片段所属文档上下文。原始源和生成投影均以`strict:true`检查，resolver纳入source.lock输入摘要。此批按源解释/校验工具semantic变更记录；240个修复前普通样例判定一致，Rust/TypeScript类型逐字节不变。仍为未发布0.1.0候选，无字段、运行行为或数据库变化；实际结果见元仓FEAT-155的12收口报告。
