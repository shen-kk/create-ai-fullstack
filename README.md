# AI-Friendly Full-Stack Template

从 Git 模板创建新项目后，执行 `pnpm template:init` 完成交互式初始化，再运行 `pnpm template:doctor` 检查配置。完整说明见 [`docs/TEMPLATE_USAGE.md`](docs/TEMPLATE_USAGE.md)。

面向 AI 协作开发的后台管理端与服务端 Monorepo 模板。`apps/web` 用户端仅保留下一版本骨架，不参与当前版本冻结验收。

## 技术栈

- Admin：Vue 3、Vite、Vue Router、自有轻量设计系统
- Web：Nuxt 4 骨架（下一版本）
- API：NestJS、Prisma、PostgreSQL、Swagger
- Workspace：pnpm、Turborepo、TypeScript、ESLint、Vitest

## 快速开始

```bash
pnpm install
pnpm template:init
pnpm install
pnpm template:doctor
pnpm dev:local
```

初始化后的第二次安装用于刷新自定义包命名空间的 workspace 链接，不会重复下载依赖。PostgreSQL 项目按初始化提示先执行 `pnpm template:provision -- --dry-run`，确认目标数据库后再正式部署迁移与种子。

Windows 本地开发推荐直接双击根目录的 `dev-local.cmd`。它会先检查 3000/3001 端口：属于当前模板的旧服务会被安全替换，属于其他程序的占用会中止启动并报告 PID；随后在两个独立终端中启动 Admin 和 API，等待健康检查通过后再打开后台页面。请保持两个服务终端开启；关闭终端即停止对应服务。

默认地址：后台 `http://127.0.0.1:3000`，API `http://127.0.0.1:3001/api`，接口文档 `http://127.0.0.1:3001/docs`。用户端下一版本恢复后使用 `pnpm dev:web` 单独启动。

> `apps/admin/index.html` 是 Vite 编译入口，不能通过双击文件运行。只启动后台可执行 `pnpm --filter @template/admin dev`，然后访问 `http://localhost:3000`。

## AI 如何理解项目

AI 应依次读取：

1. 根目录 `AGENTS.md`
2. `docs/ai/CONTEXT.md`
3. 目标目录最近的 `AGENTS.md`
4. 上下文索引指向的领域、架构或决策文档

聊天记录不是项目记忆。长期有效的信息必须写入仓库；详见 `docs/ai/README.md`。

## 新功能流程

从 `docs/ai/TASK_TEMPLATE.md` 复制任务说明，明确验收标准与影响范围，然后按“契约 → API → 客户端 → 测试 → 文档”实现。

当前冻结版本包含 Admin、API、共享契约、初始化 CLI、测试和 AI 项目记忆；用户端在下一版本实现。功能边界与验收记录见 `docs/ROADMAP.md`，可分发 Skill 位于 `skills/create-admin-project`。
