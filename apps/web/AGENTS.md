# 用户端规则

- 业务组件统一放在 `app/components/ui`，以 shadcn-vue 为基础；表单、按钮、弹窗、选择器等交互组件不得在页面内重复实现。
- VueUse Motion 作为视觉动效增强层，封装组件放在 `app/components/motion`；不得让动效承载业务状态或破坏 SSR、可访问性与弱网体验。
- GSAP 只用于首页 Hero、滚动叙事等高价值编排，必须使用 `gsap.context()` 并在组件卸载时 `revert()`；普通显隐、列表和表单反馈继续使用 VueUse Motion。
- Design System 采用 Apple 的克制与空间感、Linear 的高密度交互、Vercel 的黑白信息层级；只借鉴设计原则，不复制品牌资产或页面。
- 页面优先组合 `ui` 与 `motion` 两层组件；动效层必须支持 `prefers-reduced-motion`，且移除后不应影响业务流程。

- 用户端默认考虑 SSR、SEO、可访问性和弱网体验。
- 服务端渲染所需请求使用 Nuxt `useFetch`/`useAsyncData`，不要无故退化为仅客户端请求。
- 仅 `NUXT_PUBLIC_*` 配置可以进入浏览器；任何密钥必须留在服务端运行时。
- 页面必须提供加载、空态、错误态；表单必须同时具备客户端体验校验和服务端权威校验。
- 元数据、标题和规范链接随公开页面一起实现。
- 不复制服务端业务规则，不从 API 内部目录深层导入。
