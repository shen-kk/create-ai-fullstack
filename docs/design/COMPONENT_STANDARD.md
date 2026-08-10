# 组件开发标准

> 本文件保留为跨端组件治理入口。Admin 的实际组件与视觉规范以 `docs/admin` 为准，Web 以 `docs/web` 为准；两端不共享 UI 组件和 Design Token。

本文件定义 AI 开发页面时可使用的组件入口和验收规则。AI 在新增或修改界面前必须先查阅本清单；没有组件时应先补公共组件，不得直接在页面中临时实现。

这些规则是默认路径，不是永远不能改变的技术限制。如果现有组件无法满足可访问性、性能、交互或业务需求，AI 应主动提出更合适的实现，而不是勉强套用。

## 改进与例外机制

AI 认为现有组件不适合时，必须先向使用者说明：

1. 当前组件具体不能满足什么需求，并给出可复现证据；
2. 继续复用、扩展现有组件、替换公共组件三种方案的成本和影响；
3. 推荐方案会影响哪些已有页面、测试、Design Token 和可访问性行为；
4. 是否应升级为新的全局默认，还是仅作为特定场景例外。

经确认后，把决定记录到 `docs/decisions`。如果实现确实需要突破自动规则，在目标文件中加入：

```text
UI_STANDARD_EXCEPTION: docs/decisions/xxxx-description.md
```

`pnpm ui:check` 只接受指向真实 ADR 文件的例外。例外不得只写“特殊需求”，必须记录适用范围、替代方案和未来是否收口。更好的实现经过验证后，应更新本组件清单并迁移旧实现，而不是长期保留两套默认组件。

## 组件唯一入口

| 能力     | 后台管理                                  | 用户端                                   | 页面内禁止                         |
| -------- | ----------------------------------------- | ---------------------------------------- | ---------------------------------- |
| 选择器   | `apps/admin/src/components/AppSelect.vue` | `apps/web/app/components/ui/select`      | 原生 `<select>`、自制 listbox      |
| 按钮     | 现有语义类，待收口为 `AppButton`          | `apps/web/app/components/ui/button`      | 新增无状态样式按钮                 |
| 弹窗     | 待收口为 `AppDialog`                      | 待生成 shadcn-vue Dialog                 | 点击遮罩关闭、自制弹窗结构         |
| 全局反馈 | 后台统一反馈入口待组件化                  | `apps/web/app/components/AppToast.vue`   | `alert()`、`confirm()`、只写控制台 |
| 图标     | `apps/admin/src/components/AppIcon.vue`   | 当前组件内统一线性 SVG，后续收口图标入口 | emoji、混用填充与线性图标          |

“待收口”代表模板当前存在技术债，不能被当作允许复制的示例。新增功能若需要该能力，应先完成公共组件，再开发页面。

## 选择器标准

- 触发器高度、圆角、边框、focus ring、箭头和菜单阴影由公共组件决定。
- 页面只能传入值、选项、禁用状态、语义标签和布局 class，不得覆盖内部菜单样式。
- 必须支持鼠标及 `ArrowUp`、`ArrowDown`、`Home`、`End`、`Enter`、`Space`、`Escape` 和 `Tab`。
- 必须提供 `combobox`、`listbox`、`option`、`aria-expanded`、`aria-selected` 语义。
- 筛选区、表格行和弹窗中的选择器必须使用同一个组件；尺寸差异通过组件 variant 提供，不复制 CSS。

## 弹窗标准

- 点击遮罩不关闭；关闭按钮、取消按钮和 `Escape` 是明确关闭入口。
- 头部、内容、底部是三个固定结构；仅内容区滚动，滚动条贴容器最右侧。
- 头部与底部不跟随内容滚动，表单内部负责内容间距，外层不制造空白带。
- 打开后锁定页面滚动并把焦点移入弹窗；关闭后焦点回到触发元素。
- 宽度由 `sm`、`md`、`lg`、`xl` variant 决定，不在页面写任意宽度。

## 自动约束

`pnpm ui:check` 默认会阻止以下代码进入冻结版本：

- 原生 `<select>`；
- 公共组件以外的 `combobox` / `listbox`；
- 新增页面级 `dialog-backdrop`；
- 点击弹窗遮罩关闭；
- 浏览器原生 `alert()` / `confirm()`。

`pnpm check` 已包含 `pnpm ui:check`。AI 不得跳过检查来让提交通过；确有更优方案时使用上面的 ADR 例外流程，并在验证后推动规范升级。

## 当前审计结论

- 后台选择器已有唯一组件，已覆盖现有选择场景；组件需要持续作为唯一入口。
- 后台弹窗仍分散在多个历史页面，且全局 CSS 存在分段叠加，下一阶段应优先迁移到 `AppDialog`。
- 后台按钮仍以全局 class 为主，下一阶段应收口为 `AppButton` variants。
- 用户端目前只有 Button 和 Toast 基础组件；Select、Dialog、Input、Checkbox、FormField 尚未形成完整组件层。
- 在上述缺口补齐之前，新页面必须先补组件再组合页面，不能复制历史实现。
