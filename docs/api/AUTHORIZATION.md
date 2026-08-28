# 鉴权、权限与审计规范

- Admin 与 Web 用户身份、会话和权限空间相互隔离。
- 后台管理员使用手机号作为必填唯一登录标识，邮箱为可选资料。
- 后台与用户端密码最少 6 个字符，边界统一读取共享契约的 `PASSWORD_MIN_LENGTH`；密码只保存 scrypt 哈希。
- 前端隐藏按钮只是体验优化，API 必须再次鉴权。
- 新功能同步菜单权限、操作权限、API Guard、默认角色种子和角色编辑界面。
- 高风险操作记录操作者、资源、动作、结果、requestId、来源 IP 和非敏感变更摘要。
- 审计日志不得包含密码、Token、Cookie、连接串和第三方密钥。
- Access Token 过期通过 Refresh Token 恢复；客户端只允许一次并发刷新，失败后清理会话。
- 后台与用户端 Access Token 都绑定数据库 Refresh Session。设备会话被撤销、账号停用或 Refresh Token 轮换后，旧 Session 对应的后续 Access Token 请求必须失败。
