# 模板使用方式

第一次使用请按照 [AI 项目模板分步使用手册](./GETTING_STARTED.md) 操作。本页主要说明模板机制和高级命令。

## 默认语言

模板所有状态、结果和用户可见错误默认使用简体中文展示，API 和数据库仍保留稳定英文代码。初始化向导会让使用者确认默认语言；当前版本仅开放 `zh-CN`，未来增加多语言时必须由使用者显式选择默认语言和支持语言，AI 不得自行推断。

## 从 Git 创建项目

```bash
git clone --depth 1 https://cnb.cool/nsmiling.com/ai-template my-project
cd my-project
pnpm install
pnpm template:init
pnpm install
pnpm template:doctor
pnpm dev:local
```

初始化会将内部包从 `@template/*` 改为项目自己的命名空间，因此初始化后第二次 `pnpm install` 用于刷新 workspace 链接，通常只需数秒且不会重复下载依赖。

初始化向导依次收集项目名称、包命名空间、端口、数据库模式、管理员信息、是否启用用户端与可选基础设施能力，并将工作区中的 `@template/*` 包引用替换为新命名空间。交互式 quick、standard、custom 三种模式都显式询问是否启用用户端；只有 `--defaults` 自动化模式不提问。第一版真实支持内存预览或 PostgreSQL + Prisma；MySQL 等数据库须在完成适配后再开放选择。

PostgreSQL 按主机、端口、库名、用户名和密码分项收集并生成 `DATABASE_URL`。初始化最后可选择立即刷新 workspace、校验连接、执行迁移和创建管理员。初始化阶段填写的服务秘密通过 Git 忽略的一次性文件交给种子程序，以 `CONFIG_ENCRYPTION_KEY` 加密写入数据库，成功后删除；项目声明、AI 文档、终端摘要和后台响应均不包含密钥值。

管理员初始密码由初始化器随机生成，只写入 `.env` 的 `DEV_ADMIN_PASSWORD`，不会在命令行回显或进入项目声明。首次登录后应立即修改。

初始化模式：

- `quick`：内存预览、对象存储配置能力，适合立即查看模板。
- `standard`：PostgreSQL + Prisma，并声明 Redis、对象存储和邮件能力。
- `custom`：逐项选择已实现的基础能力。

也可以跳过模式提问：`pnpm template:init -- --preset=standard`。选择能力只生成项目声明和运行配置，不会自动连接数据库或执行迁移。

用户端选择是所有模式都会询问的独立问题。启用时会同时启用 `userWeb`、`customerAuthentication`、用户端权限和后台用户端用户管理；停用时 Web 不进入默认开发、检查、测试与构建，相关 API、菜单和权限目录也不生效。

PostgreSQL 项目先预览数据库操作，再明确执行：

```bash
pnpm template:provision -- --dry-run
pnpm template:provision
```

部署命令要求输入 `YES`，随后生成 Prisma Client、以 `prisma migrate deploy` 部署仓库已有迁移并创建初始管理员。它不会显示 `.env` 中的连接串。自动化环境可在确认目标数据库安全后使用 `--yes`。

## 配置文件职责

- `project.config.json`：可提交 Git，记录能力、技术选型和服务商，不包含密钥。
- `.env`：仅保存在本机或部署环境，包含数据库密码、JWT 密钥和初始管理员密码。
- `.env.example`：环境变量名称与示例，不包含真实密钥。
- `AGENTS.md` 与 `docs/ai/CONTEXT.md`：AI 开发入口和当前有效事实。
- `docs/ai/PROJECT.md`：根据项目声明自动生成的项目专属 AI 记忆，禁止包含密钥。

重新执行 `pnpm template:init` 会先备份现有 `.env`。只预览默认结果可运行：

```bash
pnpm template:init -- --defaults --dry-run
```

`pnpm template:doctor` 只读检查文件，不修改配置、不连接外部服务。

手工调整 `project.config.json` 后运行 `pnpm template:sync`，只重新生成 `docs/ai/PROJECT.md`，不会覆盖 `.env` 或连接外部服务。

发布模板前运行 `pnpm template:verify`。它会在系统临时目录创建不包含 Git 历史、依赖、构建产物和本地密钥的副本，执行真实 quick 初始化与 Doctor，并检查项目声明和 AI 记忆中不存在敏感字段；完成后自动清理临时目录。调试失败现场时可追加 `--keep`。

冻结版本前还应执行 `pnpm template:verify -- --full`。完整模式会在干净副本中启用用户端能力，安装锁定依赖、刷新命名空间链接、生成 Prisma Client，并执行 Admin、API、Web 和共享契约的格式、Lint、类型、测试与生产构建；它不会连接业务数据库。完整的人工流程见 `docs/MANUAL_ACCEPTANCE.md`。
