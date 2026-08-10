# 公共契约规则

开始任务前阅读 `docs/standards/ENGINEERING.md` 与 `docs/api/CONVENTIONS.md`；契约变更必须检查 API、Admin 和 Web 消费者。

- 只放跨进程边界需要共享的类型、Schema 和稳定错误码。
- 不导出 Prisma 模型、数据库枚举、NestJS DTO 或 UI 类型。
- 不依赖 Node、浏览器、Vue、Nuxt、NestJS 和 Prisma。
- 对外字段变更必须检查所有消费者；破坏性变更需要版本策略和 ADR。
- 运行时输入不能只依赖 TypeScript 类型，服务端仍需进行边界校验。
