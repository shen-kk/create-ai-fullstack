# 当前项目上下文

最后核对：2026-08-03

## 当前事实

- Admin 登录页不预填固定演示账号或 `Admin@123456`；初始化管理员使用 `.env` 中每个项目独立生成的 `DEV_ADMIN_PHONE` / `DEV_ADMIN_PASSWORD`。初始化结束只显示手机号和密码所在字段，不回显随机密码；登录接口成功状态为 HTTP 200。
- Admin 的全部 API 请求统一使用 `src/api/base.ts` 解析地址：优先采用部署时的 `VITE_API_BASE_URL`，否则读取初始化生成的 `project.runtime.apiPort`。禁止在会话或业务 API 文件中硬编码 `3001`，避免自定义端口被浏览器误报为 CORS 错误。

- `template:init` 默认进入 custom 自定义模式。Redis 连接或鉴权失败会保留在当前初始化向导并默认要求重新填写，不再结束整个初始化。开发任务调度器必须加载根目录 `.env` 并通过 Turbo `dev.env` 传给 API，确保 `DATA_SOURCE=prisma` 实际选择 Prisma 仓库而不是静默回退内存假数据。未启用用户端时 Admin 隐藏整个空“用户运营”分组，API 权限目录、角色响应和数据库种子同时移除 `customers`、`verification` 权限。

- 初始化向导的 quick、standard、custom 交互模式均显式询问是否启用用户端并输出最终选择；PostgreSQL 按主机、端口、库名、用户名、密码分项收集。正式数据库可在向导结尾立即刷新 workspace、校验连接、部署迁移、创建初始管理员。初始化填写的 SQL/Redis/对象存储/短信/邮件/支付配置通过 Git 忽略的一次性文件传递，种子程序使用 `CONFIG_ENCRYPTION_KEY` 加密写入 `IntegrationConfig`，成功后删除；Redis 配置在入库前执行 PING/鉴权校验。

- 冻结候选验收已覆盖启用用户端的全新临时目录：锁定依赖安装、`template:init`、全仓库包命名空间替换、Doctor 19/19、Prisma Client 生成、格式/Lint/类型/测试以及 Admin/API/Web 生产构建。能力调度和数据库部署命令必须从 `project.packageScope` 生成，不得再硬编码 `@template/*`。手工验收流程见 `docs/MANUAL_ACCEPTANCE.md`。
- 用户端 `/profile` 使用左侧分组设置导航，分为个人资料、联系方式、安全设置和登录设备；顶部账号区通过鼠标移入、键盘聚焦或点击展开个人中心/退出菜单。用户头像只能通过 `POST /api/customer-auth/avatar` 上传 JPG、PNG 或 WebP（最大 2 MB）到已配置的对象存储；不接受手工 URL 且不提供本地文件兜底，未配置时返回稳定错误码并显示中文提示。
- 用户端现有账户 API 已全部收口到 `useCustomerSession`：注册、密码/验证码登录、找回密码、会话恢复与退出、资料编辑、邮箱绑定、修改密码和设备会话管理均使用共享契约的类型化方法。请求默认 12 秒超时，稳定错误码映射为中文；Access Token 过期时仅发起一次并发刷新并重试原请求。撤销设备会话后，API 对后续 Access Token 请求同步校验会话有效性。
- 用户端以 shadcn-vue 作为业务组件基础，VueUse Motion 处理常规过渡，GSAP 只处理首页等高价值动画编排；自定义 Design System 采用 Apple 的克制与空间感、Linear 的交互密度和 Vercel 的黑白层级。`components/ui` 不依赖动效，`components/motion` 不承载业务状态，并尊重 SSR 与减少动态效果偏好。
- 用户端跨页面反馈统一使用右上角 `AppToast`，认证表单不再用撑开布局的行内服务端提示；页面使用统一轻量过渡，不允许只给同级内容中的个别卡片添加入场动画。所有按钮必须明确设计 hover、focus 和 disabled 对比度。

- UI 默认语言为 `zh-CN`；状态枚举和错误码在 API/数据库保持英文稳定代码，Admin/Web 必须通过中文映射展示，不直接输出状态码。初始化声明包含 `localization`，未来增加多语言时必须让模板使用者显式选择。

- 仓库采用 pnpm workspace + Turborepo。
- 三个可部署应用分别为 `admin`、`web`、`api`。
- API 是业务规则和数据访问的唯一入口。
- PostgreSQL 是默认数据库，Prisma 管理 schema 与迁移。
- `/api/health` 是基础健康检查端点。
- 公共传输对象放在 `@template/contracts`。
- 用户管理已提供只读查询样板：`GET /api/users`；`UsersRepository` 可由 `DATA_SOURCE=memory|prisma` 切换，默认内存模式保证零依赖预览，生产环境强制 Prisma。
- 认证基线已实现：`/api/auth/login|refresh|logout|me`，Admin 具有登录页、会话恢复和受保护路由；认证仓库随 `DATA_SOURCE` 切换内存或 Prisma，Prisma 模式从用户角色实时加载权限。
- 用户查询接口已要求 Bearer Access Token；Refresh Token 仅通过 HttpOnly Cookie 传递。
- 模板完善顺序与冻结标准记录在 `docs/ROADMAP.md`；冻结前不创建分发型 Git 模板或 Skill。
- 外部服务接入按 `docs/architecture/SERVICE_INTEGRATIONS.md` 管理；当前只启用 PostgreSQL 配置，Redis、SMTP、短信和支付等待对应功能落地。
- Prisma 已定义 User、Role、Permission、RefreshSession、AuditLog 及关系，初始迁移和幂等种子脚本已提交；本机无 Docker，尚未执行真实数据库集成验证。
- API 已统一输出稳定错误结构和 `x-request-id`，生产环境启动时校验关键配置；健康检查分为 `/api/health/live` 与 `/api/health/ready`。
- 登录接口按“来源 IP + 规范化邮箱”限制 15 分钟内最多 5 次失败；当前为单实例内存实现，生产多实例部署时应切换 Redis。
- API 已提供 `RequirePermissions` 装饰器与 `PermissionsGuard`；`GET /api/users` 除登录外还必须具有 `users.read` 权限。
- Refresh Token 已实现服务端会话登记、SHA-256 摘要存储、一次性轮换和退出撤销；内存/Prisma 会话仓库随 `DATA_SOURCE` 切换。
- 用户管理已支持创建、基本资料编辑、状态变更和角色分配；角色分配同时要求 `users.write`、`roles.manage` 并在 Prisma 事务中替换。依据 ADR-0004，模板不删除管理员账号，退出使用时改为停用。
- 用户创建、资料修改、状态变更和角色分配会写入不可由后台删除的审计日志；`GET /api/audit-logs` 与 Admin `/logs` 要求 `audit.read`。
- 审计日志列表支持服务端分页，以及按关键字、动作、资源和结果筛选；关键字可匹配操作者、资源 ID、请求 ID 和 IP 地址。
- Admin 会在 sessionStorage 同步保存 Access Token 与当前用户摘要，侧边栏展示真实身份；退出会请求服务端撤销 Refresh Session，即使 API 暂不可用也会完成本地退出。未知路由使用受保护的 404 页面。
- Admin 路由通过 `meta.permissions` 声明访问要求，菜单按当前身份权限隐藏无权访问的已实现模块；权限不足进入 `/403`。该客户端检查只改善体验，API 守卫仍是唯一安全权威。
- Admin `/roles` 支持创建自定义角色及编辑名称、说明、权限集合；系统角色不可修改，Prisma 权限替换使用事务，写操作进入审计日志。模板不删除角色，权限目录由共享契约的 `permissionCatalog` 统一定义并随版本发布。
- Admin `/logs` 支持服务端分页浏览，已覆盖用户与角色写操作的中文动作展示。
- API 使用 JSON 结构化日志记录请求 ID、方法、路径、状态、耗时和可用的操作者 ID；禁止记录请求体、密码、Cookie 与 Authorization Header。
- OpenAPI 已声明 Bearer Access Token、HttpOnly Refresh Cookie 及模块标签；依据 ADR-0005，共享 TypeScript 契约是单仓库权威来源，当前不生成内部客户端，外部 SDK 在具体项目需要时再启用完整响应 Schema 门禁。
- 权限目录按 ADR-0003 分为 `menu` 与 `action`，通过 `groupCode` 归组；Admin 菜单/路由检查 `menu.*`，API 只以业务操作权限作为数据安全边界。数据库迁移 `20260802000200_permission_taxonomy` 已加入，待 PostgreSQL 执行验证。
- Windows `dev-local.cmd` 会通过 `scripts/prepare-local.ps1` 检测 3000/3001：只替换命令行属于当前工作区的旧服务，发现外部程序占用时拒绝误杀；重复启动已实际验证。
- `apps/web` 已恢复为正式用户端模板并纳入默认启动、检查和构建；提供 SSR 首页、手机号验证码注册、密码/验证码登录、短信找回密码、会话恢复、个人中心、邮箱验证绑定和响应式布局。验证码按用途隔离，5 分钟过期、60 秒重发限制、5 次错误上限、摘要存储且单次消费；开发内存模式可回显测试码，生产禁止回显。腾讯云短信与 TLS SMTP 只由 API 消费后台加密服务配置。
- 用户端安全中心可列出有效 Refresh Session，并撤销单个或其他设备；后台 `/verification-deliveries` 按渠道、用途和状态分页查询脱敏验证码发送记录，不展示目标明文或验证码。
- 用户端账号使用独立 `Customer`、`CustomerRefreshSession`、`/api/customer-auth/*` 与 `customer_refresh` Cookie，不复用后台管理员身份或权限；决策见 ADR-0006。
- 用户端是初始化时显式选择的可选能力：`userWeb` 与 `customerAuthentication` 必须成对启停；关闭时不注册用户端 API、不启动/构建 Web，也不显示用户端权限和后台“用户端用户”菜单。启用时后台提供查询、筛选、分页和状态管理，停用账号会撤销其全部 Refresh Session，Access Token 请求也会重新确认账号仍启用。
- Admin 已移除内容、订单等行业业务占位入口；工作台只展示用户、角色、审计和健康检查的真实接口数据，所有卡片和快捷入口均可访问。`/system` 通过 `system.read` 展示非敏感运行信息。模板不预置具体行业模块，初始化后的项目按需选择。
- Admin 使用统一线性 SVG 图标和分组侧边栏；筛选与状态选择使用可控圆角浮层的 `AppSelect`，不依赖无法统一样式的浏览器原生下拉菜单。侧边栏账号区进入 `/profile`。
- 个人中心支持修改显示名称、HTTPS 头像地址和密码；`PATCH /api/auth/profile` 与 `POST /api/auth/password` 均要求 Access Token，密码修改校验当前密码并重新生成 scrypt 哈希。Prisma 迁移 `20260802000400_user_profile` 增加 `avatarUrl`。
- 后台身份以手机号作为必填唯一登录标识，邮箱降为可选联系资料；登录、管理员创建/编辑、内存/Prisma 仓库和种子均按手机号执行。迁移 `20260802000600_admin_phone_identity` 负责既有数据过渡。
- `/integrations` 管理对象存储、SQL、Redis、短信、邮件和支付配置；字段定义由代码注册，密钥采用 AES-256-GCM 加密，API 只返回已配置字段名且永不回显明文。需要 `menu.integrations` 与 `integrations.manage`，Prisma 迁移为 `20260802000700_integration_config`。
- 服务配置字段支持平台/类型枚举选择；头像通过 `POST /api/auth/avatar` 直接上传到已启用的对象存储，当前适配腾讯云 COS。模板明确不提供本地文件存储或本地兜底，未配置、配置不完整或适配器不可用时返回稳定错误码并由 Admin 引导前往服务配置。
- Git 模板初始化入口为 `pnpm template:init`，提供 quick、standard、custom 三种模式，将非敏感能力声明写入 `project.config.json`、敏感运行配置写入 Git 忽略的 `.env`；`pnpm template:doctor` 检查声明结构、密钥强度、管理员手机号和数据源一致性。第一版数据库初始化选项只开放已真实支持的内存预览与 PostgreSQL + Prisma，且不会未经确认连接数据库或执行迁移。
- PostgreSQL 项目通过显式的 `pnpm template:provision` 执行 Prisma Client 生成、`prisma migrate deploy` 与管理员种子；默认要求输入 `YES`，支持 `--dry-run`，且不输出数据库连接串。内存模式会安全跳过。
- `template:init` / `template:sync` 会同时生成 Admin 与 API 的无密钥运行时能力文件；项目显示名称用于后台品牌与 Swagger，未在 `project.config.json` 启用的 Redis、短信、邮件、支付等配置不会由 API 列出或接受更新。`template:doctor` 检查生成文件与声明一致性。
- 服务配置 API 按字段定义执行嵌套白名单、字符串类型、平台枚举和启用时必填校验；未知字段、错误平台和不完整配置使用稳定错误码拒绝。对象存储 endpoint 为兼容 S3 等平台的可选字段，腾讯云 COS 不强制填写。
- 服务配置成功与失败更新均写入审计日志，记录操作者、请求 ID、来源 IP、服务类型、启用状态及变更字段名；审计元数据不包含任何配置值或密钥值。Admin 操作日志支持按“服务配置”资源与“修改服务配置”动作筛选。
- API E2E 以黑盒方式启动编译产物，覆盖手机号登录、受保护用户接口、服务配置失败校验及秘密值不进入审计响应；GitHub CI 已运行 `pnpm check`、`template:verify` 与 `test:e2e`。PostgreSQL 集成仍待有可用数据库环境时验证。
- Admin 会话层已覆盖登录持久化、离线退出清理和损坏缓存恢复测试；分页统一从 1 开始、最大 100，默认采用 `createdAt desc, id asc` 稳定排序。
- `pnpm template:verify -- --full` 已在无依赖、无构建产物、无本地密钥的临时副本中验证安装前后命名空间替换、workspace 链接刷新、Prisma Client 生成、43 个单元测试与 Admin/API 生产构建。
- 仓库内可分发 Skill 位于 `skills/create-admin-project`，已通过官方 `quick_validate.py`；它引导新项目完成 Git 获取、初始化选择、二次 workspace 链接刷新、Doctor、数据库显式确认和 AI 上下文维护。
- 模板正式目标仓库为 `https://cnb.cool/nsmiling.com/ai-template`；用户要求完善和最终冻结验收完成后再推送，目前不得提前推送。
- 已增加 PostgreSQL CI 服务、迁移/种子/Prisma E2E、Admin Nginx 镜像、API Node 生产镜像、生产 Compose 及部署备份文档；当前机器没有 Docker，镜像实际构建需由 CI 或有 Docker 的环境最终确认。

## 按任务读取

| 任务           | 必读内容                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| 修改全局架构   | `docs/architecture/OVERVIEW.md`、全部相关 ADR                                   |
| 新增业务模块   | `docs/domain/GLOSSARY.md`、模块领域文档、`docs/ai/TASK_TEMPLATE.md`             |
| 判断下一步工作 | `docs/ROADMAP.md`、本文件的待业务确认项                                         |
| 修改 API       | `apps/api/AGENTS.md`、`packages/contracts/AGENTS.md`、`docs/api/CONVENTIONS.md` |
| 修改后台       | `apps/admin/AGENTS.md`、相关 API 契约                                           |
| 修改用户端     | `apps/web/AGENTS.md`、相关 API 契约                                             |
| 修改数据库     | `apps/api/AGENTS.md`、相关领域不变量、ADR                                       |

## 待业务确认

- 身份基线已按 ADR-0002 选择为单租户起步；未来是否启用多租户仍待具体项目确认。
- 用户查询、认证/权限加载和刷新会话均具备 Prisma 数据源实现，但本机尚未进行 PostgreSQL 集成验证。
- 部署平台和可观测性供应商尚未确定。
