# 部署与备份

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
