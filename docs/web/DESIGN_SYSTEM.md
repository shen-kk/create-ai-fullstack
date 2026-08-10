# Web Design System

视觉方向借鉴 Apple 的空间与克制、Linear 的交互精度、Vercel 的信息层级，但不复制品牌资产。

## Token

- 颜色、字号、间距、圆角、阴影、内容宽度、层级和断点必须来自 Web Token。
- 页面不得随意增加接近但不同的颜色、圆角或阴影；新 Token 必须说明复用场景。
- 标题、正文、辅助文字和操作文字保持稳定层级，中文与英文混排需要检查视觉平衡。

## 交互

- Button、Input、Select、Dialog 等使用 shadcn-vue 公共组件。
- hover、focus、disabled、loading、error 状态都必须清晰且满足对比度。
- 手机端优先保证点击区域、输入体验、键盘遮挡和内容顺序。
- 全局反馈使用 AppToast，字段错误靠近控件；错误提示必须告诉用户下一步。
