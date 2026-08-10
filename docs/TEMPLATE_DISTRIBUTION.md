# 模板分发方式

本项目分为三个层次：

1. Git 模板仓库：保存源码、迁移、文档和初始化脚本，是唯一事实来源。
2. `create-aiforge` npm CLI：负责获取模板并执行完整交互式初始化，不保存数据库或密钥。
3. 模板联调项目：单独保存真实 PostgreSQL、CNB、SSH 和服务配置，不提交到模板仓库。

## 使用 npm CLI

```bash
npm create aiforge@latest my-project
cd my-project
pnpm dev:local
```

CLI 会自动完成 Git 获取、首次依赖安装、交互式能力选择、工作区链接刷新和 Doctor 检查，并移除模板仓库历史后初始化一个新的 Git 仓库。用户不需要再运行 `template:init`。

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

模板源码通过 Git Tag 发布，npm 包只作为初始化入口。真实环境配置只能放在联调项目或部署平台的加密配置中。
