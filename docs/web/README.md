# Web 用户端开发规范入口

Web 是面向最终用户的 Nuxt SSR 应用。模板只约束 SSR、SEO、可访问性、弱网和组件边界；视觉品牌由生成后的具体项目定义，现有界面只是可替换 starter。

## 必读路由

- 首次视觉确认：`docs/ai/WEB_DESIGN.md`
- 视觉系统：`docs/web/DESIGN_SYSTEM.md`
- 基础组件：`docs/web/COMPONENTS.md`
- 动效边界：`docs/web/MOTION.md`
- SSR 与 SEO：`docs/web/SSR_SEO.md`
- 新功能流程：`docs/web/FEATURE_GUIDE.md`

Web 使用 Tailwind CSS + shadcn-vue，不复用 Admin 的组件或 CSS。共享范围只包括 contracts、业务词汇、稳定错误码和服务端能力。
