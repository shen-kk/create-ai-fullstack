# 模板分发方式

本项目分为三个层次：

1. Git 模板仓库：保存源码、迁移、文档和初始化脚本，是唯一事实来源。
2. `create-aiforge` npm CLI：负责询问是否启用用户端、获取模板并组合代码，不收集数据库或密钥。
3. 模板联调项目：单独保存真实 PostgreSQL 和第三方服务配置，不提交到模板仓库。

## 使用 npm CLI

```bash
npm create aiforge@latest my-project
cd my-project
pnpm dev:local
```

CLI 会自动完成用户端选择、GitHub 获取（失败时回退 CNB 镜像）、代码组合、依赖安装、功能一致性检查，并移除模板仓库历史后初始化新的 Git 仓库。用户随后统一运行 `pnpm run setup` 配置 PostgreSQL、项目密钥和管理员；不能省略 `run`，否则 pnpm 11 会执行自己的同名命令。

也可以固定模板版本：

```bash
npm create aiforge@0.1.0 my-project -- --ref=v0.1.0
```

## 发布 CLI

在 `packages/create-ai-fullstack` 中更新版本后（npm 包名为 `create-aiforge`）：

```bash
pnpm --filter create-aiforge pack
pnpm --filter create-aiforge publish
```

模板源码通过 Git Tag 发布，npm 包只包含创建器与同版本功能目录。模板维护者拉取完整源码后也运行 `pnpm run setup`，与 CLI 项目共用初始化逻辑。真实环境配置只能放在 Git 忽略的 `.env`、后台加密资源或部署平台密钥中。
