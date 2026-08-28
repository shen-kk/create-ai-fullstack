# 项目交接

> 新接手的 AI 先读根目录 `AGENTS.md`、`docs/ai/PROJECT.md` 和本文件，再按任务读取 API、Admin 或 Web 规范。不要依赖聊天记录。

## 当前产品

- GitHub：`https://github.com/shen-kk/create-ai-fullstack`
- npm：`create-aiforge`
- 当前冻结版本：`0.2.4`
- 用户命令：`npm create aiforge@latest my-project`
- 应用：Vue Admin、NestJS API、初始化时可选的 Nuxt Web。
- 数据：运行时固定 PostgreSQL + Prisma，不允许内存模式或假数据回退。

## 当前能力

- Admin 手机号登录、刷新会话、个人资料、密码修改和登录设备管理。
- 管理员、角色、菜单/操作权限和审计日志。
- 可选 Web 首次验证码登录自动创建账号、密码登录、找回密码、个人中心、头像和设备会话。
- 对象存储、Redis、短信、邮件和支付配置；敏感字段加密且不回显。
- 可视化业务功能组合、统一 `pnpm run setup`、数据库迁移和初始管理员种子。
- 分端 AI 规范、UI 一致性检查、Template Doctor 和干净副本验证。
- 可选部署中心：平台托管通用部署项目、Git/服务器/服务资源环境绑定、独立 Deploy Worker、SSE 进度、持久化日志、发布版本与应用回滚。

## 新项目流程

```bash
npm create aiforge@latest my-project
cd my-project
pnpm run setup
pnpm dev
```

CLI 只询问是否启用用户端，不收集数据库或服务密钥。头像随用户端启用，部署中心与对象存储资源库始终保留。CLI 只从官方 GitHub 仓库获取模板；失败时报告仓库、ref 与 Git 错误，不回退到其他镜像。随后完成应用级裁剪、依赖安装、功能检查、模板 Git 历史移除和新 Git 仓库初始化。模板维护者拉取完整仓库后也使用同一个 `pnpm run setup`，不维护专用环境文件。pnpm 11 已有同名内置 `setup` 命令，文档和 CLI 提示不得省略 `run`。

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

## 已验证

- 真实 PostgreSQL migration 成功。
- Contracts、API、Admin 类型检查通过。
- `pnpm ui:check` 通过。
- API 测试覆盖身份会话、权限、租约、快照、日志脱敏、资源门禁、命令 quoting 和部署项目 DTO 校验。
- 模板脚本测试与全新目录组合验证通过。
- 完整 `pnpm check` 覆盖格式、UI 检查、Lint、类型、测试及 Admin/API/Web 生产构建。

正式 Git、SSH、资源门禁、三端构建、数据库迁移、原子切换、PM2 目标 release 启动、健康检查和历史 release 回滚均已验收。真实凭据只在后台或私有环境文件填写，不能进入 Git、日志、截图或文档。

## 完成定义

- `pnpm ui:check`
- `pnpm check`
- 涉及 API 关键流程时执行 `pnpm test:e2e`
- 涉及初始化时执行 `pnpm template:verify`
- 涉及部署时完成真实 Git/SSH/构建/健康检查/回滚验收
- 文档、项目声明、生成文件和代码保持一致
