# 后台管理端规则

开始任务前阅读 `docs/admin/README.md` 和 `docs/standards/FEATURE_WORKFLOW.md`。Admin 使用独立的视觉与组件体系，不复制 Web 组件或样式。

- 后台用于内部运营；每个操作都必须与服务端权限保持一致，隐藏按钮不能替代鉴权。
- 页面负责组合，业务请求集中在 `src/api`，可复用 UI 放到 `src/components`。
- 不在组件中硬编码 API 地址、角色名或服务端状态含义。
- 列表页面必须处理加载、空数据、错误、分页；写操作必须防重复提交并给出反馈。
- 破坏性操作需要明确确认；高风险操作显示影响对象。
- 使用语义化 HTML，并确保键盘操作和可见焦点可用。
- 选择器统一使用 `src/components/AppSelect.vue`；禁止页面使用原生 `<select>` 或自行实现下拉浮层。
- 新增弹窗必须复用公共弹窗组件；在公共组件完成收口前，不得继续复制 `dialog-backdrop` / `user-dialog` 结构。
