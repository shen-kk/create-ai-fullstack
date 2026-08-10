# 模板分发方式

本项目分为三个层次：

1. Git 模板仓库：保存源码、迁移、文档和初始化脚本，是唯一事实来源。
2. `create-ai-fullstack` npm CLI：只负责按 Git Tag 获取模板并执行初始化，不保存数据库或密钥。
3. 模板联调项目：单独保存真实 PostgreSQL、CNB、SSH 和服务配置，不提交到模板仓库。

## 使用 npm CLI

```bash
pnpm create ai-fullstack my-project
cd my-project
pnpm template:doctor
```

也可以固定模板版本：

```bash
pnpm create ai-fullstack my-project --ref=v0.1.0
```

## 发布 CLI

在 `packages/create-ai-template` 中更新版本后（npm 包名为 `create-ai-fullstack`）：

```bash
pnpm --filter create-ai-fullstack pack
pnpm --filter create-ai-fullstack publish
```

模板源码通过 Git Tag 发布，npm 包只作为初始化入口。真实环境配置只能放在联调项目或部署平台的加密配置中。
