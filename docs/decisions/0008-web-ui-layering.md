# ADR-0008：用户端 UI 分层

## 状态

已接受，2026-08-03。

## 决策

用户端使用两层 UI 结构：

- `apps/web/app/components/ui`：以 shadcn-vue 为基础，承载按钮、输入框、表单、弹窗、选择器等稳定业务交互。
- `apps/web/app/components/motion`：使用 VueUse Motion，承载入场、反馈与状态切换等渐进增强。

动效层不得保存业务状态，关闭动效后业务流程必须完整可用，并尊重 `prefers-reduced-motion`。SSR 首屏内容不得依赖客户端动画执行后才可见。

## 原因

shadcn-vue 提供开放源码、可访问且便于 AI 复用的业务组件基础；VueUse Motion 与 Vue/Nuxt 技术栈一致。分层可以避免动效实现侵入表单、校验和服务端状态处理。

## 影响

- 页面不得直接复制常用业务控件，应先复用或扩展 `components/ui`。
- 视觉组件必须可移除、可降级，并通过 SSR 与移动端检查。
- 引入第三方视觉源码前必须审查许可证、依赖和客户端执行范围。
