# 项目交接

> 新接手的 AI 先读根目录 `AGENTS.md`、`docs/ai/PROJECT.md` 和本文件，再按任务读取 API、Admin 或 Web 规范。不要依赖聊天记录。

## 当前产品

- GitHub：`https://github.com/shen-kk/create-ai-fullstack`
- npm：`create-aiforge`
- 当前公开版本：`0.1.0`
- 用户命令：`npm create aiforge@latest my-project`
- 应用：Vue Admin、NestJS API、初始化时可选的 Nuxt Web。
- 数据：运行时固定 PostgreSQL + Prisma，不允许内存模式或假数据回退。

## 当前能力

- Admin 手机号登录、刷新会话、个人资料和密码修改。
- 管理员、角色、菜单/操作权限和审计日志。
- 可选 Web 注册、登录、找回密码、个人中心、头像和设备会话。
- 对象存储、Redis、短信、邮件和支付配置；敏感字段加密且不回显。
- quick、standard、custom 初始化模式、数据库迁移和初始管理员种子。
- 分端 AI 规范、UI 一致性检查、Template Doctor 和干净副本验证。
- 可选部署中心：通用 Git、Linux SSH、Docker Compose、SSE 进度、持久化日志、发布版本与应用回滚。

## 新项目流程

```bash
npm create aiforge@latest my-project
cd my-project
pnpm dev:local
```

CLI 内部完成模板获取、依赖安装、交互配置、workspace 刷新、Doctor、模板 Git 历史移除和新 Git 仓库初始化。用户不需要手动执行 `template:init`。

部署中心由初始化向导显式选择。未启用时不注册 API 模块、Admin 路由、菜单或部署权限。

## 开发入口

- 通用工程和新功能：`docs/standards`
- API：`docs/api`
- Admin：`docs/admin`
- Web：`docs/web`
- 领域事实：`docs/domain`
- 架构决策：`docs/decisions`
- 初始化与发布：`docs/TEMPLATE_USAGE.md`、`docs/TEMPLATE_DISTRIBUTION.md`

## 部署中心实现状态

- 数据模型：环境、任务、步骤、日志、不可变 release；迁移为 `20260811000100_add_deployment_orchestration`。
- 真实 PostgreSQL 已成功应用全部 14 个 migration。
- Git 支持公开仓库、HTTPS Token 和 SSH Key；服务器支持 SSH 密码和私钥。
- 环境检查覆盖 Git ref、SSH 登录、Git、Docker、Docker Compose、磁盘和可写部署目录。Git 与服务器均通过才可部署。
- Worker 从 PostgreSQL 领取任务，在目标服务器拉取代码、写入权限为 `600` 的 `.env`、构建所选服务、启动和健康检查。只有 API 部署会运行 Prisma migration。
- Admin 提供环境列表、独立配置页、部署详情、步骤进度、SSE 实时终端、取消和历史版本回滚确认。
- 回滚只回滚应用 release，不自动回滚数据库。
- 生产 Compose 不创建本地 PostgreSQL，要求通过运行环境提供真实 `DATABASE_URL`，并包含 Admin/API/Web 三个独立服务。
- 详细领域边界：`docs/domain/DEPLOYMENTS.md`；架构决策：`docs/decisions/0010-optional-deployment-orchestration.md`。

## 已验证

- 真实 PostgreSQL migration 成功。
- Contracts、API、Admin 类型检查通过。
- `pnpm ui:check` 通过。
- API 14 个测试文件、44 项单测通过。
- 模板脚本 13 项测试通过。

最终仍需项目所有者在后台新增一条真实部署环境，完成 Git、SSH、Docker 构建、健康检查和回滚的服务器联调。真实凭据只在后台或私有环境文件填写，不能进入 Git、日志、截图或文档。联调完成前不要发布 npm 新版本。

## 完成定义

- `pnpm ui:check`
- `pnpm check`
- 涉及 API 关键流程时执行 `pnpm test:e2e`
- 涉及初始化时执行 `pnpm template:verify`
- 涉及部署时完成真实 Git/SSH/构建/健康检查/回滚验收
- 文档、项目声明、生成文件和代码保持一致
