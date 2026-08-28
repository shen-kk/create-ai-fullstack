# 开始使用 AIForge

## 环境要求

- Node.js 22 或更高版本
- pnpm
- Git
- 可访问的 PostgreSQL

## 普通用户创建项目

```bash
npm create aiforge@latest my-project
cd my-project
pnpm run setup
pnpm dev
```

创建向导只询问是否启用用户端。用户端账号默认包含邮箱/手机号验证码和头像上传；部署中心、对象存储、Git 与服务器资源属于基础能力，始终保留。邮件、短信、Redis 及具体服务商不作为业务选项，它们由用户端依赖自动保留，项目运行后在后台服务配置中添加。

`pnpm run setup` 使用可视化终端向导收集。必须保留 `run`，避免调用 pnpm 11 的同名内置命令：

1. 当前项目包含的应用端口；
2. PostgreSQL 主机、端口、数据库、用户名和密码；
3. 验证码功能所需的可选开发 Redis；
4. 初始管理员手机号和姓名；
5. 是否立即执行迁移和管理员种子。

项目 JWT 和配置加密密钥自动生成，只写入 Git 忽略的 `.env`。初始管理员随机密码保存在 `.env` 的 `DEV_ADMIN_PASSWORD`，终端不回显完整值。

所有问题完成后，向导会直接备份已有 `.env`（如有）并写入新配置，不再显示重复的写入确认。需要取消时，请在写入前按 `Ctrl+C`。

## 模板维护者

```bash
git clone https://github.com/shen-kk/create-ai-fullstack.git
cd create-ai-fullstack
pnpm install
pnpm run setup
pnpm dev
```

模板仓库默认启用全部稳定功能。维护者与普通用户使用完全相同的 setup、迁移、Doctor 和启动流程。

## 后续命令

```bash
pnpm doctor          # 检查项目声明、生成文件和环境
pnpm feature:check   # 检查功能依赖、唯一归属和应用裁剪
pnpm run template:provision -- --dry-run
pnpm check
```

外部服务在后台“服务配置”中创建并测试。未绑定资源时相关功能必须显示可执行提示，不会默认使用第一条资源。
