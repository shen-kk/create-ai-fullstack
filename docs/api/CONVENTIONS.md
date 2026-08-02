# API 约定

- 基础路径：`/api`；非兼容变更引入 `/api/v2`，不得静默改变语义。
- JSON 字段使用 `camelCase`，时间使用带时区的 ISO 8601 UTC 字符串。
- 成功响应直接返回资源或分页对象；不添加无信息量的 `success` 包装。
- 错误结构：`{ "code": "STABLE_CODE", "message": "可读说明", "details"?: unknown, "requestId"?: string }`。
- 每个响应携带 `x-request-id`；客户端报告问题时应提供该值，但不得把令牌或密码一并上报。
- HTTP 日志使用单行 JSON，至少包含 `requestId`、`method`、`path`、`statusCode`、`durationMs`；已认证时可包含 `actorId`。禁止记录请求体、密码、Cookie、Authorization Header 和 Refresh Token。
- `/api/health/live` 只表示进程存活；`/api/health/ready` 检查 PostgreSQL 等必要依赖。部署平台就绪探针必须使用后者。
- 分页统一使用从 1 开始的 `page`、`pageSize`，`pageSize` 最大 100，响应为 `{ items, page, pageSize, total }`。
- 列表必须使用稳定排序；默认按 `createdAt desc`，并追加唯一字段 `id asc` 作为并列排序，避免翻页重复或遗漏。对外开放自定义排序前必须使用字段白名单，不接受原始 SQL 或任意字段名。
- 关键词在进入仓储前去除首尾空格；空字符串等同未筛选。分页越界返回空 `items` 和真实 `total`，不隐式改写页码。
- 所有写操作必须校验 DTO；需要重试安全的创建操作应支持幂等键。
- 删除默认软删除还是硬删除，必须由领域文档明确，不做全局猜测。
