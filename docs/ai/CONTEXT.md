# 当前项目上下文

> 新接手的 AI 请先阅读 `docs/ai/HANDOFF.md`，再按任务读取本文件中的详细事实。

最后核对：2026-08-03

## 当前事实

- 部署中心不再要求仓库提交 `aiforge.deploy.yml`，也不再把部署单元固定为 Admin/API/Web。后台一级菜单为“项目管理”，进入项目后查看环境；“部署项目”保存 Compose 文件、动态服务单元、迁移命令、健康检查和变量要求。环境必须绑定 Git、服务器及项目声明所需的 SQL/Redis 资源，发起任务时生成不可变执行快照；不再提供未绑定资源时的备用输入。服务器资源保存默认部署根目录，环境绑定后必须确认实际部署路径，任务使用环境路径。AIForge 三端只是系统预设，其他 Docker Compose 项目可新增独立项目定义。决策见 ADR-0011、ADR-0012。
- 部署命令不在 API HTTP 进程内执行。独立 Deploy Worker 通过 `pnpm dev:worker` 或构建后的 `start:worker` 领取数据库任务；Worker 不得加入它管理的业务部署项目，避免 AIForge 自部署时中断当前任务。生产 Worker 至少需要与 API 相同的 `DATABASE_URL`、`CONFIG_ENCRYPTION_KEY` 和出站 SSH/Git 网络权限。

- 用户端验证码有效时间与再次发送间隔由后台“服务配置 → 功能绑定 → 用户端认证”配置；验证码按钮使用服务端返回值倒计时。全局 Toast 由成功/异常分支显式指定语义，禁止按中文文案猜测状态。

- 服务配置是固定类型、多实例资源库：SQL、Redis、对象存储、短信、邮件、支付、Linux 服务器和 Git 仓库始终可创建。CLI 不选择这些基础设施；业务功能通过依赖图自动保留共享适配能力，具体服务商在运行后由后台绑定。
- 服务配置支持按资源类型筛选，并通过稳定功能编码把后台/用户端头像上传以及登录、找回密码、联系方式绑定的邮件或短信流程绑定到具体资源；禁止默认选择第一条资源，未绑定时功能不可用并显示配置提示。
- 服务配置中的“用户端认证设置”只允许手机号或邮箱二选一；启用前强制校验登录、找回密码对应的功能绑定。用户端不提供独立注册页，首次验证码登录自动创建账号并登录；Customer 手机号与邮箱分别唯一且至少存在一个。
- 验证码消息模板与服务资源分离：功能绑定同时指定资源和模板；SMTP 渲染可编辑标题/正文，SES API 与短信使用服务商模板 ID 和参数映射。系统预置登录、找回密码、绑定联系方式六条模板，未绑定模板时不发送且不自动选择第一条。
- Admin 服务配置按“服务资源、功能绑定、消息模板”拆为三个二级路由，一级侧边菜单保持选中；邮件 HTML 正文统一通过基于 Tiptap 的 `AppRichTextEditor` 编辑，短信和纯文本回退内容仍使用纯文本字段。

- Admin 登录页不预填固定演示账号或 `Admin@123456`；初始化管理员使用 `.env` 中每个项目独立生成的 `DEV_ADMIN_PHONE` / `DEV_ADMIN_PASSWORD`。初始化结束只显示手机号和密码所在字段，不回显随机密码；登录接口成功状态为 HTTP 200。
- Admin 管理员成功完成密码登录后更新 `User.lastActiveAt`，用户管理列表的“最近活跃”展示该真实时间；认证失败不得更新。后台 `.page-content` 不设置桌面端最大宽度，在高分辨率屏幕上使用侧边栏以外的全部可用空间。
- Admin 的全部 API 请求统一使用 `src/api/base.ts` 解析地址：优先采用部署时的 `VITE_API_BASE_URL`，否则读取初始化生成的 `project.runtime.apiPort`。禁止在会话或业务 API 文件中硬编码 `3001`，避免自定义端口被浏览器误报为 CORS 错误。

- `create-aiforge` 只选择业务功能并组合代码，不再提供 quick、standard、custom，也不询问邮件、短信、Redis、对象存储或数据库凭据。`project.config.json.features` 是业务选择事实来源，`modules` 必须由共享功能目录推导。未启用用户端时物理移除 `apps/web`，并继续收敛关联 API、权限和 Prisma 的细粒度组合。

- 完整模板与 CLI 生成项目统一使用可视化 `pnpm setup` 配置端口、PostgreSQL、项目密钥和初始管理员，可选择立即执行迁移和种子。模板维护者与普通使用者的区别仅是 GitHub 完整源码与 CLI 裁剪源码。

- 新组合器已覆盖“仅核心”和“用户端 + 头像”的干净临时目录结构验收；用户端账号将验证码、消息模板和邮件/短信适配作为共享依赖自动保留，不再向用户提供容易误裁剪的验证码独立开关。发布 0.2 前仍需完成锁定依赖安装、`pnpm setup`、Doctor、Prisma Client、格式/Lint/类型/测试及生产构建的完整组合矩阵。
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
- 用户管理通过 `GET /api/users` 和 `UsersRepository` 访问真实 PostgreSQL；运行模块无条件注入 Prisma 仓库，内存实现只允许单元测试直接构造，配置错误不得回退假数据。
- 认证基线已实现：`/api/auth/login|refresh|logout|me`，Admin 具有登录页、会话恢复和受保护路由；身份始终从 PostgreSQL 用户、角色和权限加载。
- 用户查询接口已要求 Bearer Access Token；Refresh Token 仅通过 HttpOnly Cookie 传递。
- 模板完善顺序与冻结标准记录在 `docs/ROADMAP.md`。
- 外部服务接入按 `docs/architecture/SERVICE_INTEGRATIONS.md` 管理；验证码已支持腾讯云短信、TLS SMTP 和腾讯云 SES，其他适配器按项目需要接入。
- Prisma 已定义 User、Role、Permission、RefreshSession、AuditLog 及关系；13 个迁移、幂等种子和真实 PostgreSQL E2E 已在模板开发数据库通过。
- API 已统一输出稳定错误结构和 `x-request-id`，生产环境启动时校验关键配置；健康检查分为 `/api/health/live` 与 `/api/health/ready`。
- 登录接口按“来源 IP + 规范化邮箱”限制 15 分钟内最多 5 次失败；当前为单实例内存实现，生产多实例部署时应切换 Redis。
- API 已提供 `RequirePermissions` 装饰器与 `PermissionsGuard`；`GET /api/users` 除登录外还必须具有 `users.read` 权限。
- Refresh Token 已实现 PostgreSQL 会话登记、SHA-256 摘要存储、一次性轮换和退出撤销。
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
- `apps/web` 已恢复为正式用户端模板并纳入默认启动、检查和构建；提供 SSR 首页、验证码/密码登录、找回密码、会话恢复、个人中心、联系方式绑定和响应式布局。验证码按用途隔离，5 分钟过期、60 秒重发限制、5 次错误上限、摘要存储且单次消费；必须经后台绑定的腾讯云短信、TLS SMTP 或腾讯云 SES 真实发送，API 不回显验证码。
- 用户端安全中心可列出有效 Refresh Session，并撤销单个或其他设备；后台 `/verification-deliveries` 按渠道、用途和状态分页查询脱敏验证码发送记录，不展示目标明文或验证码。
- 用户端账号使用独立 `Customer`、`CustomerRefreshSession`、`/api/customer-auth/*` 与 `customer_refresh` Cookie，不复用后台管理员身份或权限；决策见 ADR-0006。
- 用户端是初始化时显式选择的可选能力：`userWeb` 与 `customerAuthentication` 必须成对启停；关闭时不注册用户端 API、不启动/构建 Web，也不显示用户端权限和后台“用户端用户”菜单。启用时后台提供查询、筛选、分页和状态管理，停用账号会撤销其全部 Refresh Session，Access Token 请求也会重新确认账号仍启用。
- Admin 已移除内容、订单等行业业务占位入口；工作台只展示用户、角色、审计和健康检查的真实接口数据，所有卡片和快捷入口均可访问。`/system` 通过 `system.read` 展示非敏感运行信息。模板不预置具体行业模块，初始化后的项目按需选择。
- Admin 使用统一线性 SVG 图标和分组侧边栏；筛选与状态选择使用可控圆角浮层的 `AppSelect`，不依赖无法统一样式的浏览器原生下拉菜单。侧边栏账号区进入 `/profile`。
- 个人中心支持修改显示名称、HTTPS 头像地址和密码；`PATCH /api/auth/profile` 与 `POST /api/auth/password` 均要求 Access Token，密码修改校验当前密码并重新生成 scrypt 哈希。Prisma 迁移 `20260802000400_user_profile` 增加 `avatarUrl`。
- 后台身份以手机号作为必填唯一登录标识，邮箱降为可选联系资料；登录、管理员创建/编辑、Prisma 仓库和种子均按手机号执行。迁移 `20260802000600_admin_phone_identity` 负责既有数据过渡。
- `/integrations` 管理对象存储、SQL、Redis、短信、邮件和支付配置；字段定义由代码注册，密钥采用 AES-256-GCM 加密。普通列表只返回已配置字段名；持有独立 `secrets.read` 权限时可通过眼睛按钮临时读取明文，读取动作必须审计且前端不得持久化。密码哈希永不回显。决策见 ADR-0014。
- 服务配置字段支持平台/类型枚举选择；头像通过 `POST /api/auth/avatar` 直接上传到已启用的对象存储，当前适配腾讯云 COS。模板明确不提供本地文件存储或本地兜底，未配置、配置不完整或适配器不可用时返回稳定错误码并由 Admin 引导前往服务配置。
- 最终用户入口为 `npm create aiforge@latest <project-name>`；CLI 使用终端多选界面选择业务功能，在下载后按功能依赖图组合代码、安装依赖、执行 `feature:check`、移除模板 Git 历史并初始化新仓库。随后统一运行 `pnpm setup` 生成 Git 忽略的 `.env`，校验 PostgreSQL并按确认执行迁移和管理员种子。
- 项目通过显式的 `pnpm template:provision` 执行 Prisma Client 生成、`prisma migrate deploy` 与管理员种子；默认要求输入 `YES`，支持 `--dry-run`，且不输出数据库连接串。
- 内部组合器与 `template:sync` 会为现存应用生成无密钥运行时功能文件；项目显示名称用于后台品牌与 Swagger。业务功能从 `features` 推导模块，共享服务适配器不能由散落布尔值独立选择；Doctor 检查生成文件与声明一致性。
- 服务配置 API 按字段定义执行嵌套白名单、字符串类型、平台枚举和启用时必填校验；未知字段、错误平台和不完整配置使用稳定错误码拒绝。对象存储 endpoint 为兼容 S3 等平台的可选字段，腾讯云 COS 不强制填写。
- 服务配置成功与失败更新均写入审计日志，记录操作者、请求 ID、来源 IP、服务类型、启用状态及变更字段名；审计元数据不包含任何配置值或密钥值。Admin 操作日志支持按“服务配置”资源与“修改服务配置”动作筛选。
- API E2E 以黑盒方式启动编译产物，覆盖手机号登录、受保护用户接口、服务配置失败校验、用户端完整生命周期及秘密值不进入审计响应；测试从私有环境读取管理员凭据，使用唯一临时用户并在结束时清理。真实 PostgreSQL 流程已通过。
- Admin 会话层已覆盖登录持久化、离线退出清理和损坏缓存恢复测试；分页统一从 1 开始、最大 100，默认采用 `createdAt desc, id asc` 稳定排序。
- `pnpm template:verify -- --full` 在无依赖、无构建产物、无本地密钥的临时副本中验证安装前后命名空间替换、workspace 链接刷新、Prisma Client 生成、测试与生产构建。
- 模板唯一主仓库为 `https://github.com/shen-kk/create-ai-fullstack`。
- 已增加 PostgreSQL CI 服务、迁移/种子/Prisma E2E、Admin Nginx 镜像、API Node 生产镜像、生产 Compose 及部署备份文档；当前机器没有 Docker，镜像实际构建需由 CI 或有 Docker 的环境最终确认。

- 部署中心是 `deploymentCenter` 可选模块，使用通用 Git、Linux SSH、Docker Compose、PostgreSQL 持久化任务和 SSE 日志；不依赖 CNB。Git 与服务器检查均成功后环境才可部署；是否迁移由项目中对应部署单元的迁移命令决定，应用回滚不自动回滚数据库。详细边界见 `docs/domain/DEPLOYMENTS.md` 与 ADR-0010、ADR-0011。

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

> 运行约束：模板统一使用 PostgreSQL + Prisma，禁止新增或恢复 memory 数据源、内存默认值或静默假数据回退。所有开发环境都通过 `pnpm setup` 生成的 `.env` 提供真实 `DATABASE_URL`。
