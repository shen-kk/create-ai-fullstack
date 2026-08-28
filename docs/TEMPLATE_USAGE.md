# 模板使用与维护

## 两阶段流程

AIForge 明确区分代码组合与运行环境配置：

```text
create-aiforge  选择业务功能并生成代码
pnpm run setup  配置开发环境和初始化数据库
后台服务配置     添加邮件、短信、Redis、对象存储等资源
部署中心         配置生产部署资源与发布
```

## 功能选择

```bash
npm create aiforge@latest my-project
```

向导通过方向键、空格和回车进行终端多选。可选功能由 `packages/create-ai-fullstack/lib/features.mjs` 唯一声明；依赖会自动加入。CLI 不允许把 `email`、`sms`、`redis` 或 `objectStorage` 当作独立业务功能。

自动化环境可以显式传入功能：

```bash
npm create aiforge@latest my-project -- --features=customerWeb,customerAvatar
```

只生成核心后台：

```bash
npm create aiforge@latest my-project -- --features=
```

## 环境初始化

```bash
pnpm run setup
```

该命令只配置当前项目启用应用的端口、PostgreSQL、项目密钥和初始管理员。重新执行前会备份现有 `.env`，已有项目密钥默认保留。数据库密码使用隐藏输入，不进入命令参数、项目声明或 AI 文档。

## 功能归属

新增可裁剪功能前必须：

1. 在功能目录登记 ID、显示名称和依赖；
2. 为独占文件声明唯一归属；
3. 将多消费者代码登记为共享能力；
4. 让 `modules` 从功能目录生成；
5. 增加关闭、单独启用和完整组合测试；
6. 运行 `pnpm feature:check` 与 `pnpm template:verify`。

详细规则见 `docs/architecture/FEATURE_COMPOSITION.md` 和 ADR-0013。

## 模板发布

模板完整源码来自 GitHub，npm 包只保存创建器和功能目录。发布前必须验证仅核心、用户端、验证码、部署中心和完整功能组合，且不得包含 `.env`、数据库连接串、服务密钥、日志或构建产物。
