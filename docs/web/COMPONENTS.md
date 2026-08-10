# Web 基础组件规范

组件位于 `apps/web/app/components/ui`，以 shadcn-vue/reka-ui 为基础。页面不得复制组件源码或退化为不可统一的浏览器默认控件。

## 基础组件清单

| 组件                 | 状态   | 用途                       |
| -------------------- | ------ | -------------------------- |
| Button               | 已建立 | 主操作、次操作、幽灵操作   |
| Toast                | 已建立 | 跨页面成功与失败反馈       |
| Input/FormField      | 待补齐 | 文本输入、标签、帮助与错误 |
| Select               | 待补齐 | 单选下拉与键盘导航         |
| Checkbox/Radio       | 待补齐 | 多选与互斥选择             |
| Dialog/Drawer        | 待补齐 | 桌面弹窗与移动端抽屉       |
| DropdownMenu         | 待补齐 | 账户与上下文操作           |
| Skeleton/Empty/Error | 待补齐 | 请求生命周期反馈           |

新增功能需要“待补齐”组件时，先完成公共组件和状态示例，再实现页面。组件扩展使用 variant 和 slot；业务状态留在页面/composable。
