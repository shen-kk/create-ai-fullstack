# ADR-0002：身份认证基线

- 状态：已接受
- 日期：2026-08-02

## 决策

- 模板以单租户身份模型起步，用户和权限结构保留未来增加 `tenantId` 的扩展点。
- API 签发短期 JWT Access Token，并用 HttpOnly、SameSite=Lax Cookie 保存 Refresh Token。
- Access Token 由客户端保存在内存/sessionStorage，请求使用 Bearer Header；不把 Refresh Token 暴露给 JavaScript。
- 服务端权限守卫是唯一权威，前端路由和菜单守卫只改善体验。
- `DATA_SOURCE=memory` 时开发管理员由环境变量创建；`DATA_SOURCE=prisma` 时登录和刷新均从数据库用户、角色、权限加载身份，生产环境禁止内存身份源。
- 权限接口使用声明式 `RequirePermissions` 装饰器，由服务端 `PermissionsGuard` 对 Access Token 中的权限执行最终判定。

## 安全约束

- 生产环境必须提供独立高强度 `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`，禁止使用模板默认值。
- 密码只保存自适应或内存困难哈希；当前开发提供器使用 Node `scrypt`。
- Refresh Token 使用唯一 `jti`，服务端只保存 SHA-256 摘要与会话元数据，不保存原始令牌。
- 刷新采用一次性轮换：旧会话以原子方式标记撤销后才签发新令牌；重复使用旧令牌必须失败，退出登录撤销当前会话。
- 刷新时必须使用令牌 `sub` 重新加载启用用户与最新权限；用户不存在或被停用时拒绝刷新。
- 登录失败按来源 IP 与规范化邮箱组合限流，默认 15 分钟最多 5 次；多实例生产环境使用 Redis 共享计数。
