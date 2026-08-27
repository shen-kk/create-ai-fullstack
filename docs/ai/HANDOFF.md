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

## 2026-08-28 正式部署联调进度

- 正式环境 ID：`cmtad1e1q000ef0abwmj62db1`；部署路径：`/www/wwwroot/aiforge`；代码源为 CNB `nsmiling.com/ai-template` 的 `main`。GitHub 与 CNB 已同步到资源保护提交 `ec57890`。
- 正式机只有约 1.7 GiB 内存。首次完整构建导致整机和 PostgreSQL 暂时失联；重启后已新增 `/www/deploy-build.swap` 2 GiB，并写入 `/etc/fstab`，当前总 Swap 为 3 GiB。项目本地私有 `.env` 使用 `DEPLOY_BUILD_MAX_OLD_SPACE_MB=640`、`DEPLOY_MIN_AVAILABLE_MEMORY_MB=1536`，不得把该私有文件提交。
- 资源保护后的任务 `cmtbq7vpi001zf0ujnxftzhfs` 已成功完成资源门禁、依赖安装、Prisma Client、Admin/API/Web 构建、数据库迁移、原子切换和 PM2 重载，服务器没有再次失联。
- 该任务最终在 API 健康检查失败并自动回退。直接原因是正式部署环境只保存了 Git、SSH 和数据库密钥，没有生产启动必需的五项密钥：`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`CUSTOMER_JWT_ACCESS_SECRET`、`CUSTOMER_JWT_REFRESH_SECRET`、`CONFIG_ENCRYPTION_KEY`。API 日志明确报 `JWT_ACCESS_SECRET must contain at least 32 characters in production`。
- 同时发现 Nitro 不读取 `WEB_PORT`，导致 Web 默认监听 3000。本次运行参数修复已在 `ecosystem.config.cjs` 把 Web 的 `WEB_PORT` 映射为 `PORT`，并在 AIForge 内置部署项目中声明上述五项必填秘密变量。
- 失败环境此前没有成功 release，因此自动恢复后删除了 `current` 符号链接。PM2 中 `aiforge-api`、`aiforge-web` 仍可能以失败 release 的真实目录运行；API 实际未监听 3001，Web 可能监听 3000。服务器上的其他既有 PM2 应用未被部署中心修改。
- 临时 Deploy Worker 已停止。继续前先提交并同步当前运行参数修复，然后通过部署环境更新接口补齐五项生产密钥；不得把明文写入 Git 或交接文档。再启动构建后的 Worker，新建完整三端部署并验证 3001 ready、Web 3002、`current`、PM2 cwd 和发布记录。

## 已验证

- 真实 PostgreSQL migration 成功。
- Contracts、API、Admin 类型检查通过。
- `pnpm ui:check` 通过。
- API 22 个测试文件、65 项测试通过；包含租约、快照、日志脱敏、资源门禁、命令 quoting 和部署项目 DTO 校验。
- 模板脚本 13 项测试通过。
- 资源保护提交执行过完整 `pnpm check`，格式、UI 检查、Lint、类型、测试及 Admin/API/Web 生产构建全部通过。

最终仍需补齐现有正式环境的五项生产密钥，完成一次健康检查成功的三端发布，再验证历史 release 回滚。真实凭据只在后台或私有环境文件填写，不能进入 Git、日志、截图或文档。联调完成前不要发布 npm 新版本。

## 完成定义

- `pnpm ui:check`
- `pnpm check`
- 涉及 API 关键流程时执行 `pnpm test:e2e`
- 涉及初始化时执行 `pnpm template:verify`
- 涉及部署时完成真实 Git/SSH/构建/健康检查/回滚验收
- 文档、项目声明、生成文件和代码保持一致
