# 模板发布检查表

## 自动门禁

- [x] `pnpm check`
- [x] `pnpm test:e2e`（内存模式）
- [x] `pnpm test:startup`（Windows 安全启动守卫）
- [x] `pnpm template:verify -- --full`（全新目录安装、初始化、改名、Prisma 生成、测试与构建）
- [x] Skill `quick_validate.py`

## 环境门禁

- [ ] PostgreSQL 迁移、种子与 Prisma E2E（由仓库 CI 的 PostgreSQL 17 服务执行）
- [ ] Admin/API Docker 镜像构建（由仓库 CI 执行；当前开发机未安装 Docker）
- [ ] 远程仓库 CI 全部通过

## 发布动作

- [ ] 初始化 Git 仓库并检查提交内容不含 `.env`、密钥文档、日志、依赖和构建产物
- [ ] 推送 `main` 到 `https://cnb.cool/nsmiling.com/ai-template`
- [ ] CI 通过后创建首个冻结标签

只有环境门禁全部通过后才能创建冻结标签；CI 失败时不得以本地内存模式结果代替。
