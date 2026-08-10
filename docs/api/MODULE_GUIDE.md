# API 新模块指南

## 推荐结构

```text
src/<module>/
├─ <module>.module.ts
├─ <module>.controller.ts
├─ <module>.service.ts
├─ <module>.repository.ts
├─ dto/
└─ *.spec.ts
```

小模块可以合并 Repository，但数据访问仍不能进入 Controller。模块复杂后再引入 application/domain 分层，不预建空目录。

## 实现要求

- Controller：解析协议、调用 Service、映射响应和 OpenAPI；不写业务判断。
- Service：权限之外的业务规则、状态流转、事务意图和稳定错误码。
- Repository：Prisma 查询、稳定排序、数据映射；不决定业务权限。
- DTO：运行时校验，默认拒绝未知字段；共享形状同步到 contracts。
- 写操作：防重复、并发策略、审计和失败路径明确。
- 模块必须在 `app.module.ts` 注册，权限种子和领域文档同步更新。
