# ADR 0015：版本目录与 PM2 发布

## 状态

已接受，替代 ADR-0010、ADR-0011 中以 Docker Compose 作为第一版运行方式的部分。

## 决策

部署中心只支持 `release-directory`：Worker 在服务器的 `releases/<version>` 独立目录拉取代码、写入受限 `.env`、安装锁定依赖、执行各部署单元的构建与迁移命令，然后原子切换 `current` 软链接并执行各单元的 PM2 重启命令。应用进程由 PM2 托管，部署中心不长期托管进程。PM2 reload 会沿用旧 release 的工作目录和脚本绝对路径，因此内置预设先删除自身管理的同名进程，再从目标 release 的 ecosystem 配置启动；禁止删除其他 PM2 进程。

健康检查失败或重启失败时，Worker 自动把 `current` 切回部署前版本并重新执行重启命令。手工回滚采用同一切换、重启与健康检查流程。数据库迁移仍不自动回滚。

部署命令必须是单行、可审查配置；不得包含换行或空字节。服务器检查要求 Git、curl、Node.js、Corepack、PM2 和可写部署目录。

Worker 在发布构建前执行资源门禁，默认要求 `MemAvailable + SwapFree` 至少为 1536 MB。依赖安装、Prisma Client 生成和应用构建统一以低进程优先级执行，并默认把 Node 堆限制为 768 MB；两项阈值可通过 Worker 环境变量调整。资源限制只作用于构建阶段，不传递给迁移、PM2 重载或最终应用进程。长期建议在独立 Linux Worker/CI 产出构建结果，让生产机只承担发布切换。

## 数据迁移

Docker Compose 项目定义不能无歧义转换为宿主机命令。本次迁移仅清理 `DeployProject`、`DeployEnvironment`、`DeployRun`、`DeployStep`、`DeployLog` 与 `DeployRelease`，不删除服务资源、账号、审计日志或其他业务数据。初始化种子会按需要创建新的 AIForge 目录发布预设。

## 原因

- 构建发生在独立目录，不会覆盖正在运行的版本。
- `current` 原子切换让发布和回滚的文件边界清晰。
- PM2 负责崩溃拉起和日志，并通过一次性的 `pm2 startup` / `pm2 save` 接入系统开机启动；Worker 只负责一次发布事务。
- 不要求使用者理解镜像、容器、Compose 项目名和卷生命周期。
