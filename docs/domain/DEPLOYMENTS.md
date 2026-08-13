# 部署领域

## 目标

管理员配置 Git 仓库和 Linux 服务器，分别验证后发起 Admin、API、Web 的独立部署，并在后台持续查看步骤、终端日志和历史版本。部署失败不得覆盖一条成功发布记录。

## 状态

- 环境：`draft`、`verified`、`unreachable`。Git 与 SSH/服务器运行环境均通过才是 `verified`；编辑配置后回到 `draft`。
- 任务：`queued` → `running` → `succeeded | failed | cancelled`。
- 回滚：`queued` → `running` → `rolled_back | failed | cancelled`。
- 每个环境同一时间只允许一个活动任务。

## 发布与回滚

服务器使用 `<deployPath>/releases/<version>` 保存不可变版本，`current` 符号链接指向当前版本。回滚会重新启动历史 release、健康检查后切换 `current`，不会自动回滚数据库。

## 安全边界

- Git Token、Git SSH 私钥、服务器密码和服务器私钥使用 AES-256-GCM 加密。
- API 只返回 `configuredSecrets`，日志必须脱敏且不得记录执行命令中的凭据。
- 正式环境部署、取消和回滚全部需要独立权限并写入审计日志。
- Worker 默认随 API 启动；可设置 `DEPLOY_WORKER_ENABLED=false` 禁用本实例消费任务，为后续拆分专用 Worker 进程保留边界。

## 第一版服务器约定

- Linux 已安装 Git、Docker 和 Docker Compose。
- 仓库包含 `docker-compose.production.yml`，Compose 服务名为 `admin`、`api`、`web`。
- API 运行时需要的 `.env` 或平台 Secret 必须在服务器部署目录按项目部署规范准备；构建日志不得显示其内容。
