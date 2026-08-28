# Admin 状态与 API 接入

- 所有请求集中在 `src/api`，页面不得硬编码 API 地址或直接拼接鉴权头。
- 列表统一处理关键词、分页、稳定排序、加载、错误、重试和空态。
- 写操作统一处理 submitting、成功反馈、字段错误、全局错误和会话失效。
- 401 尝试统一刷新会话；刷新失败退出登录。403 显示无权限，不伪装成空数据。
- 状态码和错误码通过集中映射显示中文；未知错误展示 requestId 和重试建议。
- 页面菜单与按钮检查权限，API 仍执行权威校验。

## 登录会话续期

Admin access token 默认 15 分钟有效。前端在过期前约 1 分钟通过 HttpOnly refresh cookie 自动换取新 token；刷新失败会清理本地会话并跳转登录页，不等待用户下一次点击菜单。

个人中心通过 `GET /api/auth/sessions` 查看有效登录设备，通过 `DELETE /api/auth/sessions/others` 保留当前设备并退出其他设备。Access Token 绑定数据库 Session，因此被撤销设备无需等待令牌自然过期。
