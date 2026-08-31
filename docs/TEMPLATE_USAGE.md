# 模板使用与维护

## 两阶段流程

AIForge 明确区分代码组合与运行环境配置：

```text
create-aiforge  选择业务功能并生成代码
pnpm run setup  配置开发环境和初始化数据库
后台服务配置     添加邮件、短信、Redis、对象存储等资源
部署中心         配置生产部署资源与发布
```

## 功能选择

```bash
npm create aiforge@latest my-project
```

向导只询问是否启用用户端。启用后自动包含用户账号、验证码、头像和对应共享适配能力；部署中心、对象存储资源库、Git 和服务器资源始终保留。

自动化环境可以显式传入功能：

```bash
npm create aiforge@latest my-project -- --features=customerWeb
```

只生成核心后台：

```bash
npm create aiforge@latest my-project -- --features=
```

## 环境初始化

```bash
pnpm run setup
```

该命令只配置当前项目启用应用的端口、PostgreSQL、项目密钥和初始管理员。初始管理员密码使用隐藏输入并要求二次确认，首次初始化留空会随机生成，重新初始化已有项目时留空会保留原密码。完成问题后会直接写入 Git 忽略的 `.env`，不再额外询问一次是否写入；需要放弃初始化时，可在写入前按 `Ctrl+C` 取消。重新执行前会备份现有 `.env`，已有项目密钥默认保留。数据库密码和管理员密码不进入命令参数、项目声明或 AI 文档。

## 功能归属

新增可裁剪功能前必须：

1. 在功能目录登记 ID、显示名称和依赖；
2. 为独占文件声明唯一归属；
3. 将多消费者代码登记为共享能力；
4. 让 `modules` 从功能目录生成；
5. 增加关闭、单独启用和完整组合测试；
6. 运行 `pnpm run feature:check` 与 `pnpm run template:verify`。

详细规则见 `docs/architecture/FEATURE_COMPOSITION.md` 和 ADR-0013。

## 模板发布

模板源码只从官方 GitHub 仓库获取，不使用 CNB 或其他镜像回退，避免因镜像版本不同步生成错误的功能组合；npm 包只保存创建器和功能目录。发布前必须验证基础平台、基础平台 + 用户端两种组合，且不得包含 `.env`、数据库连接串、服务密钥、日志或构建产物。
