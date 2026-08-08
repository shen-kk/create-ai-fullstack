# 部署与备份

## 后台部署中心

Deploy Agent 配置模板位于 `tools/deploy-agent/.env.example`，详细填写说明见 `tools/deploy-agent/README.md`。目标服务器上的真实 `.env` 只保存在服务器，不提交 Git。

启用核心能力 `deploymentCenter` 后，Admin `/deployments` 可以创建任意多个开发、测试、预发布、生产或自定义环境。应用范围来自初始化声明：Admin 与 API 始终存在，Web 只在 `userWeb` 启用时出现。

部署环境保存后处于“待验证”，必须使用真实 SSH 凭据通过服务器认证、Docker、磁盘与部署目录检查才允许发起任务。SSH、CNB 与 Registry 凭据以 `CONFIG_ENCRYPTION_KEY` 加密，响应和审计日志只包含已配置字段名。

CNB 或 Deploy Agent 回传任务状态时调用 `POST /api/deployments/internal/runs/:runId/status`，并在 `x-deployment-callback-token` 请求头中携带服务端环境变量 `DEPLOYMENT_CALLBACK_TOKEN`。生产环境必须配置随机长令牌并通过密钥管理系统注入。

第一次上线由本地运行的部署控制面完成；远程 Admin/API/Deploy Agent 就绪后，后续可从远程后台触发 CNB `api_trigger_deploy`。CNB 检出指定分支、Tag 或 Commit，运行质量门禁，按本次应用范围构建并推送不可变 Commit 标签镜像。具体边界见 ADR-0009。

自动 HTTPS 使用 Caddy，要求域名已解析到目标服务器且 80/443 可用；系统不修改 DNS。使用 IP/端口或已有反向代理时仍必须为每个启用应用填写最终访问 URL，以便构建正确的跨端 API 地址。

## 生产前提

- 生产环境只允许 `DATA_SOURCE=prisma`。
- JWT、配置加密密钥和数据库密码至少 32 个字符，并由部署平台密钥管理提供。
- `.env`、数据库备份和对象存储密钥不得提交 Git。
- 首次发布先执行 `pnpm template:provision -- --dry-run`，确认目标后再部署迁移。

## Docker Compose

复制 `.env.example` 为仅用于部署主机的 `.env`，另外配置 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`。然后执行：

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml run --rm api sh -c "cd apps/api && npx prisma migrate deploy"
docker compose -f docker-compose.production.yml up -d
```

Admin 镜像使用 Nginx 提供 SPA 回退和静态资源缓存；API 镜像运行 Nest 编译产物。生产环境应在二者之前配置 HTTPS 反向代理，并只暴露必要端口。

## 备份与恢复

- PostgreSQL：至少每日执行加密的 `pg_dump`，保留周期由项目数据等级决定。
- 对象存储：开启版本控制或生命周期策略，密钥与数据库备份分开保管。
- 恢复演练：定期在隔离环境恢复数据库并运行 `/api/health/ready` 与关键 E2E。
- 配置加密密钥丢失后无法恢复服务配置密文；必须进入独立密钥备份流程。

上线前执行 `pnpm check`、`pnpm template:verify` 和 `pnpm test:e2e`。部署后检查 `/api/health/live`、`/api/health/ready` 与 Admin `/healthz`。
