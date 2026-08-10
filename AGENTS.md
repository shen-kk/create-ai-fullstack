# AI 协作总则

本文件是所有 AI/开发者进入仓库后的第一入口。目标是让实现可预测、可审查、可延续，而不是依赖聊天记录。

## 开始任务前

1. 阅读本文件与目标文件所在目录最近的 `AGENTS.md`。
2. 阅读 `docs/ai/CONTEXT.md` 和由初始化命令生成的 `docs/ai/PROJECT.md`，再按其中索引读取与任务有关的领域/架构文档。
3. 先搜索现有实现；能复用就不要新建平行抽象。
4. 任务涉及架构、数据模型或公共契约时，先更新对应文档或 ADR。
5. UI、交互、AI 协作和模板发布遵循 `docs/ai/AI_DEVELOPMENT_STANDARD.md`。
6. 涉及任何页面或组件时，先读取 `docs/design/COMPONENT_STANDARD.md` 并运行 `pnpm ui:check`。
7. 现有规范不适合需求时，先说明证据、备选方案和影响；经确认并记录 ADR 后可以改进规范，不得机械套用。

## 文档路由

- 所有开发：`docs/standards/ENGINEERING.md`、`docs/standards/FEATURE_WORKFLOW.md`。
- API：`docs/api/README.md`，再按其索引读取数据库、权限或模块规范。
- 后台管理：`docs/admin/README.md`；Admin 有独立组件与视觉规则。
- 用户端：`docs/web/README.md`；Web 有独立组件、视觉、动效和 SSR 规则。
- 跨端契约：`packages/contracts/AGENTS.md`、`docs/api/CONVENTIONS.md`。
- UI 规则例外：记录到 `docs/decisions`，并按组件标准声明引用。

## 仓库边界

- `apps/admin`：内部运营后台，只通过 API 访问数据。
- `apps/web`：面向用户的 SSR/SEO 应用，只通过 API 访问数据。
- `apps/api`：业务规则、鉴权、持久化和 OpenAPI 的唯一权威来源。
- `packages/contracts`：跨端共享的纯 TypeScript 契约；不得依赖框架或数据库。
- `packages/config`：共享工程配置；不得承载业务逻辑。
- `docs`：架构、领域语言、决策与 AI 上下文。

禁止前端直接访问数据库，禁止跨应用从 `src` 深层导入，禁止在控制器或页面组件中堆积业务规则。

## 实现原则

- TypeScript 开启严格模式；不使用无解释的 `any`、`@ts-ignore` 或非空断言。
- 先定义契约，再实现服务端，再接入客户端。
- 输入必须在系统边界校验；错误使用稳定错误码，不把内部异常直接暴露给客户端。
- 新功能必须包含对应测试；Bug 修复先补可复现测试。
- 涉及权限、金额、库存、状态流转的操作必须显式校验且可审计。
- 保持模块单向依赖，优先小而清晰的函数，不预建未被需求证明的抽象。

## 完成定义

- 功能、测试、文档同步完成。
- `pnpm check` 通过；涉及端到端流程时 `pnpm test:e2e` 通过。
- 新增环境变量已加入 `.env.example` 并写明用途。
- 新增公共 API 已更新 OpenAPI/共享契约。
- 架构取舍已记录到 `docs/decisions`。
- `docs/ai/CONTEXT.md` 只记录仍然有效的事实，不记录临时过程。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
```
