# 项目交接

> 新接手的 AI 先读根目录 `AGENTS.md`、`docs/ai/PROJECT.md` 和本文件，再按任务读取对应的 API、Admin 或 Web 规范。不要依赖聊天记录。

## 当前产品

- GitHub 主仓库：`https://github.com/shen-kk/create-ai-fullstack`
- npm 脚手架：`create-aiforge`
- 当前公开版本：`0.1.0`
- 最终用户命令：`npm create aiforge@latest my-project`
- 应用：Vue Admin、NestJS API，以及初始化时可选的 Nuxt Web。
- 数据：运行时固定 PostgreSQL + Prisma，不允许内存模式或假数据回退。

## 当前能力

- Admin 手机号登录、刷新会话、个人资料和密码修改。
- 管理员、角色、菜单/操作权限与审计日志。
- 可选的 Web 注册、登录、找回密码、个人中心、头像和设备会话。
- 对象存储、Redis、短信、邮件和支付配置；敏感字段加密且不回显。
- quick、standard、custom 初始化模式，以及数据库迁移和初始管理员种子。
- 分端 AI 规范、UI 一致性检查、模板 Doctor 与干净副本验证。

部署中心、CNB 构建和 Deploy Agent 已从模板产品中移除，不属于当前能力，也不应恢复为隐藏模块。

## 新项目流程

```bash
npm create aiforge@latest my-project
cd my-project
pnpm dev:local
```

CLI 内部完成模板获取、依赖安装、交互配置、workspace 刷新、Doctor、模板 Git 历史移除和新 Git 仓库初始化。最终用户不需要手动运行 `template:init`。

## 开发入口

- 通用工程和新功能：`docs/standards`
- API：`docs/api`
- Admin：`docs/admin`
- Web：`docs/web`
- 领域事实：`docs/domain`
- 架构决策：`docs/decisions`
- 初始化与发布：`docs/TEMPLATE_USAGE.md`、`docs/TEMPLATE_DISTRIBUTION.md`

## 当前已知优化项

- Admin 需要继续收口 AppButton、AppDialog、AppInput、AppFormField 等公共组件。
- Web 需要补齐 Select、Dialog、Input、Checkbox、FormField 等 shadcn-vue 基础组件。
- GitHub CI 必须保持绿色；不能用本地假数据或跳过检查代替。
- 发布下一 npm 版本前更新 `packages/create-ai-fullstack/package.json`（包名已是 `create-aiforge`），验证 pack 内容，再创建同版本 Git Tag。

## 2026-08-10 工作区状态

当前基于提交 `d921299 fix: normalize create-aiforge package metadata`，本轮改造已经完成但尚未提交或推送。不要丢弃工作区修改，也不要重新实现一遍。

本轮已经完成：

- 删除部署中心的 Admin 页面、API 模块、共享契约、Prisma 模型、Deploy Agent、CNB 配置及相关文档和样式。
- 新增 `20260810000100_remove_deployment_center` 迁移，用于安全删除已有部署表和权限数据；旧迁移保留为数据库历史。
- 删除 `DATA_SOURCE` 环境变量和所有运行时内存分支。管理员、用户、Refresh Session、验证码、服务配置均固定使用 PostgreSQL + Prisma。
- 删除验证码 `developmentCode` 回显。短信或邮件未配置时明确失败，任何环境都不伪造发送成功。
- 更新初始化、Provision、Doctor、系统信息、E2E 测试、AI 项目记忆和使用文档。
- 删除未使用的 `ssh2` 依赖并更新 `pnpm-lock.yaml`。

验证结果：

- `pnpm check` 完整通过：格式、UI 一致性、lint、三端类型检查、全部单元测试、Admin/API/Web 生产构建均成功。
- API 单元测试 13 个文件、42 个测试通过；模板脚本 13 个测试通过。
- 最终残留扫描未发现 `DATA_SOURCE`、`developmentCode` 或部署中心运行代码。
- Nuxt 构建会输出 Vue Router/Volar 的上游兼容警告，但客户端、SSR 和 Nitro 均成功产出，退出码为 0。
- `template:doctor` 的代码与同步项通过；当前模板开发工作区没有 `.env`，因此本地环境项按设计报告失败。不要为通过 Doctor 写入或提交真实连接信息。

明天建议按顺序执行：

1. 审查本轮删除清单与数据库 drop migration，确认部署中心不再属于产品范围。
2. 使用本地私有 `.env` 执行一次真实 PostgreSQL 迁移和关键登录流程；不要提交该文件。
3. 执行 `pnpm template:verify`，验证 `npm create aiforge` 的干净副本初始化流程。
4. 再运行一次 `pnpm check`，提交并推送 GitHub。
5. 决定是否发布 `create-aiforge@0.1.1`；如果发布，应让 CLI 默认获取与 npm 版本一致的 Git Tag，避免默认分支变化导致版本不可复现。

## 2026-08-11 继续验证

- 修复删除迁移：先删除部署权限关联和权限，再按 `DeploymentRun → DeployAgent → DeploymentTarget` 顺序删除旧表，最后删除部署枚举。
- 已在 `.env.template-dev` 指向的真实 PostgreSQL 成功应用全部 13 个迁移并完成幂等种子。
- 移除种子脚本中的固定管理员账号回退；`DEV_ADMIN_PHONE` 和 `DEV_ADMIN_PASSWORD` 现在必须显式提供，`.env.example` 不再包含可直接登录的默认密码。
- E2E 改为读取私有管理员凭据，并为用户端流程创建每次唯一的临时手机号/邮箱；结束后清理临时 Customer、Session 和验证码，SQL 服务配置在测试期间隔离并恢复。
- 真实 PostgreSQL 黑盒 E2E 共 4 项全部通过。
- `pnpm template:verify -- --full` 已在干净临时副本完整通过；期间发现并修复 `--defaults` 模式数据库密码为空的问题，自动验收现在使用随机临时密码且不会进入 Git。

最终 `pnpm check` 已再次通过。生产源码中残留的测试用 `Memory*Repository` 已删除，测试替身收进单元测试文件；CI 已去除废弃的 `E2E_DATA_SOURCE` 和旧演示密码，并直接运行 API E2E。当前仅剩审查差异、提交并推送；是否发布 npm `0.1.1` 由项目所有者决定。

## 完成定义

- `pnpm ui:check`
- `pnpm check`
- 涉及 API 关键流程时执行 `pnpm test:e2e`
- 涉及初始化时执行 `pnpm template:verify`
- 文档、项目声明、生成文件和代码保持一致
