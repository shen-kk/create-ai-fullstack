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
- 可视化业务功能组合、统一 `pnpm setup`、数据库迁移和初始管理员种子。
- 分端 AI 规范、UI 一致性检查、Template Doctor 和干净副本验证。
- 可选部署中心：平台托管通用部署项目、Git/服务器/服务资源环境绑定、独立 Deploy Worker、SSE 进度、持久化日志、发布版本与应用回滚。

## 新项目流程

```bash
npm create aiforge@latest my-project
cd my-project
pnpm setup
pnpm dev
cd my-project
pnpm dev:local
```

CLI 只选择业务功能并组合代码，不收集数据库或服务密钥。它完成模板获取、应用级裁剪、依赖安装、功能检查、模板 Git 历史移除和新 Git 仓库初始化。模板维护者拉取完整仓库后也使用同一个 `pnpm setup`，不维护专用环境文件。

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

- 数据模型：部署项目、环境、任务执行快照、步骤、日志、不可变 release；通用项目迁移为 `20260818000100_deployment_projects`。
- 部署规则由数据库托管，不要求业务仓库提交 `aiforge.deploy.yml`；AIForge 三端仅为内置预设，其他 Docker Compose 项目可在后台定义动态单元和变量。
- Git 支持公开仓库、HTTPS Token 和 SSH Key；服务器支持 SSH 密码和私钥。
- 环境检查覆盖 Git ref、SSH 登录、Git、curl、Node.js、pnpm、PM2、磁盘和可写部署目录。Git 与服务器均通过才可部署。
- 独立 Worker 进程从 PostgreSQL 领取任务，在目标服务器拉取代码、组合环境/资源/加密变量、写入权限为 `600` 的 `.env`，再按不可变快照构建、迁移、启动和健康检查。API HTTP 进程不执行部署任务。Worker 使用数据库租约、执行心跳和在线门禁，支持取消、失效任务恢复、敏感日志脱敏和稳定失败分类。
- 发布命令会先加载 release 自身的 `.env`；锁定依赖安装后显式生成 Prisma Client。前端构建使用 Rollup WASM，兼容正式机较旧的 glibc。
- 远端拉取前执行可用内存与 Swap 门禁。安装、Prisma Client 生成和构建使用低进程优先级及受限 Node 堆；迁移、PM2 重载和最终应用进程不继承构建限制。
- Admin 提供环境列表、独立配置页、部署详情、步骤进度、SSE 实时终端、取消和历史版本回滚确认。
- 回滚只回滚应用 release，不自动回滚数据库。
- 生产 Compose 不创建本地 PostgreSQL，要求通过运行环境提供真实 `DATABASE_URL`，并包含 Admin/API/Web 三个独立服务。
- 详细领域边界：`docs/domain/DEPLOYMENTS.md`；架构决策：ADR-0010、ADR-0011。

## 2026-08-28 正式部署联调结果

- 正式环境 ID：`cmtad1e1q000ef0abwmj62db1`；部署路径：`/www/wwwroot/aiforge`；代码源为 CNB `nsmiling.com/ai-template` 的 `main`。GitHub 与 CNB 已同步到 PM2 release 路径修复提交 `58b8921`。
- 正式机只有约 1.7 GiB 内存。首次完整构建导致整机和 PostgreSQL 暂时失联；重启后已新增 `/www/deploy-build.swap` 2 GiB，并写入 `/etc/fstab`，当前总 Swap 为 3 GiB。项目本地私有 `.env` 使用 `DEPLOY_BUILD_MAX_OLD_SPACE_MB=640`、`DEPLOY_MIN_AVAILABLE_MEMORY_MB=1536`，不得把该私有文件提交。
- 资源保护后的任务 `cmtbq7vpi001zf0ujnxftzhfs` 已成功完成资源门禁、依赖安装、Prisma Client、Admin/API/Web 构建、数据库迁移、原子切换和 PM2 重载，服务器没有再次失联。
- 该任务最终在 API 健康检查失败并自动回退。直接原因是正式部署环境只保存了 Git、SSH 和数据库密钥，没有生产启动必需的五项密钥。五项密钥已通过部署环境接口生成并加密保存，明文未进入 Git 或文档；内置部署项目也已声明这些必填变量。
- Nitro 端口映射已修复，Web 正式监听 3002。联调进一步发现 `pm2 startOrReload` 会保留旧 release 的 cwd 和脚本绝对路径；内置预设现改为只删除自身管理的 `aiforge-api` / `aiforge-web`，再从目标 release 启动，绝不影响服务器上的其他 PM2 应用。
- 提交 `58b8921` 已完成两次成功三端发布。正式环境随后从 `20260828132454-h9lbdk` 成功回滚到 `20260828131859-178wmf`；回滚任务状态为 `rolled_back`，`current`、API cwd 和 Web cwd 均一致指向目标 release，3001/3002 监听且 API ready 返回 ok。
- 临时本地 Deploy Worker 与 API 已停止。正式机的 `aiforge-api`、`aiforge-web` 继续由 PM2 运行；后续常驻 Worker 仍应在可信管理节点独立部署，不能加入其管理的业务部署单元。

## 已验证

- 真实 PostgreSQL migration 成功。
- Contracts、API、Admin 类型检查通过。
- `pnpm ui:check` 通过。
- API 22 个测试文件、65 项测试通过；包含租约、快照、日志脱敏、资源门禁、命令 quoting 和部署项目 DTO 校验。
- 模板脚本 13 项测试通过。
- 资源保护提交执行过完整 `pnpm check`，格式、UI 检查、Lint、类型、测试及 Admin/API/Web 生产构建全部通过。

正式 Git、SSH、资源门禁、三端构建、数据库迁移、原子切换、PM2 目标 release 启动、健康检查和历史 release 回滚均已验收。真实凭据只在后台或私有环境文件填写，不能进入 Git、日志、截图或文档。npm 新版本仍需按发布 0.2 的组合矩阵完成后再发布。

## 完成定义

- `pnpm ui:check`
- `pnpm check`
- 涉及 API 关键流程时执行 `pnpm test:e2e`
- 涉及初始化时执行 `pnpm template:verify`
- 涉及部署时完成真实 Git/SSH/构建/健康检查/回滚验收
- 文档、项目声明、生成文件和代码保持一致
