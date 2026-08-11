# 当前项目声明（自动生成）

> 本文件由 `pnpm template:init` 根据 `project.config.json` 生成。不要手工修改；需要调整能力时重新运行初始化命令。

## 项目

- 英文标识：`adminback-template`
- 显示名称：AI 友好全栈模板
- 包命名空间：`@template`
- 用途：可复用的后台管理、用户端与 API 项目模板
- 模板版本：`0.1.0`
- 模板仓库：https://github.com/shen-kk/create-ai-fullstack

## 运行与数据

- 后台端口：`3000`
- API 端口：`3001`
- 用户端口：`3002`
- 数据模式：`prisma`
- 数据库：`postgresql`
- ORM：`prisma`
- 默认语言：`zh-CN`
- 用户端业务组件：`shadcn-vue`
- 用户端动效：`vueuse-motion`
- 用户端动画编排：`gsap`
- 用户端设计标准：`apple-linear-vercel`
- 默认对象存储：`tencent_cos`

## 已启用能力

- `authentication`
- `customerAuthentication`
- `userWeb`
- `adminUsers`
- `rolesAndPermissions`
- `auditLogs`
- `serviceConfig`
- `objectStorage`
- `redis`
- `sms`
- `email`
- `payment`

## 未启用能力

- 无

## AI 实现约束

- 开始开发前以 `project.config.json` 和本文件确认项目边界。
- 不得使用未启用能力；如需求需要，应先更新项目声明并说明影响。
- 密码、数据库连接串和服务密钥只存在于环境变量或加密配置中，不得写入本文档。
- 用户端身份与后台管理员身份必须保持隔离；具体项目不得绕过 API 直接访问数据层。
