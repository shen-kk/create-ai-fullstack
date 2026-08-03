INSERT INTO "Permission" ("id", "code", "description", "type", "groupCode", "createdAt") VALUES
  ('perm_menu_verification', 'menu.verification', '显示验证码记录菜单', 'MENU', 'verification', CURRENT_TIMESTAMP),
  ('perm_verification_read', 'verification.read', '查看验证码发送记录', 'ACTION', 'verification', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'super_admin' AND p."code" IN ('menu.verification', 'verification.read')
ON CONFLICT DO NOTHING;
