# 版本目录部署准备

部署中心不安装或长期托管应用进程。目标服务器只需准备一次 Git、Node.js、pnpm 和 PM2，之后每次发布都由部署中心完成。

以下示例假设部署路径为 `/srv/aiforge`，SSH 用户为 `deploy`。请按实际路径和用户修改。

## 1. 安装运行环境

服务器需要 Git、curl、Node.js 22+、pnpm 和 PM2。Node.js 建议通过服务器发行版或可信的版本管理方案安装。确认版本后执行：

```bash
sudo mkdir -p /srv/aiforge/releases
sudo chown -R deploy:deploy /srv/aiforge
sudo -u deploy git --version
sudo -u deploy node --version
sudo -u deploy pnpm --version
sudo -u deploy pm2 --version
```

部署中心的“检查服务器”会验证这些命令和部署目录写权限。日常发布使用 `deploy` 用户执行，不需要无限制 sudo。

## 2. PM2 项目配置

仓库根目录的 `ecosystem.config.cjs` 已定义两个进程：

- `aiforge-api`：运行 `apps/api/dist/src/main.js`。
- `aiforge-web`：运行 `apps/web/.output/server/index.mjs`。

两个进程都从当前 release 的 `.env` 读取环境变量。Admin 是静态文件，不需要 PM2；Nginx 的站点目录应指向 `/srv/aiforge/current/apps/admin/dist`。

部署中心切换 `current` 后分别执行：

```bash
pm2 startOrReload ecosystem.config.cjs --only aiforge-api --update-env
pm2 startOrReload ecosystem.config.cjs --only aiforge-web --update-env
```

`startOrReload` 兼容首次启动和后续重载，因此第一次发布前不需要手工创建这两个进程。

## 3. 配置开机启动

第一次成功发布后，以 `deploy` 用户执行：

```bash
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条需要 sudo 执行的命令。检查命令内容后执行它，再运行一次：

```bash
pm2 save
```

这是一次性操作。以后服务器重启时，PM2 会恢复保存的进程列表。

## 4. 查看状态和日志

```bash
pm2 list
pm2 logs aiforge-api
pm2 logs aiforge-web
pm2 describe aiforge-api
```

不要用 root 和 `deploy` 两个用户分别启动 PM2，否则会产生两套互相看不到的进程列表。部署中心 SSH 使用哪个用户，就用哪个用户完成 PM2 初始化。

## 5. 部署中心默认配置

- 安装命令：`pnpm install --frozen-lockfile`
- Admin 构建：`pnpm --filter @template/admin build`，重启命令为 `true`
- API 构建：`pnpm --filter @template/api build`
- API 迁移：`pnpm --filter @template/api exec prisma migrate deploy`
- API 重载：`pm2 startOrReload ecosystem.config.cjs --only aiforge-api --update-env`
- Web 构建：`pnpm --filter @template/web build`
- Web 重载：`pm2 startOrReload ecosystem.config.cjs --only aiforge-web --update-env`

健康检查建议填写 API 的完整 ready 地址，例如 `https://example.com/api/health/ready`。没有健康检查只能确认目录已切换，不能证明应用可用。
