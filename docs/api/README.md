# API 开发规范入口

API 是业务规则、权限、事务、持久化和 OpenAPI 的唯一权威来源。

## 必读路由

- 通用接口约定：`docs/api/CONVENTIONS.md`
- 新模块实现：`docs/api/MODULE_GUIDE.md`
- 数据库与事务：`docs/api/DATABASE.md`
- 鉴权、权限与审计：`docs/api/AUTHORIZATION.md`
- 跨端契约：`packages/contracts/AGENTS.md`

新增功能顺序为：契约 → 权限/错误码 → Service → Repository/迁移 → Controller/OpenAPI → 测试。Controller 不得直接访问 Prisma。
