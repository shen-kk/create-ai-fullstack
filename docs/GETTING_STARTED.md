# AI 项目模板分步使用手册

本手册适合第一次使用模板的开发者。业务项目通过 npm CLI 创建，不需要手动克隆模板仓库或执行初始化脚本。

## 第一步：准备环境

需要安装 Git、Node.js 22+ 和 pnpm 11.9.0。当前模板运行 API 时必须提供可访问的 PostgreSQL。

```bash
git --version
node --version
pnpm --version
```

没有 pnpm 时执行：

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

## 第二步：创建全新项目

将 `my-project` 换成你的项目英文名：

```bash
npm create aiforge@latest my-project
cd my-project
```

创建命令会自动获取模板、安装依赖、进入交互式配置、刷新工作区链接、执行 Doctor，并初始化一个不包含模板历史的新 Git 仓库。

## 第三步：选择初始化模式

创建命令默认选中 `custom` 自定义模式；直接回车即可逐项选择真实数据库、用户端和服务能力。

只想立即查看后台和用户端，选择快速模式：

```bash
npm create aiforge@latest my-project -- --preset=quick
```

准备开发正式 PostgreSQL 项目，选择标准模式：

```bash
npm create aiforge@latest my-project -- --preset=standard
```

需要逐项选择用户端、Redis、短信、邮件和支付等能力，选择自定义模式：

```bash
npm create aiforge@latest my-project -- --preset=custom
```

### 三种模式分别会询问什么

| 选择项                       | quick 快速模式           | standard 标准模式        | custom 自定义模式          |
| ---------------------------- | ------------------------ | ------------------------ | -------------------------- |
| 项目名称、命名空间、中文名称 | 目录名即项目名，其他必问 | 目录名即项目名，其他必问 | 目录名即项目名，其他必问   |
| 后台和 API 端口              | 必问                     | 必问                     | 必问                       |
| 用户端端口                   | 默认 3002                | 默认 3002                | 必问                       |
| 是否启用用户端               | **必问**                 | **必问**                 | **必问**                   |
| 数据库                       | 固定 PostgreSQL          | 固定 PostgreSQL          | 固定 PostgreSQL            |
| PostgreSQL 连接信息          | 分项必问                 | 分项必问                 | 分项必问                   |
| 对象存储能力                 | 默认启用                 | 默认启用                 | 可选                       |
| Redis 能力                   | 用户端启用时启用         | 默认启用                 | 可选，用户端启用时自动启用 |
| 短信能力                     | 用户端启用时启用         | 用户端启用时启用         | 可选，用户端启用时自动启用 |
| 邮件能力                     | 不启用                   | 默认启用                 | 可选                       |
| 支付能力                     | 不启用                   | 不启用                   | 可选                       |
| 填写已启用服务的真实配置     | 分项询问                 | 分项询问                 | 分项询问                   |
| 立即迁移并创建管理员         | 默认是，可选否           | 默认是，可选否           | 默认是，可选否             |

三种交互模式都会明确询问“是否启用用户端”，并输出最终选择。只有自动化使用 `--defaults` 时才不提问；自动化模式需要用户端时必须追加 `--user-web`。

完整向导会依次询问：

1. 包命名空间，例如 `@customer-center`（项目英文名使用命令中的目录名）。
2. 中文显示名称和项目简介。
3. 后台、API、用户端端口。
4. PostgreSQL 主机、端口、数据库名、用户名和密码。
5. 初始管理员手机号和名称。
6. 是否启用用户端。
7. 对象存储平台和其他可选服务能力。
8. 是否立即填写 Redis、对象存储、短信、邮件或支付配置。
9. 是否立即校验数据库、执行迁移并创建管理员。
10. 是否立即校验并初始化数据库。

模式说明：

- `quick`：内存数据，零外部依赖，适合查看功能；API 重启后数据恢复初始状态，禁止用于生产。
- `standard`：PostgreSQL + Prisma，并声明 Redis、对象存储和邮件能力。
- `custom`：只启用实际需要的能力。

选择“启用用户端”后，才会启用注册、登录、个人中心、用户端 API，以及后台的用户端用户管理。当前默认语言为简体中文；以后支持多语言时必须由使用者显式选择。

### 配置与密钥保存位置

- 能力和服务商名称写入 `project.config.json`，这里永远没有密码。
- 数据库连接串和项目加密密钥写入 Git 忽略的 `.env`。
- 外部服务密钥先写入 Git 忽略的 `.template-bootstrap.json`。
- 数据库初始化成功后，服务配置使用 AES-256-GCM 加密写入 `IntegrationConfig`，然后删除一次性文件。
- 后台接口只返回已配置字段名，不回显秘密值。

如果数据库或 Redis 校验失败，一次性文件会保留，以便修正后重试 `pnpm template:provision`。它不会进入 Git，但仍应像密码文件一样保护。

## 第四步：完成初始化检查

初始化会创建：

- `project.config.json`：可提交的项目能力声明，不含密钥。
- `.env`：本机密码、密钥、端口和数据库地址，禁止提交。
- `docs/ai/PROJECT.md`：AI 可读取的项目专属说明。
- 三端生成配置：控制启用的应用、功能、菜单和命令。

正式模式最后选择“立即初始化”时，向导会自动刷新依赖、校验 PostgreSQL（以及已填写的 Redis）、执行迁移并创建管理员。成功后只需运行 `pnpm template:doctor`。

如果选择暂不初始化，或者使用快速模式，初始化会把工作区包名从 `@template/*` 改成你的命名空间，所以需要手动再次安装：

```bash
pnpm install --frozen-lockfile
pnpm template:doctor
```

`template:doctor` 应全部通过。手工修改 `project.config.json` 后执行：

```bash
pnpm template:sync
pnpm template:doctor
```

## 第五步：查看管理员账号

打开根目录 `.env`，找到：

```dotenv
DEV_ADMIN_PHONE=初始化时填写的手机号
DEV_ADMIN_PASSWORD=系统随机生成的密码
```

随机密码只保存在 `.env`，不会在终端回显。首次登录后台后，应立即在个人中心修改密码。

登录页不会预填任何演示密码。请复制等号右侧的完整值，不要使用旧模板曾经展示的 `Admin@123456`；每个新项目的随机密码都不同。

## 第六步：启动快速预览项目

```bash
pnpm dev:local
```

默认地址如下，实际以初始化时选择的端口为准：

- 后台：`http://localhost:3000`
- API：`http://localhost:3001/api`
- 用户端：`http://localhost:3002`（仅启用后存在）
- API 存活检查：`http://localhost:3001/api/health/live`

必须保持命令终端开启。不要双击 `apps/admin/index.html`，开发页面必须通过本地服务访问。

出现 `ERR_CONNECTION_REFUSED` 时：

1. 确认运行命令的终端没有关闭。
2. 查看终端是否提示端口占用或编译失败。
3. 确认浏览器端口与初始化配置一致。
4. 重新运行 `pnpm dev:local`。

## 第七步：初始化 PostgreSQL

如果初始化时已经选择“立即初始化”并成功，则不需要重复执行。否则先确认 `.env` 的 `DATABASE_URL` 指向当前项目专用数据库，禁止误连生产库或其他项目数据库。

先预览操作：

```bash
pnpm template:provision -- --dry-run
```

确认后执行：

```bash
pnpm template:provision
```

按提示输入 `YES`。该命令会验证连接、生成 Prisma Client、部署已有迁移、创建初始管理员，并把一次性服务配置加密入库；全部成功后删除一次性文件。完成后：

```bash
pnpm dev:local
```

访问 `http://localhost:3001/api/health/ready` 检查数据库就绪状态。

## 第八步：测试后台真实功能

建议依次执行：

1. 使用 `.env` 中的管理员手机号和密码登录。
2. 在个人中心修改资料、头像和密码。
3. 创建角色并分配菜单权限与按钮权限。
4. 通过手机号创建新管理员并绑定角色。
5. 使用新管理员登录，确认只能看到和操作获授权功能。
6. 查看审计日志，确认登录、创建、修改、停用都有记录。
7. 在服务配置中填写项目实际需要的对象存储、短信、邮件等配置。
8. 确认保存后不会回显密钥明文。

新增后台功能时，必须同时完成：

1. 在共享契约定义权限代码。
2. API 增加权限校验、输入校验和审计。
3. 后台菜单、路由、按钮使用同一权限代码。
4. 在角色页面分配新权限。
5. 增加允许和拒绝场景测试。

## 第九步：测试用户端

仅在初始化时启用用户端后执行：

1. 使用手机号注册。
2. 测试密码登录、验证码登录和找回密码。
3. 刷新页面，确认会话可以恢复。
4. 在个人中心修改资料、绑定邮箱、修改密码和管理设备。
5. 上传头像；对象存储未配置时应显示中文提示。
6. 在后台“用户端用户”中找到刚注册的用户。
7. 后台停用该用户，确认其已有 Token 不再有效。

短信、邮件、对象存储等用户端能力统一由后台“服务配置”管理，用户端不保存服务密钥。

### 腾讯云 COS 头像上传

在后台服务配置中选择“对象存储 → 腾讯云 COS”，填写真实 `SecretId`、`SecretKey`、`Bucket`、`Region` 和项目需要的访问域名。保存后再上传 JPG、PNG 或 WebP 头像。不要把真实密钥写进仓库、`.env.example`、文档或聊天记录。

## 第十步：建立自己的 Git 仓库

新项目不能继续向模板仓库推送业务代码。确认初始化正常后执行：

```bash
git remote remove origin
git add .
git commit -m "chore: initialize project from AI template"
```

在代码托管平台创建新仓库后：

```bash
git remote add origin 你的新仓库地址
git push -u origin main
```

提交前运行 `git status`，确认没有 `.env`、日志、数据库导出、`node_modules` 或构建产物。

## 第十一步：让 AI 按模板规范开发

每次开启新的 AI 任务时，让 AI 先读取：

1. `AGENTS.md`
2. `docs/ai/CONTEXT.md`
3. `docs/ai/PROJECT.md`
4. 与当前需求有关的架构、领域和 ADR 文档

推荐任务开场：

```text
请先阅读 AGENTS.md、docs/ai/CONTEXT.md 和 docs/ai/PROJECT.md，
再搜索现有实现。严格按照契约 → API → 客户端 → 测试 → 文档的顺序开发，
不要绕过权限、审计、输入校验和项目能力开关。
```

聊天记录不是项目记忆。长期有效事实应写入 `docs/ai/CONTEXT.md`；能力和选型应更新 `project.config.json`，然后运行 `pnpm template:sync`。

## 第十二步：每次开发完成后检查

```bash
pnpm check
pnpm test:e2e
pnpm template:doctor
git status
```

提交前确认：

- 所有检查通过。
- 新公共 API 已同步共享契约。
- 新权限已加入角色配置并有测试。
- 新环境变量已写入 `.env.example`，但没有真实值。
- 架构选择已记录到 `docs/decisions`。
- `.env` 和其他敏感文件没有进入 Git。

## 常用命令

```bash
pnpm dev:local       # 启动所有已启用应用
pnpm dev:admin       # 只启动后台
pnpm dev:api         # 只启动 API
pnpm dev:web         # 只启动用户端
pnpm template:sync   # 同步项目声明和生成文档
pnpm template:doctor # 只读检查模板配置
pnpm db:migrate      # 执行开发数据库迁移
pnpm db:seed         # 写入种子数据
pnpm check           # 格式、Lint、类型、测试和构建
pnpm test:e2e        # API 端到端测试
```

## 上线前检查

- 用真实 PostgreSQL 验证迁移、持久化、备份和恢复。
- 用真实 COS、短信和 SMTP 验证上传与发送。
- 为生产环境重新生成 JWT 和配置加密密钥。
- 修改初始管理员密码。
- 配置 HTTPS、反向代理、允许域名、Cookie 和跨域策略。
- 在 CI 中执行 `pnpm check` 和 `pnpm test:e2e`。

完整人工验收项目见 [MANUAL_ACCEPTANCE.md](./MANUAL_ACCEPTANCE.md)。
