# AI 项目交接速读

更新时间：2026-08-07

> 新接手的 AI 先读本文件，再按任务读取链接文档。不要先遍历整个仓库，也不要依赖历史聊天记录。

## 1. 项目目标

这是一个可通过 Git 获取并交互式初始化的 AI 友好全栈模板。初始化时选择后台、用户端、数据库和基础设施能力；生成后的项目以 `project.config.json` 为能力事实来源，以 `docs/ai/PROJECT.md` 为 AI 可读声明。

模板只提供通用能力，不预置商城、订单、CMS 等行业业务。

## 2. 当前版本状态

- 当前分支：`main`
- 主仓库：`https://github.com/shen-kk/create-ai-fullstack`
- 最近功能提交：以 Git `main` 分支最新提交为准；部署中心基础功能提交为 `4c0a5a0`，服务端依赖修复为 `eaca631`。
- Admin、API、可选 Web、初始化 CLI、RBAC、审计、服务配置和用户体系已经落地。
- 默认界面语言为中文；API/数据库状态码保持稳定英文代码，由客户端映射中文。
- 当前工作区声明启用了 Web；新项目是否启用 Web 由初始化向导显式选择。
- 2026-08-06 的部署中心提交未执行最终全量验证；接手后修改部署功能前，优先执行本文第 7 节验证。

## 3. 不可破坏的边界

- `apps/admin` 和 `apps/web` 只能调用 API，禁止直连数据库。
- `apps/api` 是鉴权、业务规则、持久化和 OpenAPI 的唯一权威来源。
- 跨端类型先改 `packages/contracts`，然后实现 API，最后接入客户端。
- 后台管理员和用户端 Customer 是两套独立身份、会话与 Cookie。
- 管理员使用唯一手机号登录；邮箱只是可选联系信息。
- 密钥只进入环境变量或数据库加密字段，禁止写入 Git、日志和 API 响应。
- 模板源仓库不连接或自行搭建 PostgreSQL、Redis、SSH、对象存储等外部环境；真实验收环境由项目所有者提供，未提供时明确记录为等待环境，不能用本地伪环境代替。
- 前端权限控制只改善体验，API 权限守卫才是安全边界。
- 未启用 `userWeb` 时，不启动或构建 Web，也不显示用户运营菜单和相关权限。

完整规则见仓库根目录 `AGENTS.md`，各应用目录还有就近的 `AGENTS.md`。

## 4. 代码地图

| 位置                              | 作用                                       |
| --------------------------------- | ------------------------------------------ |
| `project.config.json`             | 当前模板能力和端口的机器可读事实来源       |
| `scripts/template-init.mjs`       | 新项目交互式初始化入口                     |
| `scripts/template-sync.mjs`       | 根据声明重新生成运行时项目配置             |
| `scripts/template-provision.mjs`  | 显式执行 Prisma 生成、迁移和初始管理员种子 |
| `packages/contracts/src/index.ts` | 跨端 DTO、状态和权限目录                   |
| `apps/api/src`                    | Nest API、鉴权、业务与持久化               |
| `apps/api/prisma`                 | Prisma schema、迁移和种子                  |
| `apps/admin/src`                  | Vue 后台管理端                             |
| `apps/web/app`                    | Nuxt 用户端                                |
| `docs/decisions`                  | 已接受架构决策，修改相关架构前必读         |
| `docs/ai/CONTEXT.md`              | 当前仍有效的详细事实                       |

## 5. 新项目标准流程

```bash
npm create aiforge@latest my-project
cd my-project
```

如果选择 PostgreSQL，在确认连接信息无误后执行：

```bash
pnpm template:provision -- --dry-run
pnpm template:provision
pnpm dev
```

初始化生成的管理员手机号和密码字段保存在 Git 忽略的 `.env` 中。不要假设固定演示账号，也不要重复运行初始化来猜测密码。

## 6. 部署中心真实完成度

已完成：

- Admin `/deployments` 多环境配置与按初始化能力选择 Admin/API/Web。
- 部署目标、任务和步骤的 Prisma 模型及 RBAC 权限。
- SSH 登录、Docker、磁盘和目录真实连通性检查。
- SSH/CNB/Registry 凭据加密保存且不回显。
- CNB `api_trigger_deploy` 构建触发和三个应用的镜像构建定义。
- 受 `DEPLOYMENT_CALLBACK_TOKEN` 保护的任务状态回传接口，可接收构建、部署、健康检查和失败状态。
- Caddy 自动 HTTPS 的约束与架构决策。

尚未完成，不能对用户宣称“一键部署闭环”：

1. 首次部署所需的本地 Deploy Worker 安装与引导流程。
2. 目标服务器独立 Deploy Agent。
3. CNB 构建完成回调或轮询、镜像拉取、容器切换。
4. 迁移前检测、健康检查、失败回滚和日志回传。
5. Deploy Agent 自升级与失联恢复。

当前“构建并部署”只会创建持久化任务并触发 CNB 构建，任务会保持“构建中”。继续开发必须遵循 `docs/decisions/0009-deployment-control-plane.md`，不要让 API 进程直接长期执行部署，也不要伪造成功状态。

## 7. 启动与验证

日常启动：

```bash
pnpm dev
```

默认端口由 `project.config.json` 决定；当前通常为 Admin 3000、API 3001、Web 3002。Admin API 地址统一从 `apps/admin/src/api/base.ts` 解析，禁止在业务文件硬编码 3001。

提交前最低验证：

```bash
pnpm template:doctor
pnpm check
pnpm test:e2e
```

涉及全新项目初始化时再执行：

```bash
pnpm template:verify -- --full
```

涉及 PostgreSQL 时必须在真实测试数据库执行迁移、种子和登录验证；涉及镜像时必须在有 Docker 的环境或 CI 验证。

## 8. 下一步建议顺序

1. 完成 Deploy Agent 与 API 的安全注册、心跳、任务领取和状态回传契约。
2. 实现 CNB 构建结果接收以及不可变 Commit 镜像部署。
3. 实现容器健康检查、迁移检测和自动回滚。
4. 实现首次本地 Worker 引导，把控制权移交远程 Deploy Agent。
5. 补部署链路单元、集成和有 Docker 环境的端到端测试。
6. 全量验收通过后再打冻结版本标签。

## 9. 按任务最小阅读集

| 任务       | 继续阅读                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| 初始化 CLI | `docs/USER_GUIDE.md`、`scripts/lib/template-config.mjs`、初始化脚本               |
| Admin 功能 | `apps/admin/AGENTS.md`、共享契约、对应 API 模块                                   |
| API/数据库 | `apps/api/AGENTS.md`、`packages/contracts/AGENTS.md`、`docs/api/CONVENTIONS.md`   |
| 用户端     | `apps/web/AGENTS.md`、用户端认证相关 ADR 与契约                                   |
| 权限       | `docs/decisions/0003-permission-taxonomy.md`、`permissionCatalog`                 |
| 服务密钥   | `docs/architecture/SERVICE_INTEGRATIONS.md`                                       |
| 部署中心   | `docs/decisions/0009-deployment-control-plane.md`、`docs/DEPLOYMENT.md`           |
| 冻结验收   | `docs/FREEZE_ACCEPTANCE_TASKS.md`、`docs/ROADMAP.md`、`docs/MANUAL_ACCEPTANCE.md` |

## 10. 维护本交接文档

只记录仍然有效、能帮助下一位 AI 决策的事实。功能完成度、启动流程、关键边界或最高优先级发生变化时，同一提交更新本文件与 `docs/ai/CONTEXT.md`；临时调试过程交给 Git，不写进项目记忆。

# 2026-08-08 交接补充：部署与数据库边界

## 当前已验证

- 模板固定使用 PostgreSQL + Prisma，不再支持 memory 数据源。
- API 构建阶段不需要真实 `DATABASE_URL`；CNB 的 `api_trigger_deploy` 只执行格式检查、Lint、类型检查和构建。
- 真实 `DATABASE_URL`、Redis、短信、邮件、对象存储等配置只在服务器运行时注入。
- CNB Token 推荐权限：`repo-code:rw`、`repo-basic-info:r`、`repo-cnb-trigger:rw`、`repo-cnb-history:r`、`repo-cnb-detail:r`、`registry-package:rw`。
- CNB API 触发接口：`POST /{repo}/-/build/start`；状态接口：`GET /{repo}/-/build/status/{sn}`；阶段日志接口：`GET /{repo}/-/build/logs/stage/{sn}/{pipelineId}/{stageId}`。
- 后台已有部署进度、SSE 和 CNB 原始阶段详情接口。API 构建状态查询接口为 `GET /api/deployments/:targetId/runs/:runId/cnb-status`。

## 当前部署链路状态

CNB 构建触发、构建编号保存、状态查询和阶段详情读取已经接入。镜像构建完成后的远程发布、Compose 更新、运行时配置注入、Prisma 迁移和最终健康检查仍需继续实现；在这些步骤完成前，不要把部署记录标记为成功。

## 接手后的验证顺序

1. 使用真实 PostgreSQL 配置运行 `pnpm template:provision` 和 `pnpm dev:api`。
2. 在后台配置部署环境并完成服务器、CNB 仓库和 Token 检查。
3. 触发 `main` / `api_trigger_deploy`，在 CNB 页面或 `cnb-status` 接口查看阶段状态。
4. 构建阶段不得读取生产数据库；服务器发布阶段才注入运行时配置并执行迁移。

## 安全约束

不要把数据库连接串、SSH 密码、CNB Token 或服务密钥写入 `.cnb.yml`、镜像、Git、日志或 API 响应。所有敏感信息只能进入后台加密配置或服务器运行时环境。
