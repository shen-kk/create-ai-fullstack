# Admin 组件与页面模式

## 组件策略

页面只组合公共组件，不自行实现基础控件。现阶段组件状态：

| 能力             | 默认入口                       | 状态                           |
| ---------------- | ------------------------------ | ------------------------------ |
| Select           | `src/components/AppSelect.vue` | 已建立，唯一选择器入口         |
| Icon             | `src/components/AppIcon.vue`   | 已建立，统一线性图标           |
| Button           | `AppButton`                    | 待收口，新增前优先完成公共组件 |
| Dialog           | `AppDialog`                    | 待收口，不复制历史弹窗结构     |
| Input/FormField  | `AppInput` / `AppFormField`    | 待收口                         |
| Toast/Confirm    | `AppToast` / `AppConfirm`      | 待收口                         |
| Table/Pagination | `AppTable` / `AppPagination`   | 待收口                         |

现有组件不能满足需求时，优先新增有语义的 variant；如果底层方案确实不合适，按 ADR 流程替换，不长期保留两个默认入口。

## 标准列表页

顺序固定为：页面标题与主操作 → 筛选 → 加载/错误/空态 → 表格 → 分页。筛选提交、重置、分页和刷新使用真实 API 状态，禁止静态假数据。

## 标准表单

- 字段标签、必填标记、帮助信息和错误信息位置一致。
- 提交期间禁用重复操作并显示 loading；服务端错误使用稳定中文映射。
- Select、Checkbox、上传和密码控件不得退化为浏览器默认样式。
