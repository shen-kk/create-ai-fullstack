# 系统架构

浏览器应用只依赖稳定 API 契约；API 负责用例编排与领域规则；Prisma 仅存在于 API 数据层。

```text
Admin (Vue SPA) ─┐
                 ├─ HTTP / OpenAPI ─ API (NestJS) ─ Prisma ─ PostgreSQL
Web (Nuxt SSR) ──┘
        │                    │
        └── @template/contracts ──┘
```

部署能力采用独立控制面，具体决策见 ADR-0009：

```text
首次：Local Deploy Worker ──SSH──> Remote Deploy Agent
后续：Admin ──API──> Deployment Job ──CNB Build──> Registry
                                      └──────────> Deploy Agent ──> Admin/API/Web
```

Deploy Agent 不属于业务应用端；它必须独立于 API 生命周期，避免 API 部署自身时中断任务。

## 模块结构

服务端业务模块推荐采用：

```text
feature/
  dto/                 # 边界输入输出
  domain/              # 实体、值对象、纯业务规则
  application/         # 用例编排
  infrastructure/      # Prisma、外部服务实现
  feature.controller.ts
  feature.module.ts
```

简单 CRUD 可以从扁平结构起步，但领域规则不得留在 Controller。只有出现真实复杂度时才增加分层。

## 依赖方向

- 页面 → API 客户端 → 公共契约
- Controller → Application/Service → Domain/Repository
- Infrastructure 可以依赖 Prisma；Domain 不可依赖 NestJS、Prisma 或 HTTP。
