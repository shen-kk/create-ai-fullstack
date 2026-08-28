# AI-Friendly Full-Stack Template

> 第一次创建项目请按照 [中文分步使用手册](docs/GETTING_STARTED.md)，从环境准备、交互选择、启动一路操作到验收。

最终使用者先通过 `npm create aiforge@latest my-project` 选择是否启用用户端，再运行 `pnpm run setup` 配置数据库和开发环境。头像随用户端自动启用；部署中心与对象存储资源库属于基础能力，始终保留。邮件、短信、Redis 及具体服务商不在 CLI 中选择，由用户端依赖自动保留并在后台按需绑定。

面向 AI 协作开发的后台管理端、用户端与服务端 Monorepo 模板。后台管理员和用户端账号使用独立身份边界，模板不预置行业业务。

## 技术栈

- Admin：Vue 3、Vite、Vue Router、自有轻量设计系统
- Web：Nuxt 4、SSR/SEO、自有响应式设计系统
- API：NestJS、Prisma、PostgreSQL、Swagger
- Workspace：pnpm、Turborepo、TypeScript、ESLint、Vitest

## 快速开始

```bash
npm create aiforge@latest my-project
cd my-project
pnpm run setup
pnpm dev:local
```

CLI 已完成依赖安装和工作区刷新。`pnpm run setup` 收集完配置后会直接生成本地 `.env`，随后可确认是否校验 PostgreSQL、执行迁移和创建管理员；需要放弃环境初始化时可在写入前按 `Ctrl+C`。不要省略 `run`：pnpm 11 的内置 `pnpm setup` 命令不会运行项目初始化脚本。

初始化向导会单独询问是否启用用户端。选择启用后，Web、独立用户身份 API、用户端权限以及后台“用户端用户”管理会一起生效；选择停用时这些运行时能力和菜单不会出现，Web 也不会进入默认开发、检查与构建任务。

Windows 本地开发推荐直接双击根目录的 `dev-local.cmd`。它会先检查 3000/3001/3002 端口：属于当前模板的旧服务会被安全替换，属于其他程序的占用会中止启动并报告 PID；随后分别启动 Admin、API 和 Web，等待健康检查通过后再打开后台页面。请保持服务终端开启；关闭终端即停止对应服务。

默认地址：后台 `http://127.0.0.1:3000`，API `http://127.0.0.1:3001/api`，用户端 `http://127.0.0.1:3002`，接口文档 `http://127.0.0.1:3001/docs`。也可以使用 `pnpm dev:web` 单独启动用户端。

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

模板包含 Admin、Web、API、共享契约、初始化 CLI、测试和 AI 项目记忆。功能边界见 `docs/ROADMAP.md`，人工验收见 `docs/MANUAL_ACCEPTANCE.md`。

## 推荐初始化方式

新项目统一使用 npm CLI：`npm create aiforge@latest my-project`，然后执行 `pnpm run setup`。模板维护者从 GitHub 拉取完整源码后也执行相同命令。完整分发说明见 [`docs/TEMPLATE_DISTRIBUTION.md`](docs/TEMPLATE_DISTRIBUTION.md)。
