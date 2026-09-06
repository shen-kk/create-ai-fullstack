# 当前项目声明（自动生成）

> 本文件由项目组合器根据 `project.config.json` 生成。不要手工修改。

## 项目

- 英文标识：`adminback-template`
- 显示名称：AI 友好全栈模板
- 包命名空间：`@template`
- 用途：可复用的后台管理、用户端与 API 项目模板
- 模板版本：`0.2.5`
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
- 用户端视觉归属：`project-defined`
- 默认对象存储：`resource_library`

## 已启用能力

- `authentication`
- `customerAuthentication`
- `userWeb`
- `adminUsers`
- `rolesAndPermissions`
- `auditLogs`
- `serviceConfig`
- `deploymentCenter`
- `objectStorage`
- `redis`
- `sms`
- `email`

## 未启用能力

- `payment`

## 已选择业务功能

- `customerWeb`

## AI 实现约束

- 开始开发前以 `project.config.json` 和本文件确认项目边界。
- 不得使用未启用能力；如需求需要，应先更新项目声明并说明影响。
- 密码、数据库连接串和服务密钥只存在于环境变量或加密配置中，不得写入本文档。
- 用户端身份与后台管理员身份必须保持隔离；具体项目不得绕过 API 直接访问数据层。
- 用户端视觉由具体项目定义；不得把模板 starter 的样式当作必须继承的设计标准。
- 首次开发 Web 页面或组件前检查 `docs/ai/WEB_DESIGN.md`；状态为 `pending` 时必须先询问并记录用户期望的样式风格。
- 风格确认后必须统一改造所有现存 Web 界面与全局样式，不能只修改新增页面；模板首页不得展示模板架构或安装文档。
