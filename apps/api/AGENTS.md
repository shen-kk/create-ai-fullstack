# API 开发规则

- API 是业务规则、权限校验、事务边界和数据访问的唯一权威来源。
- Controller 只处理协议适配：解析输入、调用用例、映射输出。
- 业务规则放入 Service/Application/Domain；Prisma 查询不得散落到 Controller。
- 所有外部输入使用 DTO + `class-validator` 校验，默认拒绝未知字段。
- 数据库变更必须修改 `prisma/schema.prisma` 并提交迁移；禁止只手改数据库。
- 不向客户端暴露堆栈、SQL、内部 ID 策略或第三方原始错误。
- 对权限、状态流转、金额和并发写入编写失败路径测试。
- 新模块在 `app.module.ts` 显式注册，并更新领域文档与 OpenAPI 注解。
